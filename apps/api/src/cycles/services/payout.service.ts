import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfitService } from './profit.service';

/**
 * PayoutService handles payout computation and creation.
 * Responsibilities: Computing payouts based on profit share, creating payout records.
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProfitService))
    private readonly profitService: ProfitService,
  ) {}

  /**
   * Compute payouts for validated participations
   */
  async computePayouts(cycleId: string, profitSharePct = 0.5) {
    // Get validated participations
    const participations = await this.prisma.cycleParticipation.findMany({
      where: {
        cycleId,
        status: 'OPTED_IN',
        validatedAt: { not: null },
      },
    });

    if (!participations.length) {
      return { payouts: [], totalPayout: '0.00' };
    }

    // Compute total participation capital
    const totalCapital = participations.reduce(
      (sum, p) => sum + Number(p.amountIsk),
      0,
    );

    // Get actual cycle profit from ProfitService
    const profitData = await this.profitService.computeCycleProfit(cycleId);
    const cycleProfit = Number(profitData.cycleProfitCash);

    this.logger.log(
      `Cycle ${cycleId} profit: ${cycleProfit.toFixed(2)} ISK (${(profitSharePct * 100).toFixed(0)}% to investors)`,
    );

    const profitToDistribute = cycleProfit * profitSharePct;
    const payouts = participations.map((p) => {
      const share = Number(p.amountIsk) / totalCapital;
      const profitShare = profitToDistribute * share;
      const totalPayout = Number(p.amountIsk) + profitShare;

      return {
        participationId: p.id,
        userId: p.userId,
        characterName: p.characterName,
        investmentIsk: Number(p.amountIsk).toFixed(2),
        profitShareIsk: profitShare.toFixed(2),
        totalPayoutIsk: totalPayout.toFixed(2),
      };
    });

    const totalPayout = payouts.reduce(
      (sum, p) => sum + Number(p.totalPayoutIsk),
      0,
    );

    return {
      payouts,
      totalPayout: totalPayout.toFixed(2),
    };
  }

  /**
   * Create payout records for validated participations
   */
  async createPayouts(
    cycleId: string,
    profitSharePct = 0.5,
  ): Promise<Array<{ participationId: string; payoutIsk: string }>> {
    const { payouts } = await this.computePayouts(cycleId, profitSharePct);

    const results: Array<{ participationId: string; payoutIsk: string }> = [];

    for (const payout of payouts) {
      // Update participation with payout amount and mark as AWAITING_PAYOUT
      await this.prisma.cycleParticipation.update({
        where: { id: payout.participationId },
        data: {
          payoutAmountIsk: payout.totalPayoutIsk,
          status: 'AWAITING_PAYOUT', // Payout calculated, awaiting admin to send
        },
      });

      this.logger.log(
        `Set payout for ${payout.characterName}: ${payout.totalPayoutIsk} ISK (investment: ${payout.investmentIsk}, profit share: ${payout.profitShareIsk})`,
      );

      results.push({
        participationId: payout.participationId,
        payoutIsk: payout.totalPayoutIsk,
      });
    }

    return results;
  }

  /**
   * Finalize payouts (compute and create in one step)
   */
  async finalizePayouts(
    cycleId: string,
    profitSharePct = 0.5,
  ): Promise<{
    payouts: Array<{
      participationId: string;
      userId: string | null;
      characterName: string;
      investmentIsk: string;
      profitShareIsk: string;
      totalPayoutIsk: string;
    }>;
    totalPayout: string;
  }> {
    const rec = await this.computePayouts(cycleId, profitSharePct);

    // Create payout records and mark as awaiting payout
    for (const payout of rec.payouts) {
      await this.prisma.cycleParticipation.update({
        where: { id: payout.participationId },
        data: {
          payoutAmountIsk: payout.totalPayoutIsk,
          status: 'AWAITING_PAYOUT', // Payout calculated, awaiting admin to send
        },
      });
    }

    return rec;
  }

  /**
   * Process rollover participations for a closed cycle
   * This creates participations in the next PLANNED cycle based on payout amounts
   */
  async processRollovers(
    closedCycleId: string,
    targetCycleId?: string, // Optional: the cycle that just opened and should receive rollovers
    profitSharePct = 0.5,
  ): Promise<{
    processed: number;
    rolledOver: string;
    paidOut: string;
  }> {
    this.logger.log(
      `[DEBUG] processRollovers called for closedCycleId: ${closedCycleId.substring(0, 8)}, targetCycleId: ${targetCycleId?.substring(0, 8) ?? 'auto-detect'}`,
    );

    // Determine the target cycle for rollovers
    let nextCycle;
    if (targetCycleId) {
      // Use the explicitly provided target cycle (the one that just opened)
      nextCycle = await this.prisma.cycle.findUnique({
        where: { id: targetCycleId },
      });
      if (!nextCycle) {
        this.logger.warn(`Target cycle ${targetCycleId} not found`);
        return { processed: 0, rolledOver: '0.00', paidOut: '0.00' };
      }
    } else {
      // Fallback: Find the next PLANNED or newly OPEN cycle
      nextCycle = await this.prisma.cycle.findFirst({
        where: {
          status: { in: ['PLANNED', 'OPEN'] },
          id: { not: closedCycleId }, // Exclude the cycle being closed
        },
        orderBy: { startedAt: 'asc' },
      });
      if (!nextCycle) {
        this.logger.log(
          'No PLANNED/OPEN cycle found, skipping rollover processing',
        );
        return { processed: 0, rolledOver: '0.00', paidOut: '0.00' };
      }
    }

    this.logger.log(
      `[DEBUG] Found next cycle: ${nextCycle.id.substring(0, 8)}, status: ${nextCycle.status}`,
    );

    // Find all participations in the next cycle that have rollover configured
    const rolloverParticipations =
      await this.prisma.cycleParticipation.findMany({
        where: {
          cycleId: nextCycle.id,
          rolloverType: { not: null },
          rolloverFromParticipationId: { not: null },
        },
        include: {
          rolloverFromParticipation: true,
        },
      });

    this.logger.log(
      `[DEBUG] Found ${rolloverParticipations.length} rollover participations in cycle ${nextCycle.id.substring(0, 8)}`,
    );

    if (rolloverParticipations.length > 0) {
      for (const rp of rolloverParticipations) {
        this.logger.log(
          `[DEBUG]   - Rollover participation ${rp.id.substring(0, 8)}: rolloverType=${rp.rolloverType}, fromParticipationId=${rp.rolloverFromParticipationId?.substring(0, 8)}, fromCycleId=${rp.rolloverFromParticipation?.cycleId?.substring(0, 8)}`,
        );
      }
    }

    // Filter to only process rollovers from the closed cycle
    const relevantRollovers = rolloverParticipations.filter(
      (rp) => rp.rolloverFromParticipation?.cycleId === closedCycleId,
    );

    this.logger.log(
      `[DEBUG] ${relevantRollovers.length} rollovers are from the closed cycle ${closedCycleId.substring(0, 8)}`,
    );

    if (relevantRollovers.length === 0) {
      this.logger.log('No rollover participations found');
      return { processed: 0, rolledOver: '0.00', paidOut: '0.00' };
    }

    this.logger.log(
      `Processing ${relevantRollovers.length} rollover participations`,
    );

    let totalRolledOver = 0;
    let totalPaidOut = 0;
    const CAP_20B = 20_000_000_000;

    for (const rollover of relevantRollovers) {
      const fromParticipation = rollover.rolloverFromParticipation!;

      // Fetch the actual payout amount from the participation record
      // (payouts should have been created before processRollovers is called)
      const participationWithPayout =
        await this.prisma.cycleParticipation.findUnique({
          where: { id: fromParticipation.id },
          select: { payoutAmountIsk: true, amountIsk: true },
        });

      let actualPayoutIsk: string;
      let initialInvestmentIsk: string;

      if (!participationWithPayout?.payoutAmountIsk) {
        this.logger.warn(
          `No payout amount set for participation ${fromParticipation.id}, using computed value`,
        );
        // Fallback: compute payout
        const { payouts } = await this.computePayouts(
          closedCycleId,
          profitSharePct,
        );
        const payoutInfo = payouts.find(
          (p) => p.participationId === fromParticipation.id,
        );
        if (!payoutInfo) {
          this.logger.warn(
            `Cannot compute payout for participation ${fromParticipation.id}, skipping rollover`,
          );
          continue;
        }
        actualPayoutIsk = payoutInfo.totalPayoutIsk;
        initialInvestmentIsk = fromParticipation.amountIsk.toString();
      } else {
        actualPayoutIsk = participationWithPayout.payoutAmountIsk.toString();
        initialInvestmentIsk = participationWithPayout.amountIsk.toString();
      }

      const actualPayout = Number(actualPayoutIsk);
      const initialInvestment = Number(initialInvestmentIsk);

      // Determine rollover amount based on type
      let rolloverAmount: number;
      if (rollover.rolloverType === 'FULL_PAYOUT') {
        rolloverAmount = Math.min(actualPayout, CAP_20B);
      } else if (rollover.rolloverType === 'INITIAL_ONLY') {
        rolloverAmount = Math.min(initialInvestment, CAP_20B);
      } else {
        // CUSTOM_AMOUNT
        rolloverAmount = Math.min(
          Number(rollover.rolloverRequestedAmountIsk),
          CAP_20B,
        );
      }

      const payoutAmount = actualPayout - rolloverAmount;

      // Update rollover participation with actual amounts and auto-validate
      await this.prisma.cycleParticipation.update({
        where: { id: rollover.id },
        data: {
          amountIsk: rolloverAmount.toFixed(2),
          status: 'OPTED_IN', // Auto-validate rollover participations
          validatedAt: new Date(),
        },
      });

      // Update original participation payout to reflect rollover deduction
      await this.prisma.cycleParticipation.update({
        where: { id: fromParticipation.id },
        data: {
          payoutAmountIsk: payoutAmount.toFixed(2),
          status: payoutAmount > 0 ? 'AWAITING_PAYOUT' : 'COMPLETED',
          payoutPaidAt: payoutAmount === 0 ? new Date() : null, // Auto-mark as paid if nothing to pay
        },
      });

      totalRolledOver += rolloverAmount;
      totalPaidOut += payoutAmount;

      this.logger.log(
        `Rollover processed for ${rollover.characterName}: ${rolloverAmount.toFixed(2)} ISK rolled over, ${payoutAmount.toFixed(2)} ISK paid out`,
      );
    }

    return {
      processed: rolloverParticipations.length,
      rolledOver: totalRolledOver.toFixed(2),
      paidOut: totalPaidOut.toFixed(2),
    };
  }
}
