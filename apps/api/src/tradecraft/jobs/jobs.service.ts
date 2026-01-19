import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@api/prisma/prisma.service';
import { ImportService } from '@api/game-data/services/import.service';
import { WalletService } from '@api/tradecraft/wallet/services/wallet.service';
import { AllocationService } from '@api/tradecraft/wallet/services/allocation.service';
import { SnapshotService } from '@api/tradecraft/cycles/services/snapshot.service';
import { CapitalService } from '@api/tradecraft/cycles/services/capital.service';
import { EsiTokenService } from '@api/characters/services/esi-token.service';
import { AppConfig } from '@api/common/config';
import { CharacterService } from '@api/characters/services/character.service';
import { NotificationService } from '@api/notifications/notification.service';
import { SkillPlansService } from '@api/skill-plans/skill-plans.service';
import { SkillFarmService } from '@api/skill-farm/skill-farm.service';
import type { SkillFarmTrackingEntry } from '@eve/api-contracts';
import { SelfMarketCollectorService } from '@api/tradecraft/self-market/self-market-collector.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly imports: ImportService,
    private readonly wallets: WalletService,
    private readonly allocation: AllocationService,
    private readonly snapshotService: SnapshotService,
    private readonly capitalService: CapitalService,
    private readonly esiToken: EsiTokenService,
    private readonly characterService: CharacterService,
    private readonly notifications: NotificationService,
    private readonly skillPlans: SkillPlansService,
    private readonly skillFarm: SkillFarmService,
    private readonly selfMarket: SelfMarketCollectorService,
  ) {}

  private jobsEnabled(): boolean {
    return AppConfig.jobs().enabled;
  }

  private jobFlag(key: string, fallback: boolean): boolean {
    const v = process.env[key];
    if (v === undefined) return fallback;
    return v === 'true' || v === '1' || v === 'yes';
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runSkillPlanNotifications(): Promise<void> {
    if (
      !this.jobsEnabled() ||
      !this.jobFlag('JOB_SKILL_PLAN_NOTIFICATIONS_ENABLED', true)
    ) {
      this.logger.debug('Skipping skill plan notifications (jobs disabled)');
      return;
    }

    try {
      const assignments = await this.prisma.skillPlanAssignment.findMany({
        include: {
          skillPlan: {
            select: { id: true, name: true, userId: true, config: true },
          },
          character: {
            select: { id: true, name: true, userId: true },
          },
        },
      });

      const now = new Date();

      for (const assignment of assignments) {
        const { skillPlan, character } = assignment;
        if (!skillPlan || !character || skillPlan.userId !== character.userId) {
          continue;
        }

        const userId = skillPlan.userId;
        const characterId = character.id;
        const planId = skillPlan.id;

        const progress = await this.skillPlans.getPlanProgressForCharacter(
          userId,
          planId,
          characterId,
        );

        const completionAt = new Date(
          now.getTime() + progress.remainingSeconds * 1000,
        );

        const offsets: Array<{ label: '3d' | '1d' | '1h'; ms: number }> = [
          { label: '3d', ms: 3 * 24 * 60 * 60 * 1000 },
          { label: '1d', ms: 24 * 60 * 60 * 1000 },
          { label: '1h', ms: 60 * 60 * 1000 },
        ];

        const settings = (assignment.settings ?? {}) as {
          sentNotifications?: {
            completion?: Record<string, boolean>;
          };
        };
        settings.sentNotifications ??= {};
        settings.sentNotifications.completion ??= {};

        for (const offset of offsets) {
          const eventTime = new Date(completionAt.getTime() - offset.ms);
          if (eventTime <= now) {
            // Window has passed; skip if we already sent or it's too late.
            continue;
          }

          const diff = eventTime.getTime() - now.getTime();
          if (diff <= 60 * 60 * 1000) {
            const key = offset.label;
            if (!settings.sentNotifications.completion[key]) {
              await this.notifications.notifySkillPlanCompletion({
                userId,
                characterName: character.name,
                planName: skillPlan.name,
                completionAt,
                remainingSeconds: progress.remainingSeconds,
              });
              settings.sentNotifications.completion[key] = true;
            }
          }
        }

        await this.prisma.skillPlanAssignment.update({
          where: { id: assignment.id },
          data: { settings },
        });
      }
    } catch (e) {
      this.logger.warn(
        `Skill plan notifications job failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runSkillFarmNotifications(): Promise<void> {
    if (
      !this.jobsEnabled() ||
      !this.jobFlag('JOB_SKILL_FARM_NOTIFICATIONS_ENABLED', true)
    ) {
      this.logger.debug('Skipping skill farm notifications (jobs disabled)');
      return;
    }

    try {
      const configs = await this.prisma.skillFarmCharacterConfig.findMany({
        where: { isActiveFarm: true, includeInNotifications: true },
        include: {
          user: { select: { id: true } },
          character: { select: { id: true, name: true } },
        },
      });

      const now = new Date();

      for (const cfg of configs) {
        const userId = cfg.userId;
        const characterId = cfg.characterId;
        const characterName = cfg.character.name;

        const tracking = await this.skillFarm.getTrackingSnapshot(userId);
        const entry = tracking.characters.find(
          (c: SkillFarmTrackingEntry) => c.characterId === characterId,
        );
        if (!entry) continue;

        // Extractor-ready notifications
        if (entry.fullExtractorsReady > 0) {
          await this.notifications.notifySkillFarmExtractorReady({
            userId,
            characterName,
            injectorsReady: entry.fullExtractorsReady,
          });
        }

        // Queue low notifications
        const hoursRemaining = entry.queueSecondsRemaining / 3600;
        if (
          entry.queueStatus === 'WARNING' ||
          entry.queueStatus === 'URGENT' ||
          entry.queueStatus === 'EMPTY'
        ) {
          await this.notifications.notifySkillFarmQueueLow({
            userId,
            characterName,
            status: entry.queueStatus,
            queueHoursRemaining: hoursRemaining,
          });
        }
      }
    } catch (e) {
      this.logger.warn(
        `Skill farm notifications job failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runEsiCacheCleanup(): Promise<void> {
    if (!this.jobsEnabled() || !this.jobFlag('JOB_CLEANUP_ENABLED', true)) {
      this.logger.debug('Skipping ESI cache cleanup (jobs disabled)');
      return;
    }
    await this.cleanupExpiredEsiCache().catch((e) =>
      this.logger.warn(
        `ESI cache cleanup failed: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async runDailyImports(): Promise<void> {
    if (
      !this.jobsEnabled() ||
      !this.jobFlag('JOB_DAILY_IMPORTS_ENABLED', true)
    ) {
      this.logger.debug('Skipping daily imports (jobs disabled)');
      return;
    }
    try {
      const { missing } = await this.imports.importMissingMarketOrderTrades(15);
      this.logger.log(
        `Daily import finished; missing processed=${missing.length}`,
      );
    } catch (e) {
      this.logger.warn(
        `Daily import failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runSelfMarketGathering(): Promise<void> {
    if (
      !this.jobsEnabled() ||
      !this.jobFlag('JOB_SELF_MARKET_GATHER_ENABLED', true)
    ) {
      return;
    }

    const cfg = AppConfig.marketSelfGather();
    if (!cfg.enabled) return;

    try {
      const res = await this.selfMarket.collectStructureOnce();
      this.selfMarket.markSuccess();
      this.logger.debug(
        `Self market gather ok: structure=${cfg.structureId?.toString()} orders=${res.orderCount} keys=${res.tradesKeys}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? 'unknown');
      this.logger.warn(`Self market gather failed: ${msg}`);

      if (this.selfMarket.shouldNotifyFailure(new Date())) {
        await this.notifySelfMarketFailure(msg).catch(() => undefined);
      }
    }
  }

  private async notifySelfMarketFailure(message: string): Promise<void> {
    const cfg = AppConfig.marketSelfGather();
    const characterId = cfg.characterId;
    let userId: string | null = null;

    if (characterId) {
      const c = await this.prisma.eveCharacter.findUnique({
        where: { id: characterId },
        select: { userId: true, name: true, managedBy: true },
      });
      userId = c?.userId ?? null;
    }

    userId = userId ?? cfg.notifyUserId;
    if (!userId) return;

    const structureId = cfg.structureId?.toString() ?? '(unknown)';
    await this.notifications.sendSystemAlertDm({
      userId,
      title: 'Market self-gathering warning',
      lines: [
        `Structure: ${structureId}`,
        `CharacterId: ${String(characterId ?? '(unset)')}`,
        `Error: ${message}`,
      ],
    });
  }

  /**
   * Daily job to send grouped PLEX/MCT/booster expiry notifications.
   *
   * Runs once per day to avoid spamming; thresholds are handled inside
   * NotificationService.sendExpirySummaries.
   */
  @Cron('0 9 * * *')
  async runExpiryNotifications(): Promise<void> {
    if (
      !this.jobsEnabled() ||
      !this.jobFlag('JOB_EXPIRY_NOTIFICATIONS_ENABLED', true)
    ) {
      this.logger.debug('Skipping expiry notifications (jobs disabled)');
      return;
    }

    try {
      await this.notifications.sendExpirySummaries();
    } catch (e) {
      this.logger.warn(
        `Expiry notifications job failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  /**
   * Core wallet import and allocation logic (no jobs-enabled check).
   * Can be called manually via API or from scheduled job.
   */
  async executeWalletImportsAndAllocation(): Promise<{
    buysAllocated: number;
    sellsAllocated: number;
  }> {
    await this.wallets.importAllLinked();
    const result = await this.allocation.allocateAll();
    this.logger.log(
      `Wallets import and allocation completed: buys=${result.buysAllocated}, sells=${result.sellsAllocated}`,
    );

    // Create snapshots for open cycles
    await this.snapshotOpenCycles();

    return result;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runWalletImportsAndAllocation(): Promise<void> {
    if (!this.jobsEnabled() || !this.jobFlag('JOB_WALLETS_ENABLED', true)) {
      this.logger.debug('Skipping wallets import/allocation (jobs disabled)');
      return;
    }
    try {
      await this.executeWalletImportsAndAllocation();
    } catch (e) {
      this.logger.warn(
        `Hourly wallets/allocation failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async snapshotOpenCycles(): Promise<void> {
    try {
      const openCycles = await this.prisma.cycle.findMany({
        where: { status: 'OPEN' },
        select: { id: true },
      });
      for (const c of openCycles) {
        await this.snapshotService.createCycleSnapshot(c.id);
      }
      this.logger.log(
        `Cycle snapshots created for ${openCycles.length} open cycles`,
      );
    } catch (e) {
      this.logger.warn(
        `Snapshot creation failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async recomputeCapitalForOpenCycles(): Promise<void> {
    if (!this.jobsEnabled() || !this.jobFlag('JOB_CAPITAL_ENABLED', true)) {
      this.logger.debug('Skipping capital recompute (jobs disabled)');
      return;
    }
    try {
      const openCycles = await this.prisma.cycle.findMany({
        where: { status: 'OPEN' },
        select: { id: true },
      });
      for (const c of openCycles) {
        await this.capitalService.computeCapital(c.id, { force: true });
      }
      this.logger.log(
        `Capital recompute completed for ${openCycles.length} open cycles`,
      );
    } catch (e) {
      this.logger.warn(
        `Capital recompute failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * Refresh SYSTEM character tokens monthly to keep them alive.
   * Runs at 2 AM on the 1st of each month.
   */
  @Cron('0 2 1 * *')
  async refreshSystemCharacterTokens(): Promise<void> {
    if (
      !this.jobsEnabled() ||
      !this.jobFlag('JOB_SYSTEM_TOKENS_ENABLED', true)
    ) {
      this.logger.debug('Skipping system token refresh (jobs disabled)');
      return;
    }
    try {
      const systemChars =
        await this.characterService.getSystemManagedCharacters();

      let successCount = 0;
      let failCount = 0;

      for (const char of systemChars) {
        try {
          await this.esiToken.getAccessToken(char.id);
          successCount++;
          this.logger.log(
            `Refreshed token for SYSTEM character ${char.name} (${char.id})`,
          );
        } catch (e) {
          failCount++;
          this.logger.error(
            `Failed to refresh token for SYSTEM character ${char.name} (${char.id}): ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      this.logger.log(
        `System character token refresh completed: ${successCount} success, ${failCount} failures`,
      );
    } catch (e) {
      this.logger.warn(
        `System token refresh job failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async cleanupExpiredEsiCache(): Promise<{ deleted: number }> {
    const now = new Date();
    const res = await this.prisma.esiCacheEntry.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    this.logger.log(`ESI cache cleanup: deleted=${res.count}`);
    return { deleted: res.count };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runOAuthStateCleanup(): Promise<void> {
    if (!this.jobsEnabled() || !this.jobFlag('JOB_CLEANUP_ENABLED', true)) {
      this.logger.debug('Skipping OAuth state cleanup (jobs disabled)');
      return;
    }
    await this.cleanupExpiredOAuthStates().catch((e) =>
      this.logger.warn(
        `OAuth state cleanup failed: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
  }

  async cleanupExpiredOAuthStates(): Promise<{ deleted: number }> {
    const now = new Date();
    const res = await this.prisma.oAuthState.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    this.logger.log(`OAuth state cleanup: deleted=${res.count}`);
    return { deleted: res.count };
  }

  async cleanupWalletJournals(): Promise<{ deleted: number }> {
    const res = await this.prisma.walletJournalEntry.deleteMany({});
    this.logger.log(`Wallet journal cleanup: deleted=${res.count}`);
    return { deleted: res.count };
  }

  /**
   * Computes staleness (missing daily market files) for last N days.
   */
  async backfillMissingTrades(
    daysBack: number,
  ): Promise<{ missing: string[] }> {
    const dates = this.getLastNDates(daysBack);
    const missing: string[] = [];
    for (const date of dates) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const count = await this.prisma.marketOrderTradeDaily.count({
        where: { scanDate: dayStart },
      });
      if (count === 0) missing.push(date);
    }
    return { missing };
  }

  private getLastNDates(n: number): string[] {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 1; i <= n; i++) {
      const d = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
      );
      d.setUTCDate(d.getUTCDate() - i);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  }
}
