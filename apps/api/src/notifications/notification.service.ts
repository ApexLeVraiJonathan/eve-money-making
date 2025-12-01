import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppConfig } from '@api/common/config';
import { DiscordDmService } from './discord-dm.service';
import type { NotificationType } from './dto/notification-preferences.dto';
import { CharacterManagementService } from '../character-management/character-management.service';

type UserDiscordTarget = {
  userId: string;
  discordUserId: string;
};

type ExpiryStage = '3d' | '1d' | 'expired' | 'preview';

type PlexAlertItem = {
  kind: 'PLEX';
  accountLabel: string | null;
  expiresAt: Date;
  stage: ExpiryStage;
};

type MctAlertItem = {
  kind: 'MCT';
  accountLabel: string | null;
  expiresAt: Date;
  stage: ExpiryStage;
};

type BoosterAlertItem = {
  kind: 'BOOSTER';
  characterName: string;
  boosterName: string;
  expiresAt: Date;
  stage: ExpiryStage;
};

type QueueIdleAlertItem = {
  kind: 'TRAINING_QUEUE_IDLE';
  accountLabel: string | null;
  allowedQueues: number;
  activeQueues: number;
  missingQueues: number;
};

type UserExpirySummary = {
  userId: string;
  plex: PlexAlertItem[];
  mct: MctAlertItem[];
  boosters: BoosterAlertItem[];
  queues: QueueIdleAlertItem[];
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordDm: DiscordDmService,
    private readonly characterManagement: CharacterManagementService,
  ) {}

  private manageUrl(): string {
    return new URL(
      '/settings/notifications',
      AppConfig.webBaseUrl(),
    ).toString();
  }

  private cycleDetailsUrl(): string {
    return new URL(
      '/tradecraft/cycle-details',
      AppConfig.webBaseUrl(),
    ).toString();
  }

  private cycleOptInUrl(): string {
    return new URL(
      '/tradecraft/cycles/opt-in',
      AppConfig.webBaseUrl(),
    ).toString();
  }

  private skillPlansUrl(): string {
    return new URL('/characters/skills', AppConfig.webBaseUrl()).toString();
  }

  /**
   * Send a simple test DM to verify Discord linking for a specific user.
   */
  async sendTestDmToUser(userId: string): Promise<void> {
    const account = await this.prisma.discordAccount.findFirst({
      where: { userId },
      select: { discordUserId: true, username: true },
    });

    if (!account) {
      throw new Error(
        'No Discord account linked to this user. Please connect Discord first.',
      );
    }

    const manageUrl = this.manageUrl();

    const content =
      `This is a test notification from EVE Money Making.\n` +
      `Your Discord link is working for user **${account.username}**.\n\n` +
      `You can manage or turn off notifications here: ${manageUrl}`;

    await this.discordDm.sendDirectMessage(account.discordUserId, content);
  }

  /**
   * Notify all opted-in users that a new cycle has been planned.
   */
  async notifyCyclePlanned(cycleId: string): Promise<void> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { id: true, name: true, startedAt: true },
    });
    if (!cycle) return;

    const targets = await this.getDiscordTargetsForPreference('CYCLE_PLANNED');
    if (!targets.length) return;

    const when = cycle.startedAt.toISOString();
    const title = cycle.name ?? cycle.id;
    const optInUrl = this.cycleOptInUrl();
    const manageUrl = this.manageUrl();

    const content =
      `A new investment cycle has been planned: **${title}**.\n` +
      `Planned start: ${when}.\n\n` +
      `You can review and opt in on the website: ${optInUrl}\n` +
      `Manage or turn off notifications: ${manageUrl}`;

    await Promise.all(
      targets.map((t) =>
        this.discordDm.sendDirectMessage(t.discordUserId, content),
      ),
    );
  }

  /**
   * Notify all opted-in users that a cycle has started.
   */
  async notifyCycleStarted(cycleId: string): Promise<void> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { id: true, name: true, startedAt: true },
    });
    if (!cycle) return;

    const targets = await this.getDiscordTargetsForPreference('CYCLE_STARTED');
    if (!targets.length) return;

    const title = cycle.name ?? cycle.id;
    const detailsUrl = this.cycleDetailsUrl();
    const manageUrl = this.manageUrl();

    const content =
      `Cycle **${title}** has started.\n\n` +
      `You can view current cycle details here: ${detailsUrl}\n` +
      `Manage or turn off notifications: ${manageUrl}`;

    await Promise.all(
      targets.map((t) =>
        this.discordDm.sendDirectMessage(t.discordUserId, content),
      ),
    );
  }

  /**
   * Notify all opted-in participants that cycle results are available.
   */
  async notifyCycleResults(cycleId: string): Promise<void> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { id: true, name: true },
    });
    if (!cycle) return;

    const participants = await this.prisma.cycleParticipation.findMany({
      where: {
        cycleId,
        userId: { not: null },
      },
      select: {
        userId: true,
      },
    });

    const participantUserIds = Array.from(
      new Set(
        participants
          .map((p) => p.userId)
          .filter((u): u is string => typeof u === 'string'),
      ),
    );
    if (!participantUserIds.length) return;

    const targets = await this.getDiscordTargetsForPreference(
      'CYCLE_RESULTS',
      participantUserIds,
    );
    if (!targets.length) return;

    const title = cycle.name ?? cycle.id;
    const detailsUrl = this.cycleDetailsUrl();
    const manageUrl = this.manageUrl();

    const content =
      `Results are now available for cycle **${title}**.\n\n` +
      `You can review performance and your participation here: ${detailsUrl}\n` +
      `Manage or turn off notifications: ${manageUrl}`;

    await Promise.all(
      targets.map((t) =>
        this.discordDm.sendDirectMessage(t.discordUserId, content),
      ),
    );
  }

  /**
   * Notify a single participant that their payout has been sent.
   */
  async notifyPayoutSent(participationId: string): Promise<void> {
    const participation = await this.prisma.cycleParticipation.findUnique({
      where: { id: participationId },
      select: {
        id: true,
        userId: true,
        characterName: true,
        amountIsk: true,
        payoutAmountIsk: true,
        cycle: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!participation?.userId) return;

    const [target] = await this.getDiscordTargetsForPreference(
      'CYCLE_PAYOUT_SENT',
      [participation.userId],
    );
    if (!target) return;

    const title = participation.cycle.name ?? participation.cycle.id;
    const manageUrl = this.manageUrl();
    const invested = Number(participation.amountIsk).toFixed(2);
    const payout = participation.payoutAmountIsk
      ? Number(participation.payoutAmountIsk).toFixed(2)
      : '0.00';

    const content =
      `Your payout for cycle **${title}** has been marked as sent.\n` +
      `Character: ${participation.characterName}\n` +
      `Investment: ${invested} ISK\n` +
      `Payout: ${payout} ISK\n\n` +
      `Manage or turn off notifications: ${manageUrl}`;

    await this.discordDm.sendDirectMessage(target.discordUserId, content);
  }

  async notifySkillPlanCompletion(params: {
    userId: string;
    characterName: string;
    planName: string;
    completionAt: Date;
    remainingSeconds: number;
  }): Promise<void> {
    const [target] = await this.getDiscordTargetsForPreference(
      'SKILL_PLAN_COMPLETION',
      [params.userId],
    );
    if (!target) return;

    const manageUrl = this.manageUrl();
    const skillPlansUrl = this.skillPlansUrl();

    const now = new Date();
    const diffMs = params.completionAt.getTime() - now.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    const hours = Math.floor(diffSec / 3600);
    const days = Math.floor(hours / 24);
    const hoursRemainder = hours % 24;

    const timeLabel = days > 0 ? `${days}d ${hoursRemainder}h` : `${hours}h`;

    const content =
      `Your skill plan **${params.planName}** for character **${params.characterName}** ` +
      `is estimated to complete in about ${timeLabel}.\n\n` +
      `You can review or adjust this plan here: ${skillPlansUrl}\n` +
      `Manage or turn off notifications: ${manageUrl}`;

    await this.discordDm.sendDirectMessage(target.discordUserId, content);
  }

  async notifySkillPlanRemapReminder(params: {
    userId: string;
    characterName: string;
    planName: string;
    remapAt: Date;
  }): Promise<void> {
    const [target] = await this.getDiscordTargetsForPreference(
      'SKILL_PLAN_REMAP_REMINDER',
      [params.userId],
    );
    if (!target) return;

    const manageUrl = this.manageUrl();
    const skillPlansUrl = this.skillPlansUrl();

    const when = params.remapAt.toISOString();

    const content =
      `Upcoming attribute remap for plan **${params.planName}** on character **${params.characterName}**.\n` +
      `Recommended time: ${when} (EVE time).\n\n` +
      `You can review or adjust this plan here: ${skillPlansUrl}\n` +
      `Manage or turn off notifications: ${manageUrl}`;

    await this.discordDm.sendDirectMessage(target.discordUserId, content);
  }

  /**
   * Build and send grouped expiry notifications (PLEX, MCT, Boosters) for users.
   *
   * - When forceAll=false (scheduled job), only entries close to thresholds are included:
   *   - ~3 days remaining
   *   - ~1 day remaining
   *   - just expired
   * - When forceAll=true (admin debug), all current entries are included regardless of timing.
   */
  async sendExpirySummaries(options?: {
    onlyUserId?: string;
    forceAll?: boolean;
  }): Promise<void> {
    const { onlyUserId, forceAll = false } = options ?? {};

    const dayMs = 24 * 60 * 60 * 1000;
    const halfDayMs = 12 * 60 * 60 * 1000;
    const now = new Date();

    const classifyStage = (expiresAt: Date): ExpiryStage | null => {
      const diffMs = expiresAt.getTime() - now.getTime();
      const threeDays = 3 * dayMs;
      const oneDay = dayMs;

      if (Math.abs(diffMs - threeDays) <= halfDayMs) return '3d';
      if (Math.abs(diffMs - oneDay) <= halfDayMs) return '1d';
      if (Math.abs(diffMs) <= halfDayMs) return 'expired';
      return null;
    };

    // Load enabled notification preferences for the three expiry-related types.
    const enabledPrefs = await this.prisma.notificationPreference.findMany({
      where: {
        channel: 'DISCORD_DM',
        enabled: true,
        notificationType: {
          in: [
            'PLEX_ENDING',
            'MCT_ENDING',
            'BOOSTER_ENDING',
            'TRAINING_QUEUE_IDLE',
          ],
        },
        ...(onlyUserId ? { userId: onlyUserId } : {}),
      },
      select: { userId: true, notificationType: true },
    });

    if (!enabledPrefs.length) {
      return;
    }

    const enabledByUser = new Map<string, Set<string>>();
    for (const pref of enabledPrefs) {
      if (!pref.userId) continue;
      const set = enabledByUser.get(pref.userId) ?? new Set<string>();
      set.add(pref.notificationType);
      enabledByUser.set(pref.userId, set);
    }

    if (!enabledByUser.size) {
      return;
    }

    const userIds = Array.from(enabledByUser.keys());

    // Prepare summaries per user.
    const byUser = new Map<string, UserExpirySummary>();
    const ensureUserSummary = (userId: string): UserExpirySummary => {
      let summary = byUser.get(userId);
      if (!summary) {
        summary = { userId, plex: [], mct: [], boosters: [], queues: [] };
        byUser.set(userId, summary);
      }
      return summary;
    };

    // PLEX subscriptions
    const plexSubs = await this.prisma.eveAccountSubscription.findMany({
      where: {
        type: 'PLEX',
        isActive: true,
        eveAccount: { userId: { in: userIds } },
      },
      include: {
        eveAccount: {
          select: { userId: true, label: true },
        },
      },
    });

    for (const sub of plexSubs) {
      const userId = sub.eveAccount.userId;
      if (!userId) continue;
      const prefs = enabledByUser.get(userId);
      if (!prefs?.has('PLEX_ENDING')) continue;

      const expiresAt = sub.expiresAt;
      const stage = classifyStage(expiresAt);
      if (!forceAll && !stage) continue;

      const effectiveStage: ExpiryStage = stage ?? 'preview';

      const summary = ensureUserSummary(userId);
      summary.plex.push({
        kind: 'PLEX',
        accountLabel: sub.eveAccount.label,
        expiresAt,
        stage: effectiveStage,
      });
    }

    // MCT slots
    const mctSubs = await this.prisma.eveAccountSubscription.findMany({
      where: {
        type: 'MCT',
        isActive: true,
        eveAccount: { userId: { in: userIds } },
      },
      include: {
        eveAccount: {
          select: { userId: true, label: true },
        },
      },
    });

    for (const sub of mctSubs) {
      const userId = sub.eveAccount.userId;
      if (!userId) continue;
      const prefs = enabledByUser.get(userId);
      if (!prefs?.has('MCT_ENDING')) continue;

      const expiresAt = sub.expiresAt;
      const stage = classifyStage(expiresAt);
      if (!forceAll && !stage) continue;

      const effectiveStage: ExpiryStage = stage ?? 'preview';

      const summary = ensureUserSummary(userId);
      summary.mct.push({
        kind: 'MCT',
        accountLabel: sub.eveAccount.label,
        expiresAt,
        stage: effectiveStage,
      });
    }

    // Boosters
    const boosters = await this.prisma.characterBoosterPeriod.findMany({
      where: {
        character: {
          userId: { in: userIds },
        },
      },
      include: {
        character: {
          select: { userId: true, name: true },
        },
      },
    });

    for (const booster of boosters) {
      const userId = booster.character.userId;
      if (!userId) continue;
      const prefs = enabledByUser.get(userId);
      if (!prefs?.has('BOOSTER_ENDING')) continue;

      const expiresAt = booster.expiresAt;
      const stage = classifyStage(expiresAt);
      if (!forceAll && !stage) continue;

      const effectiveStage: ExpiryStage = stage ?? 'preview';

      const summary = ensureUserSummary(userId);
      summary.boosters.push({
        kind: 'BOOSTER',
        characterName: booster.character.name,
        boosterName: booster.boosterName,
        expiresAt,
        stage: effectiveStage,
      });
    }

    // Training queue idle alerts
    const queueIdleUserIds = userIds.filter((uid) =>
      enabledByUser.get(uid)?.has('TRAINING_QUEUE_IDLE'),
    );

    if (queueIdleUserIds.length) {
      const accounts = await this.prisma.eveAccount.findMany({
        where: { userId: { in: queueIdleUserIds } },
        include: {
          subscriptions: true,
          characters: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      for (const account of accounts) {
        const userId = account.userId;
        if (!userId) continue;

        const prefs = enabledByUser.get(userId);
        if (!prefs?.has('TRAINING_QUEUE_IDLE')) continue;

        const activeSubs = account.subscriptions.filter(
          (s) =>
            s.isActive &&
            s.expiresAt > now &&
            (s.type === 'PLEX' || s.type === 'MCT'),
        );

        if (!activeSubs.length) continue;

        const activeMctCount = activeSubs.filter(
          (s) => s.type === 'MCT',
        ).length;

        let allowedQueues = 1 + activeMctCount;
        if (allowedQueues > 3) allowedQueues = 3;
        if (allowedQueues <= 0) continue;

        const characters = account.characters;
        if (!characters.length) continue;

        let activeQueues = 0;

        for (const ch of characters) {
          try {
            const queue =
              await this.characterManagement.getCharacterTrainingQueue(
                userId,
                ch.id,
              );
            if (
              queue &&
              !queue.isQueueEmpty &&
              queue.isTraining &&
              !queue.isPaused
            ) {
              activeQueues++;
            }
          } catch {
            // Ignore errors for individual characters (e.g. missing scopes)
          }
        }

        const missingQueues = allowedQueues - activeQueues;
        if (missingQueues > 0) {
          const summary = ensureUserSummary(userId);
          summary.queues.push({
            kind: 'TRAINING_QUEUE_IDLE',
            accountLabel: account.label,
            allowedQueues,
            activeQueues,
            missingQueues,
          });
        }
      }
    }

    if (!byUser.size) {
      return;
    }

    // Resolve Discord accounts for all affected users.
    const accounts = await this.prisma.discordAccount.findMany({
      where: { userId: { in: Array.from(byUser.keys()) } },
      select: { userId: true, discordUserId: true },
    });
    const discordByUser = new Map<string, string>();
    for (const a of accounts) {
      if (!discordByUser.has(a.userId)) {
        discordByUser.set(a.userId, a.discordUserId);
      }
    }

    const manageUrl = this.manageUrl();

    for (const summary of byUser.values()) {
      const discordUserId = discordByUser.get(summary.userId);
      if (!discordUserId) continue;

      if (
        !summary.plex.length &&
        !summary.mct.length &&
        !summary.boosters.length &&
        !summary.queues.length
      ) {
        continue;
      }

      const lines: string[] = [];
      lines.push(`Subscription and booster alerts for your EVE accounts:\n`);

      const fmtStage = (stage: ExpiryStage, expiresAt: Date): string => {
        const diffMs = expiresAt.getTime() - now.getTime();
        const days = Math.floor(diffMs / dayMs);
        if (stage === 'expired') return 'Expired';
        if (stage === '3d') return '3 days remaining';
        if (stage === '1d') return '1 day remaining';
        // preview / fallback
        return `${days >= 0 ? days : 0}d remaining`;
      };

      if (summary.plex.length) {
        lines.push(`**PLEX**`);
        for (const item of summary.plex) {
          const label = item.accountLabel ?? 'Account';
          lines.push(
            `• ${label}: ${fmtStage(item.stage, item.expiresAt)} (expires at ${item.expiresAt.toISOString()})`,
          );
        }
        lines.push('');
      }

      if (summary.mct.length) {
        lines.push(`**MCT**`);
        for (const item of summary.mct) {
          const label = item.accountLabel ?? 'Account';
          lines.push(
            `• ${label}: ${fmtStage(item.stage, item.expiresAt)} (expires at ${item.expiresAt.toISOString()})`,
          );
        }
        lines.push('');
      }

      if (summary.boosters.length) {
        lines.push(`**Boosters**`);
        for (const item of summary.boosters) {
          lines.push(
            `• ${item.characterName} – ${item.boosterName}: ${fmtStage(item.stage, item.expiresAt)} (expires at ${item.expiresAt.toISOString()})`,
          );
        }
        lines.push('');
      }

      if (summary.queues.length) {
        lines.push(`**Training Queue**`);
        for (const item of summary.queues) {
          const label = item.accountLabel ?? 'Account';
          lines.push(
            `• ${label}: ${item.missingQueues} queue(s) idle – ${item.activeQueues}/${item.allowedQueues} in use while you have active training time.`,
          );
        }
        lines.push('');
      }

      lines.push(`You can manage or turn off notifications here: ${manageUrl}`);

      const content = lines.join('\n');

      await this.discordDm.sendDirectMessage(discordUserId, content);
    }
  }

  /**
   * Helper to resolve which users (with Discord accounts) have opted in to a given notification type.
   * Optionally filter to a specific set of user IDs (e.g. participants).
   */
  private async getDiscordTargetsForPreference(
    type: NotificationType,
    limitToUserIds?: string[],
  ): Promise<UserDiscordTarget[]> {
    const whereUser: { in?: string[] } = {};
    if (limitToUserIds?.length) {
      whereUser.in = Array.from(new Set(limitToUserIds));
    }

    const prefs = await this.prisma.notificationPreference.findMany({
      where: {
        channel: 'DISCORD_DM',
        notificationType: type,
        enabled: true,
        ...(whereUser.in ? { userId: whereUser } : {}),
      },
      select: { userId: true },
    });

    const userIds = Array.from(
      new Set(
        prefs
          .map((p) => p.userId)
          .filter((u): u is string => typeof u === 'string'),
      ),
    );
    if (!userIds.length) return [];

    const accounts = await this.prisma.discordAccount.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, discordUserId: true },
    });

    const byUser = new Map<string, string>();
    for (const a of accounts) {
      if (!byUser.has(a.userId)) {
        byUser.set(a.userId, a.discordUserId);
      }
    }

    return userIds
      .map((userId) => {
        const discordUserId = byUser.get(userId);
        if (!discordUserId) return null;
        return { userId, discordUserId };
      })
      .filter((x): x is UserDiscordTarget => x !== null);
  }
}
