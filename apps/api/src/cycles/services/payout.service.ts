import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * PayoutService handles payout computation and creation.
 * Responsibilities: Computing payouts based on profit share, creating payout records.
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    // Get cycle profit (placeholder - would call profit service)
    // For now, return structure without actual profit calc
    const cycleProfit = 0; // TODO: Inject ProfitService

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
      // Update participation with payout amount
      await this.prisma.cycleParticipation.update({
        where: { id: payout.participationId },
        data: {
          payoutAmountIsk: payout.totalPayoutIsk,
        },
      });

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

    // Create payout records
    for (const payout of rec.payouts) {
      await this.prisma.cycleParticipation.update({
        where: { id: payout.participationId },
        data: {
          payoutAmountIsk: payout.totalPayoutIsk,
        },
      });
    }

    return rec;
  }
}
