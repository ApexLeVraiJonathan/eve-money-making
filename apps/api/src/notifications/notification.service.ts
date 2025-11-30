import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppConfig } from '@api/common/config';
import { DiscordDmService } from './discord-dm.service';
import type { NotificationType } from './dto/notification-preferences.dto';

type UserDiscordTarget = {
  userId: string;
  discordUserId: string;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordDm: DiscordDmService,
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
