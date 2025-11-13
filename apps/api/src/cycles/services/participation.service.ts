import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CharacterService } from '../../characters/services/character.service';
import type { ParticipationStatus, Prisma } from '@eve/prisma';

/**
 * ParticipationService handles user participation in cycles.
 * Responsibilities: Participation CRUD, validation, opt-out.
 */
@Injectable()
export class ParticipationService {
  private readonly logger = new Logger(ParticipationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly characterService: CharacterService,
  ) {}

  /**
   * Determine maximum allowed participation for a user
   * Returns 10B for first-time or users who fully cashed out
   * Returns 20B for users with active rollover history
   */
  async determineMaxParticipation(userId?: string): Promise<number> {
    if (!userId) return 10_000_000_000; // 10B for non-authenticated users

    const ACTIVE_ROLLOVER_STATUSES: ParticipationStatus[] = [
      'AWAITING_INVESTMENT',
      'AWAITING_VALIDATION',
      'OPTED_IN',
    ];

    // 1. Check if the user currently has an upcoming rollover participation in a PLANNED/OPEN cycle
    const activeRollover = await this.prisma.cycleParticipation.findFirst({
      where: {
        userId,
        rolloverFromParticipationId: { not: null },
        status: { in: ACTIVE_ROLLOVER_STATUSES },
        cycle: {
          status: { in: ['PLANNED', 'OPEN'] },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (activeRollover) {
      this.logger.debug(
        `[determineMaxParticipation] Active rollover participation in upcoming cycle: ${activeRollover.id.substring(0, 8)} → 20B cap`,
      );
      return 20_000_000_000;
    }

    // 2. Fetch ALL completed participations and find the truly most recent one
    const allParticipations = await this.prisma.cycleParticipation.findMany({
      where: {
        userId,
      },
      include: {
        cycle: {
          select: {
            id: true,
            startedAt: true,
            closedAt: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    this.logger.debug(
      `[determineMaxParticipation] Found ${allParticipations.length} total participations for ${userId}:`,
    );
    for (const p of allParticipations) {
      this.logger.debug(
        `  - ${p.id.substring(0, 8)}: cycle=${p.cycle?.id.substring(0, 8) ?? 'n/a'}, cycleStatus=${p.cycle?.status ?? 'n/a'}, cycleClosedAt=${p.cycle?.closedAt?.toISOString() ?? 'null'}, pStatus=${p.status}, rolloverFrom=${p.rolloverFromParticipationId?.substring(0, 8) ?? 'none'}`,
      );
    }

    // Filter to completed participations in completed cycles
    const completedParticipations = allParticipations.filter(
      (p) =>
        (p.status === 'COMPLETED' ||
          p.status === 'AWAITING_PAYOUT' ||
          p.status === 'REFUNDED') &&
        p.cycle?.status === 'COMPLETED',
    );

    if (completedParticipations.length === 0) {
      this.logger.debug(
        '[determineMaxParticipation] No completed participations found → 10B cap',
      );
      return 10_000_000_000;
    }

    // Sort by cycle closed date to find the most recent
    completedParticipations.sort((a, b) => {
      const aDate = a.cycle?.closedAt?.getTime() ?? 0;
      const bDate = b.cycle?.closedAt?.getTime() ?? 0;
      return bDate - aDate; // desc
    });

    const mostRecent = completedParticipations[0];
    this.logger.debug(
      `[determineMaxParticipation] Most recent completed: ${mostRecent.id.substring(0, 8)} in cycle ${mostRecent.cycle?.id.substring(0, 8) ?? 'unknown'}, closed at ${mostRecent.cycle?.closedAt?.toISOString() ?? 'null'}`,
    );

    // Check if this participation rolled over to another participation
    // Only count rollovers that were actually executed (OPTED_IN, AWAITING_PAYOUT, COMPLETED)
    // Exclude AWAITING_INVESTMENT (rollover was created but never executed)
    const childRollover = await this.prisma.cycleParticipation.findFirst({
      where: {
        userId,
        rolloverFromParticipationId: mostRecent.id,
        status: {
          in: [
            'OPTED_IN',
            'AWAITING_PAYOUT',
            'COMPLETED',
            'AWAITING_VALIDATION',
          ],
        },
      },
    });

    const hasChildRollover = Boolean(childRollover);
    this.logger.debug(
      `[determineMaxParticipation] Child rollover check: ${hasChildRollover ? `YES (${childRollover!.id.substring(0, 8)}, status=${childRollover!.status})` : 'NO'} → ${hasChildRollover ? '20B' : '10B'} cap`,
    );

    return hasChildRollover ? 20_000_000_000 : 10_000_000_000;
  }

  /**
   * Create a participation (opt-in to a future cycle)
   */
  async createParticipation(input: {
    cycleId: string;
    characterName?: string;
    amountIsk: string;
    userId?: string;
    rollover?: {
      type: 'FULL_PAYOUT' | 'INITIAL_ONLY' | 'CUSTOM_AMOUNT';
      customAmountIsk?: string;
    };
  }) {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: input.cycleId },
    });
    if (!cycle) throw new Error('Cycle not found');
    if (cycle.status !== 'PLANNED') {
      throw new Error('Opt-in only allowed for planned cycles');
    }

    let characterName = input.characterName;
    if (!characterName) {
      const anyChar = await this.characterService.getAnyCharacterName();
      characterName = anyChar ?? 'Unknown';
    }

    // Check for existing participation
    const existing = await this.prisma.cycleParticipation.findFirst({
      where: {
        cycleId: input.cycleId,
        userId: input.userId ?? null,
      },
    });
    if (existing) return existing;

    // Validate participation cap
    const requestedAmount = Number(input.amountIsk);

    // For rollover participations, cap is always 20B
    // For regular participations, use determineMaxParticipation (10B or 20B based on history)
    let maxParticipation: number;
    if (input.rollover) {
      maxParticipation = 20_000_000_000; // 20B cap for rollover investors
    } else {
      maxParticipation = await this.determineMaxParticipation(input.userId);
    }

    if (requestedAmount > maxParticipation) {
      const maxB = maxParticipation / 1_000_000_000;
      throw new Error(
        `Participation amount exceeds maximum allowed (${maxB}B ISK)`,
      );
    }

    // Handle rollover opt-in
    if (input.rollover) {
      // Find user's active participation in the current OPEN cycle
      const openCycle = await this.prisma.cycle.findFirst({
        where: { status: 'OPEN' },
        include: {
          participations: {
            where: {
              userId: input.userId ?? null,
              status: { in: ['OPTED_IN', 'AWAITING_PAYOUT'] },
            },
          },
        },
      });

      if (!openCycle || openCycle.participations.length === 0) {
        throw new Error(
          'Rollover requires an active participation in the current OPEN cycle',
        );
      }

      const activeParticipation = openCycle.participations[0];

      // Validate custom amount
      if (input.rollover.type === 'CUSTOM_AMOUNT') {
        if (!input.rollover.customAmountIsk) {
          throw new Error('Custom amount required for CUSTOM_AMOUNT rollover');
        }
        const customAmount = Number(input.rollover.customAmountIsk);
        const initialAmount = Number(activeParticipation.amountIsk);
        if (customAmount > initialAmount) {
          throw new Error(
            'Custom rollover amount cannot exceed initial participation',
          );
        }
      }

      // Generate rollover memo: ROLLOVER-{cycleId:8}-{fromParticipationId:8}
      const rolloverMemo = `ROLLOVER-${cycle.id.substring(0, 8)}-${activeParticipation.id.substring(0, 8)}`;

      // Calculate requested rollover amount
      let rolloverRequestedAmount: string;
      if (input.rollover.type === 'FULL_PAYOUT') {
        // Will be calculated on cycle close, store as 0 for now
        rolloverRequestedAmount = '0.00';
      } else if (input.rollover.type === 'INITIAL_ONLY') {
        rolloverRequestedAmount = String(activeParticipation.amountIsk);
      } else {
        // CUSTOM_AMOUNT
        rolloverRequestedAmount = input.rollover.customAmountIsk!;
      }

      return await this.prisma.cycleParticipation.create({
        data: {
          cycleId: input.cycleId,
          userId: input.userId, // Already set to testUserId in controller if provided
          characterName,
          amountIsk: requestedAmount.toFixed(2),
          memo: rolloverMemo,
          status: 'AWAITING_INVESTMENT', // Will be auto-validated on cycle close
          rolloverType: input.rollover.type,
          rolloverRequestedAmountIsk: rolloverRequestedAmount,
          rolloverFromParticipationId: activeParticipation.id,
        },
      });
    }

    // Non-rollover participation
    // Generate unique memo: ARB-{cycleId:8}-{userId:8}
    const userIdForMemo = input.userId || 'unknown';
    const uniqueMemo = `ARB-${cycle.id.substring(0, 8)}-${String(userIdForMemo).substring(0, 8)}`;

    return await this.prisma.cycleParticipation.create({
      data: {
        cycleId: input.cycleId,
        userId: input.userId,
        characterName,
        amountIsk: input.amountIsk,
        memo: uniqueMemo,
        status: 'AWAITING_INVESTMENT',
      },
    });
  }

  /**
   * List participations for a cycle
   */
  async listParticipations(cycleId: string, status?: string) {
    const validStatuses: ParticipationStatus[] = [
      'AWAITING_INVESTMENT',
      'AWAITING_VALIDATION',
      'OPTED_IN',
      'OPTED_OUT',
      'AWAITING_PAYOUT',
      'COMPLETED',
      'REFUNDED',
    ];
    const where: Prisma.CycleParticipationWhereInput = {
      cycleId,
      ...(status && validStatuses.includes(status as ParticipationStatus)
        ? { status: status as ParticipationStatus }
        : {}),
    };
    return await this.prisma.cycleParticipation.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Opt out of a participation
   * Can opt-out of PLANNED cycles (including rollover participations)
   * Cannot opt-out once cycle is OPEN
   */
  async optOutParticipation(participationId: string) {
    const p = await this.prisma.cycleParticipation.findUnique({
      where: { id: participationId },
      include: { cycle: true },
    });
    if (!p) throw new Error('Participation not found');

    const cycle = p.cycle as { status: string; startedAt: Date };

    // Allow opt-out for PLANNED cycles only
    if (cycle.status !== 'PLANNED') {
      throw new Error('Can only opt-out of PLANNED cycles');
    }

    // If still awaiting investment (includes rollover participations), delete
    if (p.status === 'AWAITING_INVESTMENT') {
      return await this.prisma.cycleParticipation.delete({
        where: { id: participationId },
      });
    }

    // If payment received, mark for refund
    if (p.status === 'OPTED_IN') {
      return await this.prisma.cycleParticipation.update({
        where: { id: participationId },
        data: { status: 'OPTED_OUT', optedOutAt: new Date() },
      });
    }

    throw new Error('Invalid participation status for opt-out');
  }

  /**
   * Admin validate payment for a participation
   */
  async adminValidatePayment(
    participationId: string,
    walletJournal: { characterId: number; journalId: bigint } | null,
    appendEntryFn: (entry: {
      cycleId: string;
      entryType: string;
      amountIsk: string;
      memo: string;
      participationId: string;
      planCommitId: null;
    }) => Promise<unknown>,
  ) {
    const p = await this.prisma.cycleParticipation.findUnique({
      where: { id: participationId },
    });
    if (!p) throw new Error('Participation not found');
    if (p.status === 'OPTED_IN' && p.validatedAt) return p;

    const updated = await this.prisma.cycleParticipation.update({
      where: { id: participationId },
      data: {
        status: 'OPTED_IN',
        validatedAt: new Date(),
        walletJournalId: walletJournal?.journalId ?? null,
      },
    });

    // Create deposit ledger entry
    await appendEntryFn({
      cycleId: updated.cycleId,
      entryType: 'deposit',
      amountIsk: String(updated.amountIsk),
      memo: `Participation deposit ${updated.characterName}`,
      participationId: updated.id,
      planCommitId: null,
    });

    return updated;
  }

  /**
   * Mark refund for a participation
   */
  async adminMarkRefund(input: { participationId: string; amountIsk: string }) {
    return await this.prisma.cycleParticipation.update({
      where: { id: input.participationId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        amountIsk: input.amountIsk,
      },
    });
  }

  /**
   * Get all participations
   */
  async getAllParticipations() {
    return await this.prisma.cycleParticipation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        cycle: { select: { name: true, startedAt: true, closedAt: true } },
      },
    });
  }

  /**
   * Get participation history for a specific user across all cycles
   */
  async getUserParticipationHistory(userId: string) {
    return await this.prisma.cycleParticipation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            startedAt: true,
            closedAt: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Get participation for a user in a cycle
   */
  async getMyParticipation(cycleId: string, userId: string) {
    return await this.prisma.cycleParticipation.findFirst({
      where: { cycleId, userId },
    });
  }

  /**
   * Mark payout as sent
   */
  async markPayoutAsSent(participationId: string) {
    return await this.prisma.cycleParticipation.update({
      where: { id: participationId },
      data: { status: 'COMPLETED', payoutPaidAt: new Date() },
    });
  }
}
