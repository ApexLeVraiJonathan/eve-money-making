import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '@api/common/config';
import { PrismaService } from '@api/prisma/prisma.service';
import { JobKeys, resolveJobEnabledFlag } from '../jobs/job-keys';
import {
  SelfMarketClearDailyQueryDto,
  SelfMarketDailyAggregatesQueryDto,
  SelfMarketSnapshotLatestQueryDto,
  SelfMarketSnapshotTypeSummaryQueryDto,
  SelfMarketStatusQueryDto,
} from '@api/tradecraft/market/dto/self-market.dto';

type StructureMarketOrder = {
  duration: number;
  is_buy_order: boolean;
  issued: string;
  location_id: number;
  min_volume: number;
  order_id: number;
  price: number;
  range: string;
  type_id: number;
  volume_remain: number;
  volume_total: number;
};

function utcDayStartFromYyyyMmDd(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const s = String(v).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
}

@Injectable()
export class SelfMarketQueryService {
  private readonly logger = new Logger(SelfMarketQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  resolveStructureId(raw?: string): bigint | null {
    const cfg = AppConfig.marketSelfGather();
    if (raw && raw.trim()) return BigInt(raw.trim());
    return cfg.structureId;
  }

  async getStatus(q: SelfMarketStatusQueryDto) {
    const cfg = AppConfig.marketSelfGather();
    const structureId = this.resolveStructureId(q.structureId);
    const jobsEnabled = AppConfig.jobs().enabled;
    const appEnv = AppConfig.env();
    const globalCronEnabled = appEnv === 'prod' && jobsEnabled;
    const marketJobFlag = resolveJobEnabledFlag(JobKeys.marketGathering);
    const cronEffectiveEnabled =
      globalCronEnabled && marketJobFlag.enabled && cfg.enabled;

    const latestSnap = structureId
      ? await this.prisma.selfMarketSnapshotLatest.findUnique({
          where: { locationId: structureId },
          select: { observedAt: true, orders: true },
        })
      : null;

    const orders = (latestSnap?.orders ??
      []) as unknown as StructureMarketOrder[];
    const orderCount = Array.isArray(orders) ? orders.length : 0;
    const buyCount = Array.isArray(orders)
      ? orders.reduce((n, o) => n + (o?.is_buy_order ? 1 : 0), 0)
      : 0;
    const sellCount = orderCount - buyCount;
    const uniqueTypes =
      Array.isArray(orders) && orders.length
        ? new Set(orders.map((o) => o.type_id)).size
        : 0;

    const latestAgg = structureId
      ? await this.prisma.selfMarketOrderTradeDaily.findFirst({
          where: { locationId: structureId },
          orderBy: { scanDate: 'desc' },
          select: { scanDate: true },
        })
      : null;

    return {
      config: {
        enabled: cfg.enabled,
        structureId: cfg.structureId?.toString() ?? null,
        characterId: cfg.characterId ?? null,
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
      resolvedStructureId: structureId?.toString() ?? null,
      latestSnapshot: latestSnap
        ? {
            observedAt: latestSnap.observedAt.toISOString(),
            orderCount,
            buyCount,
            sellCount,
            uniqueTypes,
          }
        : null,
      latestAggregateDay: latestAgg?.scanDate
        ? latestAgg.scanDate.toISOString().slice(0, 10)
        : null,
    };
  }

  async getSnapshotLatest(q: SelfMarketSnapshotLatestQueryDto) {
    const structureId = this.resolveStructureId(q.structureId);
    if (!structureId) {
      return {
        structureId: null,
        observedAt: null,
        totalOrders: 0,
        filteredOrders: 0,
        typeNames: {} as Record<string, string>,
        orders: [] as StructureMarketOrder[],
      };
    }

    const snap = await this.prisma.selfMarketSnapshotLatest.findUnique({
      where: { locationId: structureId },
      select: { observedAt: true, orders: true },
    });

    const rawOrders = (snap?.orders ?? []) as unknown as StructureMarketOrder[];
    const list = Array.isArray(rawOrders) ? rawOrders : [];
    const wantSide = q.side ?? 'ALL';
    const wantTypeId = q.typeId;
    const limit = q.limit ?? 200;

    const matches = list.filter((o) => {
      if (!o) return false;
      if (wantTypeId && o.type_id !== wantTypeId) return false;
      if (wantSide === 'BUY' && !o.is_buy_order) return false;
      if (wantSide === 'SELL' && o.is_buy_order) return false;
      return true;
    });

    const filtered = matches.slice(0, limit);
    const typeIds = Array.from(new Set(filtered.map((o) => o.type_id)));
    const typeRows =
      typeIds.length > 0
        ? await this.prisma.typeId.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
          })
        : [];

    const typeNames: Record<string, string> = {};
    for (const t of typeRows) typeNames[String(t.id)] = t.name;

    return {
      structureId: structureId.toString(),
      observedAt: snap?.observedAt?.toISOString() ?? null,
      totalOrders: list.length,
      matchedOrders: matches.length,
      filteredOrders: filtered.length,
      typeTotalOrders: wantTypeId ? matches.length : undefined,
      typeNames,
      orders: filtered,
    };
  }

  async getSnapshotLatestTypes(q: SelfMarketSnapshotTypeSummaryQueryDto) {
    const structureId = this.resolveStructureId(q.structureId);
    if (!structureId) {
      return {
        structureId: null,
        observedAt: null,
        totalOrders: 0,
        matchedOrders: 0,
        uniqueTypes: 0,
        types: [] as Array<{
          typeId: number;
          typeName: string | null;
          sellCount: number;
          buyCount: number;
          bestSell: number | null;
          bestBuy: number | null;
        }>,
      };
    }

    const snap = await this.prisma.selfMarketSnapshotLatest.findUnique({
      where: { locationId: structureId },
      select: { observedAt: true, orders: true },
    });

    const rawOrders = (snap?.orders ?? []) as unknown as StructureMarketOrder[];
    const list = Array.isArray(rawOrders) ? rawOrders : [];
    const wantSide = q.side ?? 'ALL';
    const matched = list.filter((o) => {
      if (!o) return false;
      if (wantSide === 'BUY' && !o.is_buy_order) return false;
      if (wantSide === 'SELL' && o.is_buy_order) return false;
      return true;
    });

    const byType = new Map<
      number,
      {
        sellCount: number;
        buyCount: number;
        bestSell: number | null;
        bestBuy: number | null;
      }
    >();

    for (const o of matched) {
      const typeId = Number(o.type_id);
      if (!Number.isFinite(typeId)) continue;
      const entry = byType.get(typeId) ?? {
        sellCount: 0,
        buyCount: 0,
        bestSell: null,
        bestBuy: null,
      };

      const price = Number(o.price);
      if (o.is_buy_order) {
        entry.buyCount += 1;
        if (Number.isFinite(price)) {
          entry.bestBuy =
            entry.bestBuy === null ? price : Math.max(entry.bestBuy, price);
        }
      } else {
        entry.sellCount += 1;
        if (Number.isFinite(price)) {
          entry.bestSell =
            entry.bestSell === null ? price : Math.min(entry.bestSell, price);
        }
      }

      byType.set(typeId, entry);
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
          bestSell: v.bestSell,
          bestBuy: v.bestBuy,
        };
      })
      .sort((a, b) => {
        const at = a.sellCount + a.buyCount;
        const bt = b.sellCount + b.buyCount;
        if (bt !== at) return bt - at;
        return a.typeId - b.typeId;
      });

    const limitTypes = q.limitTypes ?? 200;
    return {
      structureId: structureId.toString(),
      observedAt: snap?.observedAt?.toISOString() ?? null,
      totalOrders: list.length,
      matchedOrders: matched.length,
      uniqueTypes: byType.size,
      types: types.slice(0, limitTypes),
    };
  }

  async getDailyAggregates(params: {
    query: SelfMarketDailyAggregatesQueryDto;
    rawHasGone?: unknown;
  }) {
    const q = params.query;
    const structureId = this.resolveStructureId(q.structureId);
    if (!structureId) return { structureId: null, date: null, rows: [] };

    const date = q.date ?? new Date().toISOString().slice(0, 10);
    const scanDate = utcDayStartFromYyyyMmDd(date);
    if (!scanDate) {
      return { structureId: structureId.toString(), date, rows: [] };
    }

    const rawDtoHasGone = (q as unknown as { hasGone?: unknown }).hasGone;
    const hasGone =
      parseBool(params.rawHasGone) ?? parseBool(rawDtoHasGone) ?? false;
    const side = q.side ?? 'SELL';
    const limit = q.limit ?? 500;

    if (AppConfig.env() !== 'prod') {
      this.logger.debug(
        `Self market daily query: date=${date} hasGone=${String(
          hasGone,
        )} (dtoRaw=${String(rawDtoHasGone)} dtoType=${typeof rawDtoHasGone} reqQueryHasGone=${String(
          params.rawHasGone,
        )} reqQueryType=${typeof params.rawHasGone}) side=${side} typeId=${String(
          q.typeId ?? '',
        )} limit=${String(limit)}`,
      );
    }

    const where = {
      locationId: structureId,
      scanDate,
      hasGone,
      ...(side !== 'ALL' ? { isBuyOrder: side === 'BUY' } : {}),
      ...(q.typeId ? { typeId: q.typeId } : {}),
    };

    const rows = await this.prisma.selfMarketOrderTradeDaily.findMany({
      where,
      orderBy: [{ iskValue: 'desc' }],
      take: limit,
      select: {
        scanDate: true,
        locationId: true,
        typeId: true,
        isBuyOrder: true,
        hasGone: true,
        amount: true,
        high: true,
        low: true,
        avg: true,
        orderNum: true,
        iskValue: true,
      },
    });

    const typeIds = Array.from(new Set(rows.map((r) => r.typeId)));
    const typeRows =
      typeIds.length > 0
        ? await this.prisma.typeId.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
          })
        : [];

    const typeNames: Record<string, string> = {};
    for (const t of typeRows) typeNames[String(t.id)] = t.name;

    return {
      structureId: structureId.toString(),
      date,
      hasGone,
      side,
      typeNames,
      rows: rows.map((r) => ({
        scanDate: r.scanDate.toISOString().slice(0, 10),
        locationId: r.locationId.toString(),
        typeId: r.typeId,
        isBuyOrder: r.isBuyOrder,
        hasGone: r.hasGone,
        amount: r.amount.toString(),
        orderNum: r.orderNum.toString(),
        iskValue: r.iskValue.toString(),
        high: r.high.toString(),
        low: r.low.toString(),
        avg: r.avg.toString(),
      })),
    };
  }

  async clearDaily(q: SelfMarketClearDailyQueryDto) {
    if (AppConfig.env() === 'prod') {
      return { ok: false, error: 'Not allowed in prod' };
    }
    const structureId = this.resolveStructureId(q.structureId);
    if (!structureId) return { ok: false, deleted: 0, date: null };
    const date = q.date ?? new Date().toISOString().slice(0, 10);
    const scanDate = utcDayStartFromYyyyMmDd(date);
    if (!scanDate) return { ok: false, deleted: 0, date };

    const res = await this.prisma.selfMarketOrderTradeDaily.deleteMany({
      where: { locationId: structureId, scanDate },
    });
    return {
      ok: true,
      deleted: res.count,
      date,
      structureId: structureId.toString(),
    };
  }
}
