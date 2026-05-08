import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '@api/common/config';
import { PrismaService } from '@api/prisma/prisma.service';
import type { MarketDataCleanupResponse } from '@eve/shared/tradecraft-market';

type CleanupPrisma = Pick<
  PrismaService,
  | 'npcMarketStationBaseline'
  | 'npcMarketSnapshot'
  | 'npcMarketRegionTypesSnapshot'
  | 'npcMarketRun'
>;

@Injectable()
export class MarketDataCleanupService {
  private readonly logger = new Logger(MarketDataCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async cleanupRawNpcMarketData(options?: {
    now?: Date;
  }): Promise<MarketDataCleanupResponse> {
    const config = AppConfig.marketDataRetention();
    const now = options?.now ?? new Date();
    const cutoff = new Date(
      now.getTime() - config.rawRetentionDays * 24 * 60 * 60 * 1000,
    );

    if (!config.cleanupEnabled) {
      return {
        ok: true,
        skipped: true,
        reason: 'MARKET_CLEANUP_ENABLED is disabled',
        retentionDays: config.rawRetentionDays,
        cutoff: cutoff.toISOString(),
        protectedBaselineIds: [],
        deleted: {
          npcMarketSnapshots: 0,
          npcMarketRegionTypesSnapshots: 0,
          npcMarketRuns: 0,
        },
      };
    }

    const result = await this.prisma.$transaction(async (tx) =>
      this.deleteExpiredRawNpcRows(tx, cutoff),
    );

    this.logger.log(
      `Raw NPC market cleanup: retentionDays=${config.rawRetentionDays} cutoff=${cutoff.toISOString()} snapshots=${result.deleted.npcMarketSnapshots} regionTypes=${result.deleted.npcMarketRegionTypesSnapshots} runs=${result.deleted.npcMarketRuns}`,
    );

    return {
      ok: true,
      skipped: false,
      reason: null,
      retentionDays: config.rawRetentionDays,
      cutoff: cutoff.toISOString(),
      ...result,
    };
  }

  async cleanupExpiredMarketAnomalies(options?: { now?: Date }): Promise<{
    ok: true;
    skipped: boolean;
    reason: string | null;
    retentionDays: number;
    cutoff: string;
    deleted: number;
  }> {
    const config = AppConfig.marketDataRetention();
    const now = options?.now ?? new Date();
    const cutoff = new Date(
      now.getTime() - config.anomalyRetentionDays * 24 * 60 * 60 * 1000,
    );

    if (!config.cleanupEnabled) {
      return {
        ok: true,
        skipped: true,
        reason: 'MARKET_CLEANUP_ENABLED is disabled',
        retentionDays: config.anomalyRetentionDays,
        cutoff: cutoff.toISOString(),
        deleted: 0,
      };
    }

    const res = await this.prisma.marketPriceAnomaly.deleteMany({
      where: { scanObservedAt: { lt: cutoff } },
    });
    this.logger.log(
      `Market anomaly cleanup: retentionDays=${config.anomalyRetentionDays} cutoff=${cutoff.toISOString()} deleted=${res.count}`,
    );
    return {
      ok: true,
      skipped: false,
      reason: null,
      retentionDays: config.anomalyRetentionDays,
      cutoff: cutoff.toISOString(),
      deleted: res.count,
    };
  }

  private async deleteExpiredRawNpcRows(tx: CleanupPrisma, cutoff: Date) {
    const activeBaselines = await tx.npcMarketStationBaseline.findMany({
      select: { baselineId: true },
    });
    const protectedBaselineIds = activeBaselines.map((row) => row.baselineId);
    const baselineGuard =
      protectedBaselineIds.length > 0
        ? { baselineId: { notIn: protectedBaselineIds } }
        : {};

    const [snapshots, regionTypes, runs] = await Promise.all([
      tx.npcMarketSnapshot.deleteMany({
        where: {
          observedAt: { lt: cutoff },
          ...baselineGuard,
        },
      }),
      tx.npcMarketRegionTypesSnapshot.deleteMany({
        where: {
          observedAt: { lt: cutoff },
          ...baselineGuard,
        },
      }),
      tx.npcMarketRun.deleteMany({
        where: {
          startedAt: { lt: cutoff },
          ...baselineGuard,
        },
      }),
    ]);

    return {
      protectedBaselineIds,
      deleted: {
        npcMarketSnapshots: snapshots.count,
        npcMarketRegionTypesSnapshots: regionTypes.count,
        npcMarketRuns: runs.count,
      },
    };
  }
}

