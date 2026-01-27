import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppConfig } from '@api/common/config';
import { NotificationService } from '@api/notifications/notification.service';
import { SelfMarketCollectorService } from '@api/tradecraft/self-market/self-market-collector.service';
import { NpcMarketCollectorService } from '@api/tradecraft/npc-market/npc-market-collector.service';

@Injectable()
export class MarketGatheringRunner {
  private readonly logger = new Logger(MarketGatheringRunner.name);
  private marketGatherInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly selfMarket: SelfMarketCollectorService,
    private readonly npcMarket: NpcMarketCollectorService,
  ) {}

  /**
   * Market gathering runner (structure + NPC) should run sequentially so both
   * collectors share ESI concurrency rather than competing with each other.
   */
  async runOnce(): Promise<void> {
    if (this.marketGatherInProgress) {
      this.logger.warn(
        'Skipping market gathering (previous run still in progress)',
      );
      return;
    }

    const startedAt = Date.now();
    this.marketGatherInProgress = true;
    try {
      const selfEnabled = AppConfig.marketSelfGather().enabled;
      const npcEnabled = AppConfig.marketNpcGather().enabled;

      this.logger.log(
        `Market gathering runner starting (self=${selfEnabled ? 'on' : 'off'}, npc=${npcEnabled ? 'on' : 'off'})`,
      );

      // Structure first, then NPC.
      await this.runSelfMarketGatheringOnce();
      await this.runNpcMarketGatheringOnce();
    } catch (e) {
      // Individual collectors handle their own error logging/notifications;
      // this catch is only to ensure the runner never crashes the scheduler.
      this.logger.warn(
        `Market gathering runner failed: ${
          e instanceof Error ? e.message : String(e ?? 'unknown')
        }`,
      );
    } finally {
      this.marketGatherInProgress = false;
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Market gathering runner finished (durationMs=${durationMs})`,
      );
    }
  }

  private async runSelfMarketGatheringOnce(): Promise<void> {
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

  private async runNpcMarketGatheringOnce(): Promise<void> {
    const cfg = AppConfig.marketNpcGather();
    if (!cfg.enabled) return;

    try {
      const res = await this.npcMarket.collectStationOnce({
        stationId: cfg.stationId,
      });
      this.npcMarket.markSuccess();
      this.logger.debug(
        `NPC market gather ok: station=${cfg.stationId} durationMs=${res.durationMs} keys=${res.aggregateKeys}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? 'unknown');
      this.logger.warn(`NPC market gather failed: ${msg}`);
      // NpcMarketCollectorService already handles its own DM notifications
      // in its internal error path.
    }
  }

  private async notifySelfMarketFailure(message: string): Promise<void> {
    const cfg = AppConfig.marketSelfGather();
    const characterId = cfg.characterId;
    let userId: string | null = null;

    if (characterId) {
      const c = await this.prisma.eveCharacter.findUnique({
        where: { id: characterId },
        select: { userId: true },
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
}
