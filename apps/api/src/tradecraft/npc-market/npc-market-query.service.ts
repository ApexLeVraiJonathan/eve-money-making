import { Injectable } from '@nestjs/common';
import { AppConfig } from '@api/common/config';
import { PrismaService } from '@api/prisma/prisma.service';
import { Prisma } from '@eve/prisma';
import { JobKeys, resolveJobEnabledFlag } from '../jobs/job-keys';
import {
  NpcMarketCompareAdam4EveQueryDto,
  NpcMarketDailyAggregatesQueryDto,
  NpcMarketSnapshotLatestQueryDto,
  NpcMarketSnapshotTypesQueryDto,
  NpcMarketStationQueryDto,
} from './dto/npc-market.dto';
import { NpcMarketAggregatesService } from './npc-market-aggregates.service';
import { NpcMarketComparisonService } from './npc-market-comparison.service';

@Injectable()
export class NpcMarketQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregates: NpcMarketAggregatesService,
    private readonly comparison: NpcMarketComparisonService,
  ) {}

  resolveStationId(raw?: string): number | null {
    const cfg = AppConfig.marketNpcGather();
    if (raw && raw.trim()) {
      const n = Number(raw.trim());
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return cfg.stationId;
  }

  async getStatus(q: NpcMarketStationQueryDto) {
    const cfg = AppConfig.marketNpcGather();
    const stationId = this.resolveStationId(q.stationId);
    const jobsEnabled = AppConfig.jobs().enabled;
    const appEnv = AppConfig.env();
    const globalCronEnabled = appEnv === 'prod' && jobsEnabled;
    const marketJobFlag = resolveJobEnabledFlag(JobKeys.marketGathering);
    const cronEffectiveEnabled =
      globalCronEnabled && marketJobFlag.enabled && cfg.enabled;
    const station = stationId
      ? await this.prisma.stationId.findUnique({
          where: { id: stationId },
          select: {
            id: true,
            name: true,
            solarSystem: {
              select: { id: true, name: true, regionId: true },
            },
          },
        })
      : null;

    const baseline = stationId
      ? await this.prisma.npcMarketStationBaseline.findUnique({
          where: { stationId },
          select: { baselineId: true, observedAt: true, regionId: true },
        })
      : null;

    const latestSnapshot =
      stationId && baseline?.baselineId
        ? await (async () => {
            const baselineId = baseline.baselineId;
            const [buyAgg, sellAgg, uniqueTypesRows] = await Promise.all([
              this.prisma.npcMarketSnapshot.aggregate({
                where: { stationId, baselineId, isBuyOrder: true },
                _sum: { orderCount: true },
              }),
              this.prisma.npcMarketSnapshot.aggregate({
                where: { stationId, baselineId, isBuyOrder: false },
                _sum: { orderCount: true },
              }),
              this.prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
                SELECT COUNT(DISTINCT type_id)::bigint AS n
                FROM npc_market_snapshots
                WHERE station_id = ${stationId}
                  AND baseline_id = ${baselineId}
                  AND order_count > 0
              `),
            ]);
            const buyCount = Number(buyAgg._sum.orderCount ?? 0);
            const sellCount = Number(sellAgg._sum.orderCount ?? 0);
            const uniqueTypes = Number(uniqueTypesRows?.[0]?.n ?? 0);
            return {
              observedAt: baseline.observedAt.toISOString(),
              orderCount: buyCount + sellCount,
              buyCount,
              sellCount,
              uniqueTypes,
            };
          })()
        : null;

    const latestAgg = stationId
      ? await this.prisma.npcMarketOrderTradeDaily.findFirst({
          where: { stationId },
          orderBy: { scanDate: 'desc' },
          select: { scanDate: true },
        })
      : null;

    const lastRun = stationId
      ? await this.prisma.npcMarketRun.findFirst({
          where: { stationId },
          orderBy: { startedAt: 'desc' },
          select: {
            baselineId: true,
            startedAt: true,
            finishedAt: true,
            ok: true,
            typeCount: true,
            errorMessage: true,
          },
        })
      : null;

    return {
      config: {
        enabled: cfg.enabled,
        stationId: cfg.stationId,
        pollMinutes: cfg.pollMinutes,
        expiryWindowMinutes: cfg.expiryWindowMinutes,
      },
      cron: {
        appEnv,
        jobsEnabled,
        jobEnabled: marketJobFlag.enabled,
        jobEnabledSourceKey: marketJobFlag.sourceKey,
        effectiveEnabled: cronEffectiveEnabled,
      },
      resolvedStation: station
        ? {
            stationId: station.id,
            stationName: station.name,
            solarSystemId: station.solarSystem.id,
            solarSystemName: station.solarSystem.name,
            regionId: station.solarSystem.regionId,
          }
        : null,
      latestSnapshot,
      latestAggregateDay: latestAgg?.scanDate
        ? latestAgg.scanDate.toISOString().slice(0, 10)
        : null,
      activeBaseline: baseline
        ? {
            baselineId: baseline.baselineId,
            observedAt: baseline.observedAt.toISOString(),
            regionId: baseline.regionId,
          }
        : null,
      lastRun: lastRun
        ? {
            baselineId: lastRun.baselineId,
            startedAt: lastRun.startedAt.toISOString(),
            finishedAt: lastRun.finishedAt?.toISOString() ?? null,
            ok: lastRun.ok,
            typeCount: lastRun.typeCount,
            errorMessage: lastRun.errorMessage,
          }
        : null,
    };
  }

  async getSnapshotLatestTypes(q: NpcMarketSnapshotTypesQueryDto) {
    const stationId = this.resolveStationId(q.stationId);
    if (!stationId)
      return { stationId: null, baselineId: null, observedAt: null, types: [] };

    const baseline = await this.prisma.npcMarketStationBaseline.findUnique({
      where: { stationId },
      select: { baselineId: true, observedAt: true },
    });
    if (!baseline) {
      return { stationId, baselineId: null, observedAt: null, types: [] };
    }

    const side = q.side ?? 'ALL';
    const limitTypes = q.limitTypes ?? 200;
    const where: Prisma.NpcMarketSnapshotWhereInput = {
      stationId,
      baselineId: baseline.baselineId,
    };
    if (side !== 'ALL') where.isBuyOrder = side === 'BUY';

    const rows = await this.prisma.npcMarketSnapshot.findMany({
      where,
      select: {
        typeId: true,
        isBuyOrder: true,
        orderCount: true,
        bestPrice: true,
      },
    });

    const byType = new Map<
      number,
      {
        sellCount: number;
        buyCount: number;
        bestSell: Prisma.Decimal | null;
        bestBuy: Prisma.Decimal | null;
      }
    >();

    for (const r of rows) {
      if (!r.orderCount) continue;
      const entry = byType.get(r.typeId) ?? {
        sellCount: 0,
        buyCount: 0,
        bestSell: null,
        bestBuy: null,
      };
      if (r.isBuyOrder) {
        entry.buyCount = r.orderCount;
        entry.bestBuy = r.bestPrice ?? null;
      } else {
        entry.sellCount = r.orderCount;
        entry.bestSell = r.bestPrice ?? null;
      }
      byType.set(r.typeId, entry);
    }

    const typeIds = Array.from(byType.keys());
    const typeRows =
      typeIds.length > 0
        ? await this.prisma.typeId.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map<number, string>();
    for (const t of typeRows) nameById.set(t.id, t.name);

    const types = typeIds
      .map((typeId) => {
        const v = byType.get(typeId)!;
        return {
          typeId,
          typeName: nameById.get(typeId) ?? null,
          sellCount: v.sellCount,
          buyCount: v.buyCount,
          bestSell: v.bestSell ? Number(v.bestSell) : null,
          bestBuy: v.bestBuy ? Number(v.bestBuy) : null,
        };
      })
      .sort((a, b) => {
        const at = a.sellCount + a.buyCount;
        const bt = b.sellCount + b.buyCount;
        if (bt !== at) return bt - at;
        return a.typeId - b.typeId;
      })
      .slice(0, limitTypes);

    return {
      stationId,
      baselineId: baseline.baselineId,
      observedAt: baseline.observedAt.toISOString(),
      side,
      types,
    };
  }

  async getSnapshotLatest(q: NpcMarketSnapshotLatestQueryDto) {
    const stationId = this.resolveStationId(q.stationId);
    if (!stationId) {
      return {
        stationId: null,
        baselineId: null,
        observedAt: null,
        totalOrders: 0,
        matchedOrders: 0,
        filteredOrders: 0,
        typeNames: {} as Record<string, string>,
        orders: [] as unknown[],
      };
    }

    const baseline = await this.prisma.npcMarketStationBaseline.findUnique({
      where: { stationId },
      select: { baselineId: true, observedAt: true },
    });
    if (!baseline) {
      return {
        stationId,
        baselineId: null,
        observedAt: null,
        totalOrders: 0,
        matchedOrders: 0,
        filteredOrders: 0,
        typeNames: {} as Record<string, string>,
        orders: [] as unknown[],
      };
    }

    const typeId = q.typeId ?? null;
    if (!typeId || !Number.isFinite(typeId) || typeId <= 0) {
      return {
        stationId,
        baselineId: baseline.baselineId,
        observedAt: baseline.observedAt.toISOString(),
        totalOrders: 0,
        matchedOrders: 0,
        filteredOrders: 0,
        typeNames: {} as Record<string, string>,
        orders: [] as unknown[],
      };
    }

    const wantSide = q.side ?? 'ALL';
    const limit = q.limit ?? 500;
    const where: Prisma.NpcMarketSnapshotWhereInput = {
      stationId,
      baselineId: baseline.baselineId,
      typeId,
    };
    if (wantSide === 'BUY') where.isBuyOrder = true;
    if (wantSide === 'SELL') where.isBuyOrder = false;

    const snaps = await this.prisma.npcMarketSnapshot.findMany({
      where,
      select: { orders: true },
    });

    const allOrders = snaps.flatMap((s) => {
      const list = (s.orders ?? []) as unknown as unknown[];
      return Array.isArray(list) ? list : [];
    });
    const filtered = allOrders.slice(0, limit);

    const typeRow = await this.prisma.typeId.findUnique({
      where: { id: typeId },
      select: { id: true, name: true },
    });
    const typeNames: Record<string, string> = {};
    if (typeRow) typeNames[String(typeRow.id)] = typeRow.name;

    return {
      stationId,
      baselineId: baseline.baselineId,
      observedAt: baseline.observedAt.toISOString(),
      totalOrders: allOrders.length,
      matchedOrders: allOrders.length,
      filteredOrders: filtered.length,
      typeNames,
      orders: filtered,
    };
  }

  async getDailyAggregates(q: NpcMarketDailyAggregatesQueryDto) {
    const stationId = this.resolveStationId(q.stationId);
    return this.aggregates.getDailyAggregates(q, stationId);
  }

  async compareAdam4Eve(q: NpcMarketCompareAdam4EveQueryDto) {
    const stationId = this.resolveStationId(q.stationId);
    return this.comparison.compareAdam4Eve(q, stationId);
  }
}
