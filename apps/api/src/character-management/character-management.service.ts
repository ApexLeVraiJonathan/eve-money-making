import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EsiCharactersService } from '../esi/esi-characters.service';

@Injectable()
export class CharacterManagementService {
  private readonly logger = new Logger(CharacterManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly esiChars: EsiCharactersService,
  ) {}

  async getMyCharacters(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        primaryCharacterId: true,
        characters: {
          select: {
            id: true,
            name: true,
            ownerHash: true,
            role: true,
            function: true,
            location: true,
            managedBy: true,
            eveAccountId: true,
            token: {
              select: {
                accessTokenExpiresAt: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!user) return [];

    const now = new Date();

    return user.characters.map((c) => {
      const expiresAt = c.token?.accessTokenExpiresAt ?? null;
      let tokenStatus: 'missing' | 'valid' | 'expired' = 'missing';
      if (expiresAt) {
        tokenStatus = expiresAt > now ? 'valid' : 'expired';
      }

      return {
        id: c.id,
        name: c.name,
        ownerHash: c.ownerHash,
        role: c.role,
        function: c.function,
        location: c.location,
        managedBy: c.managedBy,
        isPrimary: user.primaryCharacterId === c.id,
        tokenStatus,
        tokenExpiresAt: expiresAt?.toISOString() ?? null,
        eveAccountId: c.eveAccountId,
      };
    });
  }

  async setMyPrimaryCharacter(userId: string, characterId: number) {
    if (!Number.isInteger(characterId) || characterId <= 0) {
      throw new BadRequestException('Invalid characterId');
    }

    const owned = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });

    if (!owned) {
      throw new ForbiddenException('Character does not belong to current user');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { primaryCharacterId: characterId },
    });

    return { ok: true as const, primaryCharacterId: characterId };
  }

  async getMyAccounts(userId: string) {
    const [accounts, characters] = await Promise.all([
      this.prisma.eveAccount.findMany({
        where: { userId },
        include: {
          subscriptions: {
            orderBy: { expiresAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.eveCharacter.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          role: true,
          function: true,
          location: true,
          managedBy: true,
          eveAccountId: true,
          token: {
            select: {
              accessTokenExpiresAt: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const now = new Date();

    const accountsOut = accounts.map((account) => {
      const chars = characters.filter((c) => c.eveAccountId === account.id);

      const subs = account.subscriptions;
      const activeSub =
        subs.find((s) => s.isActive && s.expiresAt > now) ?? subs[0] ?? null;

      let plexStatus: 'none' | 'active' | 'expired' | 'upcoming' = 'none';
      let daysRemaining: number | null = null;

      if (activeSub) {
        const diffMs = activeSub.expiresAt.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffMs >= 0) {
          plexStatus = daysRemaining <= 3 ? 'upcoming' : 'active';
        } else {
          plexStatus = 'expired';
        }
      }

      return {
        id: account.id,
        label: account.label,
        notes: account.notes,
        plex: activeSub
          ? {
              subscriptionId: activeSub.id,
              type: activeSub.type,
              startsAt: activeSub.startsAt?.toISOString() ?? null,
              expiresAt: activeSub.expiresAt.toISOString(),
              renewalCycleDays: activeSub.renewalCycleDays,
              expectedCostIsk: activeSub.expectedCostIsk?.toString() ?? null,
              isActive: activeSub.isActive,
              status: plexStatus,
              daysRemaining,
            }
          : null,
        characters: chars.map((c) => {
          const expiresAt = c.token?.accessTokenExpiresAt ?? null;
          let tokenStatus: 'missing' | 'valid' | 'expired' = 'missing';
          if (expiresAt) {
            tokenStatus = expiresAt > now ? 'valid' : 'expired';
          }

          return {
            id: c.id,
            name: c.name,
            role: c.role,
            function: c.function,
            location: c.location,
            managedBy: c.managedBy,
            tokenStatus,
            tokenExpiresAt: expiresAt?.toISOString() ?? null,
          };
        }),
      };
    });

    const unassignedCharacters = characters
      .filter((c) => c.eveAccountId == null)
      .map((c) => {
        const expiresAt = c.token?.accessTokenExpiresAt ?? null;
        let tokenStatus: 'missing' | 'valid' | 'expired' = 'missing';
        if (expiresAt) {
          tokenStatus = expiresAt > now ? 'valid' : 'expired';
        }

        return {
          id: c.id,
          name: c.name,
          role: c.role,
          function: c.function,
          location: c.location,
          managedBy: c.managedBy,
          tokenStatus,
          tokenExpiresAt: expiresAt?.toISOString() ?? null,
        };
      });

    return { accounts: accountsOut, unassignedCharacters };
  }

  async createAccount(
    userId: string,
    input: { label?: string | null; notes?: string | null },
  ) {
    const created = await this.prisma.eveAccount.create({
      data: {
        userId,
        label: input.label ?? null,
        notes: input.notes ?? null,
      },
    });

    return {
      id: created.id,
      label: created.label,
      notes: created.notes,
    };
  }

  async assignCharacterToAccount(
    userId: string,
    accountId: string,
    characterId: number,
  ) {
    const account = await this.prisma.eveAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });

    if (!account) {
      throw new ForbiddenException('Account does not belong to current user');
    }

    const character = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });

    if (!character) {
      throw new ForbiddenException('Character does not belong to current user');
    }

    const count = await this.prisma.eveCharacter.count({
      where: { eveAccountId: accountId },
    });

    if (count >= 3) {
      throw new BadRequestException(
        'An account cannot have more than 3 characters',
      );
    }

    await this.prisma.eveCharacter.update({
      where: { id: characterId },
      data: { eveAccountId: accountId },
    });

    return { ok: true as const };
  }

  async unassignCharacterFromAccount(
    userId: string,
    accountId: string,
    characterId: number,
  ) {
    const character = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId, eveAccountId: accountId },
      select: { id: true },
    });

    if (!character) {
      throw new ForbiddenException('Character does not belong to this account');
    }

    await this.prisma.eveCharacter.update({
      where: { id: characterId },
      data: { eveAccountId: null },
    });

    return { ok: true as const };
  }

  async updateAccountMetadata(
    userId: string,
    accountId: string,
    input: { label?: string | null; notes?: string | null },
  ) {
    const account = await this.prisma.eveAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });

    if (!account) {
      throw new ForbiddenException('Account does not belong to current user');
    }

    const updated = await this.prisma.eveAccount.update({
      where: { id: accountId },
      data: {
        label: input.label ?? undefined,
        notes: input.notes ?? undefined,
      },
    });

    return {
      id: updated.id,
      label: updated.label,
      notes: updated.notes,
    };
  }

  async deleteAccount(userId: string, accountId: string) {
    const account = await this.prisma.eveAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });

    if (!account) {
      throw new ForbiddenException('Account does not belong to current user');
    }

    await this.prisma.eveAccount.delete({
      where: { id: accountId },
    });

    return { ok: true as const };
  }

  async listPlexSubscriptions(userId: string, accountId: string) {
    const account = await this.prisma.eveAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });

    if (!account) {
      throw new ForbiddenException('Account does not belong to current user');
    }

    const subs = await this.prisma.eveAccountSubscription.findMany({
      where: { eveAccountId: accountId, type: 'PLEX' },
      orderBy: { expiresAt: 'desc' },
    });

    return subs.map((s) => ({
      id: s.id,
      type: s.type,
      startsAt: s.startsAt?.toISOString() ?? null,
      expiresAt: s.expiresAt.toISOString(),
      renewalCycleDays: s.renewalCycleDays,
      expectedCostIsk: s.expectedCostIsk?.toString() ?? null,
      isActive: s.isActive,
      notes: s.notes,
    }));
  }

  async createPlexSubscription(
    userId: string,
    accountId: string,
    input: {
      startsAt?: string | null;
      expiresAt: string;
      renewalCycleDays?: number | null;
      expectedCostIsk?: string | null;
      notes?: string | null;
    },
  ) {
    const account = await this.prisma.eveAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });

    if (!account) {
      throw new ForbiddenException('Account does not belong to current user');
    }

    const expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiresAt');
    }

    const startsAt =
      input.startsAt != null ? new Date(input.startsAt) : undefined;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Invalid startsAt');
    }

    const created = await this.prisma.eveAccountSubscription.create({
      data: {
        eveAccountId: accountId,
        type: 'PLEX',
        startsAt: startsAt ?? null,
        expiresAt,
        renewalCycleDays: input.renewalCycleDays ?? null,
        expectedCostIsk: input.expectedCostIsk ?? null,
        isActive: true,
        notes: input.notes ?? null,
      },
    });

    return {
      id: created.id,
      type: created.type,
      startsAt: created.startsAt?.toISOString() ?? null,
      expiresAt: created.expiresAt.toISOString(),
      renewalCycleDays: created.renewalCycleDays,
      expectedCostIsk: created.expectedCostIsk?.toString() ?? null,
      isActive: created.isActive,
      notes: created.notes,
    };
  }

  async listMctSlots(userId: string, accountId: string) {
    const account = await this.prisma.eveAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });

    if (!account) {
      throw new ForbiddenException('Account does not belong to current user');
    }

    const slots = await this.prisma.eveAccountSubscription.findMany({
      where: { eveAccountId: accountId, type: 'MCT' },
      orderBy: { expiresAt: 'asc' },
    });

    return slots.map((s) => ({
      id: s.id,
      expiresAt: s.expiresAt.toISOString(),
      notes: s.notes,
    }));
  }

  async createMctSlot(
    userId: string,
    accountId: string,
    input: {
      expiresAt: string;
      notes?: string | null;
    },
  ) {
    const account = await this.prisma.eveAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });

    if (!account) {
      throw new ForbiddenException('Account does not belong to current user');
    }

    const activeCount = await this.prisma.eveAccountSubscription.count({
      where: { eveAccountId: accountId, type: 'MCT' },
    });

    if (activeCount >= 2) {
      throw new BadRequestException(
        'An account cannot have more than 2 MCT slots',
      );
    }

    // Interpret date-only input as midnight EVE Time (UTC)
    const iso = input.expiresAt?.trim();
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      throw new BadRequestException(
        'Invalid expiresAt format, expected YYYY-MM-DD',
      );
    }
    const [yearStr, monthStr, dayStr] = iso.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) {
      throw new BadRequestException('Invalid expiresAt date value');
    }
    const expiresAt = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

    const created = await this.prisma.eveAccountSubscription.create({
      data: {
        eveAccountId: accountId,
        type: 'MCT',
        startsAt: null,
        expiresAt,
        renewalCycleDays: null,
        expectedCostIsk: null,
        isActive: true,
        notes: input.notes ?? null,
      },
    });

    return {
      id: created.id,
      expiresAt: created.expiresAt.toISOString(),
      notes: created.notes,
    };
  }

  async deleteMctSlot(userId: string, accountId: string, slotId: string) {
    const slot = await this.prisma.eveAccountSubscription.findFirst({
      where: {
        id: slotId,
        eveAccountId: accountId,
        eveAccount: { userId },
        type: 'MCT',
      },
      select: { id: true },
    });

    if (!slot) {
      throw new ForbiddenException('MCT slot does not belong to current user');
    }

    await this.prisma.eveAccountSubscription.delete({
      where: { id: slotId },
    });

    return { ok: true as const };
  }

  async updatePlexSubscription(
    userId: string,
    accountId: string,
    subscriptionId: string,
    input: {
      startsAt?: string | null;
      expiresAt?: string | null;
      renewalCycleDays?: number | null;
      expectedCostIsk?: string | null;
      isActive?: boolean | null;
      notes?: string | null;
    },
  ) {
    const sub = await this.prisma.eveAccountSubscription.findFirst({
      where: {
        id: subscriptionId,
        eveAccountId: accountId,
        eveAccount: { userId },
      },
      select: { id: true },
    });

    if (!sub) {
      throw new ForbiddenException(
        'Subscription does not belong to current user',
      );
    }

    const data: {
      startsAt?: Date | null;
      expiresAt?: Date;
      renewalCycleDays?: number | null;
      expectedCostIsk?: string | null;
      isActive?: boolean;
      notes?: string | null;
    } = {};

    if (input.startsAt !== undefined) {
      if (input.startsAt === null) {
        data.startsAt = null;
      } else {
        const d = new Date(input.startsAt);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('Invalid startsAt');
        }
        data.startsAt = d;
      }
    }

    if (input.expiresAt !== undefined) {
      if (input.expiresAt === null) {
        throw new BadRequestException('expiresAt cannot be null');
      }
      const d = new Date(input.expiresAt);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid expiresAt');
      }
      data.expiresAt = d;
    }

    if (input.renewalCycleDays !== undefined) {
      data.renewalCycleDays = input.renewalCycleDays;
    }

    if (input.expectedCostIsk !== undefined) {
      data.expectedCostIsk = input.expectedCostIsk;
    }

    if (input.isActive !== undefined && input.isActive !== null) {
      data.isActive = input.isActive;
    }

    if (input.notes !== undefined) {
      data.notes = input.notes;
    }

    const updated = await this.prisma.eveAccountSubscription.update({
      where: { id: subscriptionId },
      data,
    });

    return {
      id: updated.id,
      type: updated.type,
      startsAt: updated.startsAt?.toISOString() ?? null,
      expiresAt: updated.expiresAt.toISOString(),
      renewalCycleDays: updated.renewalCycleDays,
      expectedCostIsk: updated.expectedCostIsk?.toString() ?? null,
      isActive: updated.isActive,
      notes: updated.notes,
    };
  }

  async deletePlexSubscription(
    userId: string,
    accountId: string,
    subscriptionId: string,
  ) {
    const sub = await this.prisma.eveAccountSubscription.findFirst({
      where: {
        id: subscriptionId,
        eveAccountId: accountId,
        eveAccount: { userId },
      },
      select: { id: true },
    });

    if (!sub) {
      throw new ForbiddenException(
        'Subscription does not belong to current user',
      );
    }

    await this.prisma.eveAccountSubscription.delete({
      where: { id: subscriptionId },
    });

    return { ok: true as const };
  }

  async listCharacterBoosters(userId: string, characterId: number) {
    const owned = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });

    if (!owned) {
      throw new ForbiddenException('Character does not belong to current user');
    }

    const boosters = await this.prisma.characterBoosterPeriod.findMany({
      where: { characterId },
      orderBy: { startsAt: 'desc' },
    });

    const now = new Date();

    return boosters.map((b) => {
      let status: 'active' | 'expired' | 'upcoming' = 'active';
      if (b.startsAt > now) status = 'upcoming';
      else if (b.expiresAt < now) status = 'expired';

      return {
        id: b.id,
        boosterName: b.boosterName,
        source: b.source,
        startsAt: b.startsAt.toISOString(),
        expiresAt: b.expiresAt.toISOString(),
        notes: b.notes,
        status,
      };
    });
  }

  async createCharacterBooster(
    userId: string,
    characterId: number,
    input: {
      boosterName: string;
      startsAt?: string | null;
      expiresAt: string;
      source?: string | null;
      notes?: string | null;
    },
  ) {
    const owned = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });

    if (!owned) {
      throw new ForbiddenException('Character does not belong to current user');
    }

    const expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiresAt');
    }

    let startsAt: Date;
    if (input.startsAt) {
      const d = new Date(input.startsAt);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid startsAt');
      }
      startsAt = d;
    } else {
      startsAt = new Date();
    }

    const created = await this.prisma.characterBoosterPeriod.create({
      data: {
        characterId,
        boosterName: input.boosterName,
        source: input.source ?? null,
        startsAt,
        expiresAt,
        notes: input.notes ?? null,
      },
    });

    return {
      id: created.id,
      boosterName: created.boosterName,
      source: created.source,
      startsAt: created.startsAt.toISOString(),
      expiresAt: created.expiresAt.toISOString(),
      notes: created.notes,
    };
  }

  async updateCharacterBooster(
    userId: string,
    characterId: number,
    boosterId: string,
    input: {
      boosterName?: string | null;
      startsAt?: string | null;
      expiresAt?: string | null;
      source?: string | null;
      notes?: string | null;
    },
  ) {
    const booster = await this.prisma.characterBoosterPeriod.findFirst({
      where: {
        id: boosterId,
        characterId,
        character: { userId },
      },
      select: { id: true },
    });

    if (!booster) {
      throw new ForbiddenException('Booster does not belong to current user');
    }

    const data: {
      boosterName?: string;
      startsAt?: Date;
      expiresAt?: Date;
      source?: string | null;
      notes?: string | null;
    } = {};

    if (input.boosterName !== undefined && input.boosterName !== null) {
      data.boosterName = input.boosterName;
    }

    if (input.startsAt !== undefined) {
      if (input.startsAt === null) {
        throw new BadRequestException('startsAt cannot be null');
      }
      const d = new Date(input.startsAt);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid startsAt');
      }
      data.startsAt = d;
    }

    if (input.expiresAt !== undefined) {
      if (input.expiresAt === null) {
        throw new BadRequestException('expiresAt cannot be null');
      }
      const d = new Date(input.expiresAt);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid expiresAt');
      }
      data.expiresAt = d;
    }

    if (input.source !== undefined) {
      data.source = input.source;
    }

    if (input.notes !== undefined) {
      data.notes = input.notes;
    }

    const updated = await this.prisma.characterBoosterPeriod.update({
      where: { id: boosterId },
      data,
    });

    return {
      id: updated.id,
      boosterName: updated.boosterName,
      source: updated.source,
      startsAt: updated.startsAt.toISOString(),
      expiresAt: updated.expiresAt.toISOString(),
      notes: updated.notes,
    };
  }

  async deleteCharacterBooster(
    userId: string,
    characterId: number,
    boosterId: string,
  ) {
    const booster = await this.prisma.characterBoosterPeriod.findFirst({
      where: {
        id: boosterId,
        characterId,
        character: { userId },
      },
      select: { id: true },
    });

    if (!booster) {
      throw new ForbiddenException('Booster does not belong to current user');
    }

    await this.prisma.characterBoosterPeriod.delete({
      where: { id: boosterId },
    });

    return { ok: true as const };
  }

  /**
   * Get authenticated training queue for one of the user's characters,
   * including a lightweight summary (active entry, remaining time, paused/empty).
   */
  async getCharacterTrainingQueue(userId: string, characterId: number) {
    const owned = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });

    if (!owned) {
      throw new ForbiddenException('Character does not belong to current user');
    }

    let rawQueue;
    try {
      rawQueue = await this.esiChars.getSkillQueue(characterId);
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      if (status === 401 || status === 403) {
        throw new BadRequestException(
          'Could not load training queue: ESI token is invalid, expired, or missing required skills scopes. Please re-link this character.',
        );
      }
      throw err;
    }
    const now = new Date();

    const queueEntries = rawQueue
      .slice()
      .sort((a, b) => a.queue_position - b.queue_position)
      .map((q) => {
        const startDate = q.start_date ?? null;
        const finishDate = q.finish_date ?? null;

        // ESI returns:
        // - training_start_sp
        // - (sometimes) training_end_sp
        // - level_start_sp / level_end_sp
        // - finished_level (the target level)
        //
        // Our API contract exposes:
        // - trainingStartSp / trainingEndSp
        // - levelStart / levelEnd
        //
        // Bridge the gap here so the frontend always has sensible values.
        const trainingStartSp = q.training_start_sp ?? q.level_start_sp ?? null;
        const trainingEndSp = q.training_end_sp ?? q.level_end_sp ?? null;

        const levelEnd = q.finished_level ?? null;
        const levelStart = levelEnd != null ? Math.max(0, levelEnd - 1) : null;

        return {
          skillId: q.skill_id,
          queuePosition: q.queue_position,
          startDate,
          finishDate,
          trainingStartSp,
          trainingEndSp,
          levelStart,
          levelEnd,
        };
      });

    const activeEntryRaw =
      queueEntries.find((e) => {
        if (!e.startDate || !e.finishDate) return false;
        const start = new Date(e.startDate);
        const end = new Date(e.finishDate);
        return start <= now && end > now;
      }) ?? null;

    // Total remaining training time for the queue.
    //
    // The original implementation summed (finishDate - now) for every entry,
    // which double‑counted time because each subsequent entry's finishDate
    // already includes the time spent on previous queue entries. This caused
    // inflated totals (e.g. >200d when the in‑game client reports ~60d).
    //
    // Instead, we compute the remaining training time as the sum of the
    // *durations* of each entry that has not yet fully completed, using:
    //
    //   - active entry:  finishDate - now        (remaining portion)
    //   - future entry:  finishDate - startDate  (full duration)
    //
    // This matches how the in‑game "Training Time" value is derived.
    const totalRemainingSeconds = queueEntries.reduce((acc, e) => {
      if (!e.finishDate) return acc;

      const end = new Date(e.finishDate);
      const start = e.startDate ? new Date(e.startDate) : null;

      // For entries that haven't started yet, we use their full duration
      // (finish - start). For the currently active entry (start < now),
      // we only count the remaining portion (finish - now).
      const effectiveStart = start && start > now ? start : now;

      const diffMs = end.getTime() - effectiveStart.getTime();
      const diffSec = Math.floor(diffMs / 1000);

      return diffSec > 0 ? acc + diffSec : acc;
    }, 0);

    const isQueueEmpty = queueEntries.length === 0;

    const skillIdSet = Array.from(
      new Set(queueEntries.map((entry) => entry.skillId).filter(Boolean)),
    );
    const skillNameMap = new Map<number, string>();
    if (skillIdSet.length > 0) {
      const skills = await this.prisma.skillDefinition.findMany({
        where: { typeId: { in: skillIdSet } },
        select: {
          typeId: true,
          nameEn: true,
          type: { select: { name: true } },
        },
      });
      for (const skill of skills) {
        skillNameMap.set(skill.typeId, skill.nameEn ?? skill.type.name);
      }
    }

    const entries = queueEntries.map((entry) => ({
      ...entry,
      skillName: skillNameMap.get(entry.skillId) ?? null,
    }));

    const activeEntry = activeEntryRaw
      ? {
          ...activeEntryRaw,
          skillName: skillNameMap.get(activeEntryRaw.skillId) ?? null,
        }
      : null;

    const isTraining = !!activeEntry;
    const isPaused = !isQueueEmpty && !isTraining;

    return {
      characterId,
      isQueueEmpty,
      isTraining,
      isPaused,
      totalRemainingSeconds: isQueueEmpty ? 0 : totalRemainingSeconds,
      activeEntry,
      entries,
    };
  }

  /**
   * Get current skills snapshot for one of the user's characters.
   */
  async getCharacterSkills(userId: string, characterId: number) {
    const owned = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });

    if (!owned) {
      throw new ForbiddenException('Character does not belong to current user');
    }

    let snapshot;
    try {
      snapshot = await this.esiChars.getSkills(characterId);
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      if (status === 401 || status === 403) {
        throw new BadRequestException(
          'Could not load skills: ESI token is invalid, expired, or missing required skills scopes. Please re-link this character.',
        );
      }
      throw err;
    }

    return {
      characterId,
      totalSp: snapshot.total_sp ?? 0,
      unallocatedSp: snapshot.unallocated_sp ?? 0,
      skills: snapshot.skills.map((s) => ({
        skillId: s.skill_id,
        skillpointsInSkill: s.skillpoints_in_skill ?? 0,
        trainedSkillLevel: s.trained_skill_level ?? 0,
        activeSkillLevel: s.active_skill_level ?? null,
      })),
    };
  }

  /**
   * Get current attribute distribution & remap info for one of the user's characters.
   */
  async getCharacterAttributes(userId: string, characterId: number) {
    const owned = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });

    if (!owned) {
      throw new ForbiddenException('Character does not belong to current user');
    }

    let attrs;
    try {
      attrs = await this.esiChars.getAttributes(characterId);
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      if (status === 401 || status === 403) {
        throw new BadRequestException(
          'Could not load attributes: ESI token is invalid, expired, or missing required skills scopes. Please re-link this character.',
        );
      }
      throw err;
    }

    return {
      characterId,
      charisma: attrs.charisma,
      intelligence: attrs.intelligence,
      memory: attrs.memory,
      perception: attrs.perception,
      willpower: attrs.willpower,
      bonusRemaps: attrs.bonus_remaps ?? null,
      lastRemapDate: attrs.last_remap_date ?? null,
      accruedRemapCooldownDate: attrs.accrued_remap_cooldown_date ?? null,
    };
  }

  async getOverview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        primaryCharacterId: true,
        characters: {
          select: {
            id: true,
            name: true,
            ownerHash: true,
            role: true,
            function: true,
            location: true,
            managedBy: true,
            token: {
              select: {
                accessTokenExpiresAt: true,
              },
            },
          },
        },
      },
    });

    if (!user) return { characters: [] as unknown[] };

    const now = new Date();

    const corpCache = new Map<
      number,
      {
        name?: string;
        ticker?: string;
      }
    >();
    const allianceCache = new Map<
      number,
      {
        name?: string;
        ticker?: string;
      }
    >();

    const results = await Promise.all(
      user.characters.map(async (c) => {
        const expiresAt = c.token?.accessTokenExpiresAt ?? null;
        let tokenStatus: 'missing' | 'valid' | 'expired' = 'missing';
        if (expiresAt) {
          tokenStatus = expiresAt > now ? 'valid' : 'expired';
        }

        let walletBalanceIsk: number | null = null;
        let securityStatus: number | null = null;
        let corporationId: number | null = null;
        let allianceId: number | null = null;
        let corporationName: string | null = null;
        let allianceName: string | null = null;

        try {
          walletBalanceIsk = await this.esiChars.getWallet(c.id);
        } catch (e) {
          this.logger.warn(
            `Failed to fetch wallet for character ${c.id}: ${String(e)}`,
          );
        }

        try {
          const meta = await this.esiChars.getCharacterMetadata(c.id);
          if (typeof meta.security_status === 'number') {
            securityStatus = meta.security_status;
          }
          if (typeof meta.corporation_id === 'number') {
            corporationId = meta.corporation_id;
          }
          if (typeof meta.alliance_id === 'number') {
            allianceId = meta.alliance_id;
          }
        } catch (e) {
          this.logger.warn(
            `Failed to fetch metadata for character ${c.id}: ${String(e)}`,
          );
        }

        if (corporationId != null) {
          try {
            let corp = corpCache.get(corporationId);
            if (!corp) {
              corp = await this.esiChars.getCorporationInfo(corporationId);
              corpCache.set(corporationId, corp);
            }
            corporationName = corp.name ?? null;
          } catch (e) {
            this.logger.warn(
              `Failed to fetch corporation info for ${corporationId}: ${String(e)}`,
            );
          }
        }

        if (allianceId != null) {
          try {
            let alliance = allianceCache.get(allianceId);
            if (!alliance) {
              alliance = await this.esiChars.getAllianceInfo(allianceId);
              allianceCache.set(allianceId, alliance);
            }
            allianceName = alliance.name ?? null;
          } catch (e) {
            this.logger.warn(
              `Failed to fetch alliance info for ${allianceId}: ${String(e)}`,
            );
          }
        }

        return {
          id: c.id,
          name: c.name,
          ownerHash: c.ownerHash,
          role: c.role,
          function: c.function,
          location: c.location,
          managedBy: c.managedBy,
          isPrimary: user.primaryCharacterId === c.id,
          tokenStatus,
          tokenExpiresAt: expiresAt?.toISOString() ?? null,
          walletBalanceIsk,
          securityStatus,
          corporationId,
          allianceId,
          corporationName,
          allianceName,
        };
      }),
    );

    return { characters: results };
  }
}
