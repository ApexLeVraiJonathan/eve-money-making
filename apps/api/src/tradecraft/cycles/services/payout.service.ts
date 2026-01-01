import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { ProfitService } from './profit.service';
import { NotificationService } from '@api/notifications/notification.service';
import { JingleYieldService } from './jingle-yield.service';

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
    private readonly notifications: NotificationService,
    private readonly jingleYield: JingleYieldService,
  ) {}

  /**
   * Ensure that ACTIVE JingleYield users always have a rollover participation
   * created in the next cycle, even if they did not manually opt into rollover.
   *
   * Without this, JingleYield's admin-funded locked principal can "fall out" of
   * the next cycle because `processRollovers()` only processes rollover
   * participations that already exist in the target cycle.
   */
  private async ensureJingleYieldDefaultRollovers(input: {
    closedCycleId: string;
    targetCycleId: string;
  }): Promise<{ created: number; skippedExisting: number }> {
    const { closedCycleId, targetCycleId } = input;

    // Find JY-linked participations from the cycle being closed, limited to
    // ACTIVE programs (locked principal still enforced).
    const jyFromParticipations =
      await this.prisma.cycleParticipation.findMany({
        where: {
          cycleId: closedCycleId,
          userId: { not: null },
          jingleYieldProgramId: { not: null },
          jingleYieldProgram: {
            status: 'ACTIVE',
          },
        },
        select: {
          id: true,
          userId: true,
          characterName: true,
          amountIsk: true,
        },
      });

    if (jyFromParticipations.length === 0) {
      return { created: 0, skippedExisting: 0 };
    }

    let created = 0;
    let skippedExisting = 0;

    for (const fromP of jyFromParticipations) {
      const userId = fromP.userId;
      if (!userId) continue;

      // Respect the per-cycle unique constraint. If the user already has *any*
      // participation in the next cycle (manual opt-in, rollover, etc.), do not
      // create another one.
      const existing = await this.prisma.cycleParticipation.findFirst({
        where: {
          cycleId: targetCycleId,
          userId,
        },
        select: { id: true, memo: true, rolloverType: true },
      });

      if (existing) {
        skippedExisting++;
        this.logger.debug(
          `[JY AutoRollover] Skipping user ${userId.substring(
            0,
            8,
          )} for cycle ${targetCycleId.substring(0, 8)}: already has participation ${existing.id.substring(
            0,
            8,
          )} (memo=${existing.memo}, rolloverType=${String(
            existing.rolloverType,
          )})`,
        );
        continue;
      }

      const memo = `ROLLOVER-${targetCycleId.substring(0, 8)}-${fromP.id.substring(
        0,
        8,
      )}-INITIAL`;

      await this.prisma.cycleParticipation.create({
        data: {
          cycleId: targetCycleId,
          userId,
          characterName: fromP.characterName,
          // Default behavior: roll principal forward, pay out profits.
          // (This will be finalized/auto-validated by processRollovers below.)
          amountIsk: fromP.amountIsk,
          memo,
          status: 'AWAITING_INVESTMENT',
          rolloverType: 'INITIAL_ONLY',
          rolloverRequestedAmountIsk: fromP.amountIsk,
          rolloverFromParticipationId: fromP.id,
        },
      });

      created++;
    }

    if (created > 0 || skippedExisting > 0) {
      this.logger.log(
        `[JY AutoRollover] Prepared default rollovers for cycle ${targetCycleId.substring(
          0,
          8,
        )}: created=${created}, skippedExisting=${skippedExisting}`,
      );
    }

    return { created, skippedExisting };
  }

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

    // Apply JingleYield interest accumulation for this cycle
    await this.jingleYield.applyCyclePayouts(cycleId, payouts);

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
      const participation = await this.prisma.cycleParticipation.update({
        where: { id: payout.participationId },
        data: {
          payoutAmountIsk: payout.totalPayoutIsk,
          status: 'AWAITING_PAYOUT', // Payout calculated, awaiting admin to send
        },
      });

      // Notify participant that results are available (best-effort)
      void this.notifications
        .notifyCycleResults(participation.cycleId)
        .catch((err: unknown) =>
          this.logger.warn(
            `Failed to send cycle results notifications: ${String(err)}`,
          ),
        );
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

    // Ensure ACTIVE JingleYield programs always carry their principal forward by
    // creating a default rollover participation when the user did not explicitly
    // opt into rollover for the next cycle.
    try {
      await this.ensureJingleYieldDefaultRollovers({
        closedCycleId,
        targetCycleId: nextCycle.id,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[JY AutoRollover] Failed to ensure default rollovers for closedCycleId=${closedCycleId.substring(
          0,
          8,
        )} → targetCycleId=${nextCycle.id.substring(0, 8)}: ${String(err)}`,
      );
    }

    // Find all participations in the next cycle that have rollover configured
    const rolloverParticipations =
      await this.prisma.cycleParticipation.findMany({
        where: {
          cycleId: nextCycle.id,
          rolloverType: { not: null },
          rolloverFromParticipationId: { not: null },
        },
        include: {
          rolloverFromParticipation: {
            include: {
              jingleYieldProgram: true,
            },
          },
          jingleYieldProgram: true,
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

    // Filter to only process rollovers from the closed cycle.
    //
    // IMPORTANT: Only process unvalidated rollovers to make this operation
    // idempotent/safe to re-run for admin backfills. Once a rollover has been
    // processed, we set `validatedAt` and `status=OPTED_IN`; reprocessing would
    // incorrectly treat the already-adjusted payout as the "actual payout".
    const relevantRollovers = rolloverParticipations.filter(
      (rp) =>
        rp.rolloverFromParticipation?.cycleId === closedCycleId &&
        rp.validatedAt == null &&
        rp.status === 'AWAITING_INVESTMENT',
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
          select: {
            payoutAmountIsk: true,
            amountIsk: true,
            status: true,
            payoutPaidAt: true,
          },
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

      // Determine rollover amount based on type (baseline before JingleYield locks).
      // For FULL_PAYOUT rollovers we also take into account any user-funded extra
      // that was added on top of the auto-funded rollover participation while the
      // cycle was PLANNED. That extra should:
      //   1) Count toward the 10B principal cap (enforced at increase time), and
      //   2) Be included in the 20B total cap when we compute the rolled amount.
      let rolloverAmount: number;
      let userExtraForRollover = 0;

      if (rollover.rolloverType === 'FULL_PAYOUT') {
        // Extra is encoded using the 1 ISK placeholder convention:
        //   - 1.00 ISK → no user extra
        //   - 1.00 + X → X ISK of user-funded extra
        userExtraForRollover = Math.max(Number(rollover.amountIsk) - 1, 0);

        const totalBeforeCaps = actualPayout + userExtraForRollover;
        const cappedTotal = Math.min(totalBeforeCaps, CAP_20B);

        // Portion of the capped total that is funded by the previous cycle payout.
        const rolledFromPayout = Math.min(
          actualPayout,
          cappedTotal - userExtraForRollover,
        );

        rolloverAmount = rolledFromPayout + userExtraForRollover;
      } else if (rollover.rolloverType === 'INITIAL_ONLY') {
        rolloverAmount = initialInvestment;
      } else {
        // CUSTOM_AMOUNT
        rolloverAmount = Number(rollover.rolloverRequestedAmountIsk);
      }

      // Enforce JingleYield locked principal when applicable
      const jyProgram =
        rollover.jingleYieldProgram ??
        rollover.rolloverFromParticipation?.jingleYieldProgram ??
        null;

      if (jyProgram && jyProgram.status === 'ACTIVE') {
        const lockedBase = Number(jyProgram.lockedPrincipalIsk);

        if (lockedBase > 0) {
          if (actualPayout >= lockedBase) {
            // Ensure we keep at least the locked principal invested
            rolloverAmount = Math.max(rolloverAmount, lockedBase);
          } else {
            // Capital is already below locked base (loss scenario) – cannot enforce further
            rolloverAmount = Math.min(rolloverAmount, actualPayout);
          }
        }
      }

      // Apply global 20B cap and never exceed actual payout for the portion that
      // is funded by the closed cycle's payout. User-funded extra is handled
      // above for FULL_PAYOUT; for other types it is not currently modelled.
      if (rollover.rolloverType !== 'FULL_PAYOUT') {
        rolloverAmount = Math.min(rolloverAmount, CAP_20B, actualPayout);
      }

      const payoutAmount =
        actualPayout - Math.min(rolloverAmount, actualPayout);

      // Update rollover participation with actual amounts and auto-validate.
      // If this rollover belongs to an ACTIVE JingleYield program, make sure
      // the participation is explicitly linked to that program so that
      // admin reporting can see all JY participations across cycles.
      await this.prisma.cycleParticipation.update({
        where: { id: rollover.id },
        data: {
          amountIsk: rolloverAmount.toFixed(2),
          status: 'OPTED_IN', // Auto-validate rollover participations
          validatedAt: new Date(),
          ...(jyProgram
            ? {
                jingleYieldProgramId: jyProgram.id,
              }
            : {}),
        },
      });

      // Update original participation payout to reflect rollover deduction
      const alreadyPaid =
        participationWithPayout?.payoutPaidAt != null ||
        participationWithPayout?.status === 'COMPLETED';

      await this.prisma.cycleParticipation.update({
        where: { id: fromParticipation.id },
        data: {
          payoutAmountIsk: payoutAmount.toFixed(2),
          rolloverDeductedIsk: rolloverAmount.toFixed(2), // Track how much was rolled over
          // IMPORTANT: Preserve paid-out status for admin backfills. If an admin
          // has already marked this participation as paid, we should not revert
          // it back to AWAITING_PAYOUT or wipe payoutPaidAt.
          status: alreadyPaid
            ? 'COMPLETED'
            : payoutAmount > 0
              ? 'AWAITING_PAYOUT'
              : 'COMPLETED',
          payoutPaidAt: alreadyPaid
            ? participationWithPayout?.payoutPaidAt ?? null
            : payoutAmount === 0
              ? new Date()
              : null, // Auto-mark as paid if nothing to pay
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

  /**
   * Admin helper: backfill missing default JingleYield rollover participations
   * into a specific target cycle and then process rollovers for the inferred
   * source (closed) cycle.
   */
  async backfillJingleYieldRolloversForTargetCycle(input: {
    targetCycleId: string;
    sourceClosedCycleId?: string;
    profitSharePct?: number;
  }): Promise<{
    targetCycleId: string;
    sourceClosedCycleId: string;
    ensured: { created: number; skippedExisting: number };
    rollovers: {
      processed: number;
      rolledOver: string;
      paidOut: string;
    };
  }> {
    const targetCycle = await this.prisma.cycle.findUnique({
      where: { id: input.targetCycleId },
      select: { id: true, status: true, startedAt: true },
    });
    if (!targetCycle) throw new Error('Target cycle not found');
    if (targetCycle.status !== 'OPEN' && targetCycle.status !== 'PLANNED') {
      throw new Error(
        'Backfill only supported for target cycles in OPEN or PLANNED status',
      );
    }

    let sourceClosedCycleId = input.sourceClosedCycleId;

    if (!sourceClosedCycleId) {
      // Prefer the most recent completed cycle that closed before this target started.
      const inferred = await this.prisma.cycle.findFirst({
        where: {
          status: 'COMPLETED',
          closedAt: { not: null, lte: targetCycle.startedAt },
          id: { not: targetCycle.id },
        },
        orderBy: { closedAt: 'desc' },
        select: { id: true },
      });

      // Fallback: the most recent completed cycle overall.
      const fallback = inferred
        ? null
        : await this.prisma.cycle.findFirst({
            where: { status: 'COMPLETED', id: { not: targetCycle.id } },
            orderBy: { closedAt: 'desc' },
            select: { id: true },
          });

      sourceClosedCycleId = inferred?.id ?? fallback?.id;
    }

    if (!sourceClosedCycleId) {
      throw new Error(
        'Could not infer a source completed cycle; please provide sourceClosedCycleId',
      );
    }

    const ensured = await this.ensureJingleYieldDefaultRollovers({
      closedCycleId: sourceClosedCycleId,
      targetCycleId: targetCycle.id,
    });

    const rollovers = await this.processRollovers(
      sourceClosedCycleId,
      targetCycle.id,
      input.profitSharePct ?? 0.5,
    );

    return {
      targetCycleId: targetCycle.id,
      sourceClosedCycleId,
      ensured,
      rollovers,
    };
  }
}
