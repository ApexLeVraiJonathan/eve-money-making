import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { CharacterService } from '@api/characters/services/character.service';
import { NotificationService } from '@api/notifications/notification.service';
import { AppConfig } from '@api/common/config';
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
    private readonly notifications: NotificationService,
  ) {}

  private static readonly DEFAULT_PRINCIPAL_CAP_ISK = 10_000_000_000;
  private static readonly DEFAULT_MAXIMUM_CAP_ISK = 20_000_000_000;

  private async getUserDefaultCharacterName(
    userId: string,
  ): Promise<string | null> {
    const rec = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        primaryCharacter: { select: { name: true } },
        characters: {
          select: { name: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    const primary = rec?.primaryCharacter?.name?.trim();
    if (primary) return primary;
    const anyLinked = rec?.characters?.[0]?.name?.trim();
    return anyLinked || null;
  }

  /**
   * Fixes a known historical bug where auto-rollover participations were created
   * without a characterName and got a global fallback (some unrelated character).
   *
   * We repair only rollover-linked participations by copying the source
   * participation's characterName (since it represents the user's actual payer).
   */
  private async maybeRepairRolloverCharacterName(p: {
    id: string;
    userId: string | null;
    rolloverFromParticipationId: string | null;
    rolloverType: string | null;
    memo: string;
    characterName: string;
    rolloverFromParticipation?: { characterName: string } | null;
  }): Promise<string> {
    if (!p.userId) return p.characterName;
    if (!p.rolloverFromParticipationId) return p.characterName;

    const isRollover =
      p.memo?.startsWith('ROLLOVER-') || p.rolloverType != null;
    if (!isRollover) return p.characterName;

    const sourceName = p.rolloverFromParticipation?.characterName?.trim();
    if (!sourceName) return p.characterName;

    if ((p.characterName ?? '').trim() === sourceName) return sourceName;

    // Best-effort repair; do not block the request if update fails.
    try {
      await this.prisma.cycleParticipation.update({
        where: { id: p.id },
        data: { characterName: sourceName },
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[maybeRepairRolloverCharacterName] Failed to repair participation ${p.id.substring(
          0,
          8,
        )}: ${String(err)}`,
      );
    }

    return sourceName;
  }

  private async getUserTradecraftCaps(userId: string): Promise<{
    principalCapIsk: number;
    maximumCapIsk: number;
  }> {
    const rec = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        tradecraftPrincipalCapIsk: true,
        tradecraftMaximumCapIsk: true,
      },
    });

    // IMPORTANT: `Number(null) === 0`, so we must treat null/undefined explicitly
    // as "not set" and fall back to defaults.
    const principalCapIsk =
      rec?.tradecraftPrincipalCapIsk == null
        ? NaN
        : Number(rec.tradecraftPrincipalCapIsk);
    const maximumCapIsk =
      rec?.tradecraftMaximumCapIsk == null
        ? NaN
        : Number(rec.tradecraftMaximumCapIsk);

    return {
      principalCapIsk: Number.isFinite(principalCapIsk)
        ? principalCapIsk
        : ParticipationService.DEFAULT_PRINCIPAL_CAP_ISK,
      maximumCapIsk: Number.isFinite(maximumCapIsk)
        ? maximumCapIsk
        : ParticipationService.DEFAULT_MAXIMUM_CAP_ISK,
    };
  }

  private async getEffectivePrincipalCapForUser(
    userId: string,
    principalCapIsk: number,
  ): Promise<number> {
    // Existing behavior: active admin-funded JingleYield principal consumes headroom.
    const activeJyPrograms = await this.prisma.jingleYieldProgram.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        lockedPrincipalIsk: true,
      },
    });

    if (activeJyPrograms.length === 0) return principalCapIsk;

    const totalJyPrincipal = activeJyPrograms.reduce(
      (sum, p) => sum + Number(p.lockedPrincipalIsk),
      0,
    );
    return Math.max(0, principalCapIsk - totalJyPrincipal);
  }

  async getTradecraftCapsForUser(userId?: string): Promise<{
    principalCapIsk: number;
    maximumCapIsk: number;
    effectivePrincipalCapIsk: number;
  }> {
    if (!userId) {
      return {
        principalCapIsk: ParticipationService.DEFAULT_PRINCIPAL_CAP_ISK,
        maximumCapIsk: ParticipationService.DEFAULT_MAXIMUM_CAP_ISK,
        effectivePrincipalCapIsk:
          ParticipationService.DEFAULT_PRINCIPAL_CAP_ISK,
      };
    }

    const caps = await this.getUserTradecraftCaps(userId);
    const effectivePrincipalCapIsk = await this.getEffectivePrincipalCapForUser(
      userId,
      caps.principalCapIsk,
    );
    return { ...caps, effectivePrincipalCapIsk };
  }

  /**
   * Admin-only: create a standard (non-rollover) participation for a cycle that
   * is already OPEN, targeting a user by their primary character ID.
   *
   * This exists because the public opt-in flow intentionally only allows PLANNED cycles.
   */
  async adminCreateParticipationForOpenCycleByPrimaryCharacterId(input: {
    cycleId: string;
    primaryCharacterId: number;
    amountIsk: string;
    markPaid?: boolean;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { primaryCharacterId: input.primaryCharacterId },
      select: {
        id: true,
        primaryCharacter: { select: { name: true } },
      },
    });
    if (!user) {
      throw new BadRequestException(
        'No user found for that primary character ID',
      );
    }

    const primaryName = user.primaryCharacter?.name?.trim() || undefined;
    return await this.adminCreateParticipationForOpenCycle({
      cycleId: input.cycleId,
      userId: user.id,
      amountIsk: input.amountIsk,
      characterName: primaryName,
      markPaid: input.markPaid,
    });
  }

  /**
   * Admin-only: create a standard (non-rollover) participation for an OPEN cycle.
   * Reuses the same cap validation rules as user opt-in, but without the PLANNED-cycle restriction.
   */
  async adminCreateParticipationForOpenCycle(input: {
    cycleId: string;
    userId: string;
    amountIsk: string;
    characterName?: string;
    markPaid?: boolean;
  }) {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: input.cycleId },
    });
    if (!cycle) throw new BadRequestException('Cycle not found');
    if (cycle.status !== 'OPEN') {
      throw new BadRequestException(
        'Admin manual participation is only allowed for OPEN cycles',
      );
    }

    const existing = await this.prisma.cycleParticipation.findFirst({
      where: {
        cycleId: input.cycleId,
        userId: input.userId,
      },
    });
    if (existing) return existing;

    const requestedAmount = Number(input.amountIsk);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException('Invalid participation amount');
    }

    const caps = await this.getUserTradecraftCaps(input.userId);
    const maximumCapIsk = caps.maximumCapIsk;
    const principalCapIsk = await this.getEffectivePrincipalCapForUser(
      input.userId,
      caps.principalCapIsk,
    );

    if (requestedAmount > maximumCapIsk) {
      throw new BadRequestException(
        `Participation amount exceeds maximum allowed (${(
          maximumCapIsk / 1_000_000_000
        ).toFixed(0)}B ISK)`,
      );
    }
    if (requestedAmount > principalCapIsk) {
      throw new BadRequestException(
        `Participation principal exceeds maximum allowed (${(
          principalCapIsk / 1_000_000_000
        ).toFixed(0)}B ISK)`,
      );
    }

    let characterName = input.characterName?.trim() || undefined;
    if (!characterName) {
      characterName =
        (await this.getUserDefaultCharacterName(input.userId)) ?? undefined;
    }
    if (!characterName) {
      const anyChar = await this.characterService.getAnyCharacterName();
      characterName = anyChar ?? 'Unknown';
    }

    const uniqueMemo = `ARB-${cycle.id.substring(0, 8)}-${input.userId.substring(
      0,
      8,
    )}`;
    return await this.prisma.$transaction(async (tx) => {
      const shouldMarkPaid = input.markPaid !== false;
      const occurredAt = new Date();

      const created = await tx.cycleParticipation.create({
        data: {
          cycleId: input.cycleId,
          userId: input.userId,
          characterName,
          amountIsk: Number(requestedAmount).toFixed(2),
          userPrincipalIsk: Number(requestedAmount).toFixed(2),
          memo: uniqueMemo,
          status: shouldMarkPaid ? 'OPTED_IN' : 'AWAITING_INVESTMENT',
          validatedAt: shouldMarkPaid ? occurredAt : null,
        },
      });

      if (shouldMarkPaid) {
        // Create a matching deposit entry (no wallet journal link).
        await tx.cycleLedgerEntry.create({
          data: {
            cycleId: input.cycleId,
            entryType: 'deposit',
            amount: Number(requestedAmount).toFixed(2),
            occurredAt,
            memo: `Participation deposit ${created.characterName}`,
            participationId: created.id,
          },
        });

        // Keep ROI/profit baselines consistent by increasing the cycle's initial capital
        // only once the participation is actually considered paid/confirmed.
        const current = await tx.cycle.findUnique({
          where: { id: input.cycleId },
          select: { initialCapitalIsk: true },
        });
        const cur = current?.initialCapitalIsk
          ? Number(current.initialCapitalIsk)
          : 0;
        const next = cur + requestedAmount;
        await tx.cycle.update({
          where: { id: input.cycleId },
          data: { initialCapitalIsk: next.toFixed(2) },
        });
      }

      return created;
    });
  }

  /**
   * Determine maximum allowed participation for a user (history-based, ignores admin overrides).
   * Returns 10B for first-time or users who fully cashed out
   * Returns 20B for users with active rollover history
   */
  async determineMaxParticipationFromHistory(userId?: string): Promise<number> {
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
   * Determine maximum allowed participation for a user, including optional admin override.
   *
   * Legacy: this function now returns the user's **maximum cap** (total invested),
   * not the principal cap. Callers should migrate to using the explicit caps.
   */
  async determineMaxParticipation(userId?: string): Promise<number> {
    if (!userId) return ParticipationService.DEFAULT_MAXIMUM_CAP_ISK;
    const { maximumCapIsk } = await this.getUserTradecraftCaps(userId);
    return maximumCapIsk;
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

    // IMPORTANT:
    // - User-triggered participations should come with a characterName (from session)
    // - Auto-rollover historically created participations without characterName; we must
    //   *never* fall back to some random/global character in that case.
    //
    // Defaulting strategy:
    // - If provided explicitly → use it
    // - If rollover → use the user's active/open-cycle participation characterName
    // - Else if userId → use user's primary (or most recently updated) linked character
    // - Else (anonymous) → global fallback
    let characterName = input.characterName?.trim() || undefined;

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

    // New model:
    // - principal cap: max user-funded principal
    // - maximum cap: max total invested (principal + reinvested interest)
    const userId = input.userId ?? undefined;
    const caps = userId
      ? await this.getUserTradecraftCaps(userId)
      : {
          principalCapIsk: ParticipationService.DEFAULT_PRINCIPAL_CAP_ISK,
          maximumCapIsk: ParticipationService.DEFAULT_MAXIMUM_CAP_ISK,
        };

    let principalCapIsk = caps.principalCapIsk;
    const maximumCapIsk = caps.maximumCapIsk;

    if (userId) {
      principalCapIsk = await this.getEffectivePrincipalCapForUser(
        userId,
        principalCapIsk,
      );
    }

    // For rollover participations, requestedAmount is typically a placeholder or
    // a reinvestment amount. We still enforce the maximum cap to keep pooled
    // capital manageable, but we do not treat rollovers as new user principal.
    if (requestedAmount > maximumCapIsk) {
      throw new BadRequestException(
        `Participation amount exceeds maximum allowed (${(
          maximumCapIsk / 1_000_000_000
        ).toFixed(0)}B ISK)`,
      );
    }

    if (!input.rollover) {
      // Non-rollover: requested amount is user-funded principal.
      if (requestedAmount > principalCapIsk) {
        throw new BadRequestException(
          `Participation principal exceeds maximum allowed (${(
            principalCapIsk / 1_000_000_000
          ).toFixed(0)}B ISK)`,
        );
      }
    }

    // For rollover participations, cap logic is enforced during rollover processing
    // (max cap), and principal additions are enforced by increaseParticipation.

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
      // If caller didn't provide a characterName (common for auto-rollover),
      // derive it from the source participation instead of using a global fallback.
      if (!characterName) {
        characterName = activeParticipation.characterName?.trim() || undefined;
      }
      if (!characterName && input.userId) {
        characterName =
          (await this.getUserDefaultCharacterName(input.userId)) ?? undefined;
      }
      if (!characterName) {
        const anyChar = await this.characterService.getAnyCharacterName();
        characterName = anyChar ?? 'Unknown';
      }

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

      // Generate rollover memo: ROLLOVER-{cycleId:8}-{fromParticipationId:8}-{TYPE}
      const rolloverTypeShort =
        input.rollover.type === 'FULL_PAYOUT'
          ? 'FULL'
          : input.rollover.type === 'INITIAL_ONLY'
            ? 'INITIAL'
            : 'CUSTOM';
      const rolloverMemo = `ROLLOVER-${cycle.id.substring(0, 8)}-${activeParticipation.id.substring(0, 8)}-${rolloverTypeShort}`;

      // Calculate requested rollover amount and display amount
      let rolloverRequestedAmount: string;
      let displayAmount: number; // Amount to show in the participation record

      if (input.rollover.type === 'FULL_PAYOUT') {
        const initialAmount = Number(activeParticipation.amountIsk);
        // Store the previous-cycle principal in rolloverRequestedAmountIsk so
        // the frontend can display a meaningful current amount, while keeping
        // amountIsk as a small placeholder that will be replaced on rollover.
        rolloverRequestedAmount = initialAmount.toFixed(2);
        displayAmount = 1; // Placeholder that frontend will recognize
      } else if (input.rollover.type === 'INITIAL_ONLY') {
        const initialAmount = Number(activeParticipation.amountIsk);
        rolloverRequestedAmount = String(initialAmount);
        displayAmount = initialAmount;
      } else {
        // CUSTOM_AMOUNT
        const customAmount = Number(input.rollover.customAmountIsk!);
        rolloverRequestedAmount = input.rollover.customAmountIsk!;
        displayAmount = customAmount;
      }

      return await this.prisma.cycleParticipation.create({
        data: {
          cycleId: input.cycleId,
          userId: input.userId, // Already set to testUserId in controller if provided
          characterName,
          amountIsk: displayAmount.toFixed(2),
          userPrincipalIsk: (() => {
            const basePrincipal = Number(
              activeParticipation.userPrincipalIsk ??
                activeParticipation.amountIsk,
            );
            // For full payout / initial only rollovers, principal carries forward unchanged.
            return Number.isFinite(basePrincipal)
              ? basePrincipal.toFixed(2)
              : '0.00';
          })(),
          memo: rolloverMemo,
          status: 'AWAITING_INVESTMENT', // Will be auto-validated on cycle close
          rolloverType: input.rollover.type,
          rolloverRequestedAmountIsk: rolloverRequestedAmount,
          rolloverFromParticipationId: activeParticipation.id,
        },
      });
    }

    // Non-rollover participation
    if (!characterName && input.userId) {
      characterName =
        (await this.getUserDefaultCharacterName(input.userId)) ?? undefined;
    }
    if (!characterName) {
      const anyChar = await this.characterService.getAnyCharacterName();
      characterName = anyChar ?? 'Unknown';
    }

    // Generate unique memo: ARB-{cycleId:8}-{userId:8}
    const userIdForMemo = input.userId || 'unknown';
    const uniqueMemo = `ARB-${cycle.id.substring(0, 8)}-${String(userIdForMemo).substring(0, 8)}`;

    return await this.prisma.cycleParticipation.create({
      data: {
        cycleId: input.cycleId,
        userId: input.userId,
        characterName,
        amountIsk: input.amountIsk,
        userPrincipalIsk: Number(input.amountIsk).toFixed(2),
        memo: uniqueMemo,
        status: 'AWAITING_INVESTMENT',
      },
    });
  }

  /**
   * Increase principal for an existing participation while the cycle is PLANNED.
   * Users can only increase (never decrease) their amount, and the final amount
   * must still respect participation caps (10B/20B + JingleYield adjustments).
   */
  async increaseParticipation(input: {
    participationId: string;
    userId: string;
    deltaAmountIsk: string;
  }): Promise<{
    participation: Prisma.CycleParticipationGetPayload<{
      include: { cycle: true };
    }>;
    previousAmountIsk: string;
    deltaAmountIsk: string;
    newAmountIsk: string;
  }> {
    const participation = await this.prisma.cycleParticipation.findUnique({
      where: { id: input.participationId },
      include: {
        cycle: true,
        rolloverFromParticipation: true,
      },
    });

    if (!participation) {
      throw new BadRequestException('Participation not found');
    }

    if (!participation.userId || participation.userId !== input.userId) {
      throw new BadRequestException(
        'You are not allowed to modify this participation',
      );
    }

    if (!participation.cycle) {
      throw new BadRequestException('Participation cycle not found');
    }

    if (participation.cycle.status !== 'PLANNED') {
      throw new BadRequestException(
        'Participation can only be increased while the cycle is PLANNED',
      );
    }

    const delta = Number(input.deltaAmountIsk);
    if (!Number.isFinite(delta) || delta <= 0) {
      throw new BadRequestException(
        'Increase amount must be a positive number',
      );
    }

    const currentAmountRaw = Number(participation.amountIsk);
    const currentUserPrincipalRaw = Number(
      participation.userPrincipalIsk ??
        (participation.jingleYieldProgramId ? 0 : participation.amountIsk),
    );

    // For non-rollover participations, "current amount" is simply the stored amount.
    // For FULL_PAYOUT rollovers, we treat amountIsk as:
    //   - 1.00 ISK baseline placeholder (no user extra yet)
    //   - 1.00 + extra ISK after one or more increases
    // and use the *previous cycle principal* from rolloverFromParticipation as the
    // base principal for cap checks. This lets us enforce the 10B principal cap
    // while still keeping the existing placeholder semantics.
    const requestedTotal = currentAmountRaw + delta;
    const requestedUserPrincipal = currentUserPrincipalRaw + delta;
    const userId = participation.userId ?? undefined;
    const caps = userId
      ? await this.getUserTradecraftCaps(userId)
      : {
          principalCapIsk: ParticipationService.DEFAULT_PRINCIPAL_CAP_ISK,
          maximumCapIsk: ParticipationService.DEFAULT_MAXIMUM_CAP_ISK,
        };

    let principalCapIsk = caps.principalCapIsk;
    const maximumCapIsk = caps.maximumCapIsk;

    if (userId) {
      principalCapIsk = await this.getEffectivePrincipalCapForUser(
        userId,
        principalCapIsk,
      );
    }

    // Block principal additions once user is at/above maximum cap.
    if (currentAmountRaw >= maximumCapIsk) {
      throw new BadRequestException(
        `Participation is already at the maximum cap (${(
          maximumCapIsk / 1_000_000_000
        ).toFixed(0)}B ISK)`,
      );
    }
    if (requestedTotal > maximumCapIsk) {
      throw new BadRequestException(
        `Participation amount exceeds maximum allowed (${(
          maximumCapIsk / 1_000_000_000
        ).toFixed(0)}B ISK)`,
      );
    }
    if (requestedUserPrincipal > principalCapIsk) {
      throw new BadRequestException(
        `Participation principal exceeds maximum allowed (${(
          principalCapIsk / 1_000_000_000
        ).toFixed(0)}B ISK)`,
      );
    }

    const updated = await this.prisma.cycleParticipation.update({
      where: { id: participation.id },
      data: {
        amountIsk: requestedTotal.toFixed(2),
        userPrincipalIsk: requestedUserPrincipal.toFixed(2),
        status: 'AWAITING_INVESTMENT',
        // Force a fresh validation for the new total; deposits already made
        // remain tracked via cycle_ledger entries.
        validatedAt: null,
      },
      include: { cycle: true },
    });

    return {
      participation: updated,
      previousAmountIsk: (() => {
        return currentAmountRaw.toFixed(2);
      })(),
      deltaAmountIsk: delta.toFixed(2),
      newAmountIsk: requestedTotal.toFixed(2),
    };
  }

  /**
   * Admin-only: create a JingleYield participation and program for a user.
   *
   * This seeds a 2B ISK admin-funded principal in a PLANNED cycle and
   * links it to a JingleYieldProgram so that subsequent rollovers can
   * enforce the locked-capital rules.
   */
  async createJingleYieldParticipation(input: {
    userId: string;
    cycleId: string;
    adminCharacterId: number;
    characterName: string;
    principalIsk?: string;
    minCycles?: number;
  }) {
    const env = AppConfig.env();
    this.logger.log(
      `[createJingleYieldParticipation] userId=${input.userId}, cycleId=${input.cycleId}, adminCharacterId=${input.adminCharacterId}, env=${env}`,
    );

    const cycle = await this.prisma.cycle.findUnique({
      where: { id: input.cycleId },
    });
    if (!cycle) {
      throw new Error('Cycle not found');
    }
    if (cycle.status !== 'PLANNED') {
      throw new Error(
        'JingleYield participation can only be created in a PLANNED cycle',
      );
    }

    // Enforce single active participation per user: they must fully cash out first.
    const activeStatuses: ParticipationStatus[] = [
      'AWAITING_INVESTMENT',
      'AWAITING_VALIDATION',
      'OPTED_IN',
      'AWAITING_PAYOUT',
    ];
    const existingActive = await this.prisma.cycleParticipation.findFirst({
      where: {
        userId: input.userId,
        status: { in: activeStatuses },
      },
    });
    if (existingActive) {
      this.logger.warn(
        `[createJingleYieldParticipation] User ${input.userId} still has active participation ${existingActive.id}`,
      );
      throw new Error(
        'User still has an active participation and must fully cash out before JingleYield can be created',
      );
    }

    // Seeded principal (admin-funded) as Decimal string
    const rawPrincipal =
      input.principalIsk && input.principalIsk.trim().length > 0
        ? input.principalIsk
        : '2000000000.00';
    const principalNum = Number(rawPrincipal);
    if (!Number.isFinite(principalNum) || principalNum <= 0) {
      throw new Error('Invalid JingleYield principal amount');
    }
    // Hard cap: admin principal must never exceed 10B
    if (principalNum > 10_000_000_000) {
      throw new Error(
        'JingleYield principal exceeds maximum allowed (10B ISK)',
      );
    }
    const principalIsk = principalNum.toFixed(2);

    const minCycles =
      input.minCycles && input.minCycles > 0 ? input.minCycles : 12;

    return await this.prisma.$transaction(async (tx) => {
      // Create root participation for the planned cycle
      const participation = await tx.cycleParticipation.create({
        data: {
          cycleId: input.cycleId,
          userId: input.userId,
          characterName: input.characterName,
          amountIsk: principalIsk,
          userPrincipalIsk: '0.00',
          memo: `JY-${cycle.id.substring(0, 8)}-${input.userId.substring(0, 8)}`,
          status: 'AWAITING_INVESTMENT',
        },
      });

      // Create JingleYield program linked to this participation and admin character
      const program = await tx.jingleYieldProgram.create({
        data: {
          userId: input.userId,
          adminCharacterId: input.adminCharacterId,
          rootParticipationId: participation.id,
          status: 'ACTIVE',
          lockedPrincipalIsk: principalIsk,
          cumulativeInterestIsk: '0.00',
          targetInterestIsk: principalIsk,
          startCycleId: input.cycleId,
          minCycles,
        },
      });

      // Back-link participation to the JY program
      const updatedParticipation = await tx.cycleParticipation.update({
        where: { id: participation.id },
        data: {
          jingleYieldProgramId: program.id,
        },
      });

      return {
        participation: updatedParticipation,
        program,
      };
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
    const rows = await this.prisma.cycleParticipation.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        rolloverFromParticipation: {
          select: { characterName: true },
        },
      },
    });
    // Best-effort auto-heal of the rollover characterName bug.
    return await Promise.all(
      rows.map(async (p) => {
        const fixed = await this.maybeRepairRolloverCharacterName({
          id: p.id,
          userId: p.userId,
          rolloverFromParticipationId: p.rolloverFromParticipationId ?? null,
          rolloverType: p.rolloverType ?? null,
          memo: p.memo,
          characterName: p.characterName,
          rolloverFromParticipation: p.rolloverFromParticipation,
        });
        const { rolloverFromParticipation: _rfp, ...rest } = p;
        return fixed === p.characterName
          ? rest
          : { ...rest, characterName: fixed };
      }),
    );
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

    // Compute how much was already deposited for this participation so that
    // top-ups only record the additional amount as a new deposit entry.
    const existingDeposits = await this.prisma.cycleLedgerEntry.aggregate({
      where: {
        participationId: updated.id,
        entryType: 'deposit',
      },
      _sum: {
        amount: true,
      },
    });

    const alreadyPaid =
      existingDeposits._sum.amount != null
        ? Number(existingDeposits._sum.amount)
        : 0;
    const fullAmount = Number(updated.amountIsk);
    const deltaAmount = fullAmount - alreadyPaid;

    if (deltaAmount <= 0) {
      this.logger.log(
        `[adminValidatePayment] No additional deposit needed for participation ${updated.id.substring(
          0,
          8,
        )} (alreadyPaid=${alreadyPaid.toFixed(
          2,
        )}, newAmount=${fullAmount.toFixed(2)})`,
      );
      return updated;
    }

    // Create deposit ledger entry only for the new delta amount.
    await appendEntryFn({
      cycleId: updated.cycleId,
      entryType: 'deposit',
      amountIsk: deltaAmount.toFixed(2),
      memo: `Participation deposit ${updated.characterName}`,
      participationId: updated.id,
      planCommitId: null,
    });

    // If the cycle is already OPEN, confirmed deposits should increase the
    // cycle's initial capital baseline (used for ROI/profit metrics).
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: updated.cycleId },
      select: { status: true, initialCapitalIsk: true },
    });
    if (cycle?.status === 'OPEN') {
      const cur = cycle.initialCapitalIsk ? Number(cycle.initialCapitalIsk) : 0;
      const next = cur + deltaAmount;
      await this.prisma.cycle.update({
        where: { id: updated.cycleId },
        data: { initialCapitalIsk: next.toFixed(2) },
      });
    }

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
    const p = await this.prisma.cycleParticipation.findFirst({
      where: { cycleId, userId },
      include: {
        rolloverFromParticipation: {
          select: { characterName: true },
        },
      },
    });
    if (!p) return null;

    const fixed = await this.maybeRepairRolloverCharacterName({
      id: p.id,
      userId: p.userId,
      rolloverFromParticipationId: p.rolloverFromParticipationId ?? null,
      rolloverType: p.rolloverType ?? null,
      memo: p.memo,
      characterName: p.characterName,
      rolloverFromParticipation: p.rolloverFromParticipation,
    });
    const { rolloverFromParticipation: _rfp, ...rest } = p;
    return fixed === p.characterName ? rest : { ...rest, characterName: fixed };
  }

  /**
   * Mark payout as sent
   */
  async markPayoutAsSent(participationId: string) {
    const participation = await this.prisma.cycleParticipation.update({
      where: { id: participationId },
      data: { status: 'COMPLETED', payoutPaidAt: new Date() },
    });
    void this.notifications
      .notifyPayoutSent(participation.id)
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to send payout notification for participation ${participation.id}: ${String(
            err,
          )}`,
        ),
      );
    return participation;
  }
}
