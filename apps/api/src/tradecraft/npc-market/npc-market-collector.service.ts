import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { EsiService } from '@api/esi/esi.service';
import { AppConfig } from '@api/common/config';
import { NotificationService } from '@api/notifications/notification.service';
import { Prisma } from '@eve/prisma';
import { randomUUID } from 'crypto';

type RegionMarketOrder = {
  duration: number; // days
  is_buy_order: boolean;
  issued: string; // ISO
  location_id: number;
  min_volume: number;
  order_id: number;
  price: number;
  range: string;
  type_id: number;
  volume_remain: number;
  volume_total: number;
};

type AggKey = string;
type Agg = {
  scanDate: Date;
  stationId: number;
  typeId: number;
  isBuyOrder: boolean;
  hasGone: boolean;
  amount: bigint;
  orderNum: bigint;
  iskValue: Prisma.Decimal;
  high: Prisma.Decimal;
  low: Prisma.Decimal;
};

function utcDayStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function toDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}

function maxDec(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.greaterThan(b) ? a : b;
}

function minDec(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.lessThan(b) ? a : b;
}

function computeSnapshotStats(
  orders: RegionMarketOrder[],
  isBuy: boolean,
): {
  orderCount: number;
  bestPrice: Prisma.Decimal | null;
} {
  const orderCount = orders.length;
  if (!orderCount) return { orderCount: 0, bestPrice: null };
  let best = orders[0]?.price;
  for (const o of orders) {
    const p = Number(o?.price);
    if (!Number.isFinite(p)) continue;
    if (best === undefined || !Number.isFinite(best)) {
      best = p;
      continue;
    }
    if (isBuy) best = Math.max(best, p);
    else best = Math.min(best, p);
  }
  return {
    orderCount,
    bestPrice:
      best !== undefined && Number.isFinite(best) ? toDecimal(best) : null,
  };
}

@Injectable()
export class NpcMarketCollectorService {
  private readonly logger = new Logger(NpcMarketCollectorService.name);

  // Simple in-memory failure throttle to avoid DM spam.
  private consecutiveFailures = 0;
  private lastNotifyAt: number | null = null; // epoch ms

  constructor(
    private readonly prisma: PrismaService,
    private readonly esi: EsiService,
    private readonly notifications: NotificationService,
  ) {}

  private buildAggKey(params: {
    scanDate: Date;
    stationId: number;
    typeId: number;
    isBuyOrder: boolean;
    hasGone: boolean;
  }): AggKey {
    return [
      params.scanDate.toISOString().slice(0, 10),
      String(params.stationId),
      String(params.typeId),
      params.isBuyOrder ? 'B' : 'S',
      params.hasGone ? 'G1' : 'G0',
    ].join(':');
  }

  private addToAgg(
    map: Map<AggKey, Agg>,
    params: {
      scanDate: Date;
      stationId: number;
      typeId: number;
      isBuyOrder: boolean;
      hasGone: boolean;
      amountDelta: bigint;
      orderNumDelta: bigint;
      price: Prisma.Decimal;
    },
  ) {
    if (params.amountDelta <= 0n) return;
    const key = this.buildAggKey(params);
    const existing = map.get(key);
    const iskDelta = params.price.mul(
      new Prisma.Decimal(params.amountDelta.toString()),
    );
    if (!existing) {
      map.set(key, {
        scanDate: params.scanDate,
        stationId: params.stationId,
        typeId: params.typeId,
        isBuyOrder: params.isBuyOrder,
        hasGone: params.hasGone,
        amount: params.amountDelta,
        orderNum: params.orderNumDelta,
        iskValue: iskDelta,
        high: params.price,
        low: params.price,
      });
      return;
    }
    existing.amount = existing.amount + params.amountDelta;
    existing.orderNum = existing.orderNum + params.orderNumDelta;
    existing.iskValue = existing.iskValue.add(iskDelta);
    existing.high = maxDec(existing.high, params.price);
    existing.low = minDec(existing.low, params.price);
  }

  private likelyExpired(params: {
    issued: Date;
    durationDays: number;
    prevObservedAt: Date;
    observedAt: Date;
    expiryWindowMinutes: number;
  }): boolean {
    const expiresAtMs =
      params.issued.getTime() + params.durationDays * 24 * 60 * 60 * 1000;
    const w = params.expiryWindowMinutes * 60 * 1000;
    const prevMs = params.prevObservedAt.getTime();
    const nowMs = params.observedAt.getTime();
    return expiresAtMs >= prevMs - w && expiresAtMs <= nowMs + w;
  }

  private async fetchAllRegionTypes(params: {
    regionId: number;
    forceRefresh: boolean;
    reqId: string;
  }): Promise<number[]> {
    const path = `/latest/markets/${params.regionId}/types/`;
    const first = await this.esi.fetchPaged<number[]>(path, {
      page: 1,
      forceRefresh: params.forceRefresh,
      reqId: params.reqId,
    });
    const out: number[] = Array.isArray(first.data) ? [...first.data] : [];
    const totalPages = first.totalPages ?? 1;
    for (let page = 2; page <= totalPages; page++) {
      const { data } = await this.esi.fetchJson<number[]>(path, {
        forceRefresh: params.forceRefresh,
        reqId: params.reqId,
        query: { page },
      });
      if (Array.isArray(data) && data.length) out.push(...data);
    }
    return Array.from(new Set(out.filter((n) => Number.isFinite(n) && n > 0)));
  }

  private async fetchStationOrdersForType(params: {
    regionId: number;
    stationId: number;
    typeId: number;
    side: 'buy' | 'sell';
    forceRefresh: boolean;
    reqId: string;
  }): Promise<RegionMarketOrder[]> {
    const path = `/latest/markets/${params.regionId}/orders/`;
    const first = await this.esi.fetchPaged<RegionMarketOrder[]>(path, {
      page: 1,
      forceRefresh: params.forceRefresh,
      reqId: params.reqId,
      query: { order_type: params.side, type_id: params.typeId },
    });
    const pages = first.totalPages ?? 1;
    const all: RegionMarketOrder[] = Array.isArray(first.data)
      ? [...first.data]
      : [];
    for (let page = 2; page <= pages; page++) {
      const { data } = await this.esi.fetchJson<RegionMarketOrder[]>(path, {
        forceRefresh: params.forceRefresh,
        reqId: params.reqId,
        query: { order_type: params.side, type_id: params.typeId, page },
      });
      if (Array.isArray(data) && data.length) all.push(...data);
    }
    return all.filter((o) => o && o.location_id === params.stationId);
  }

  private async fetchStationOrdersForTypeAllSides(params: {
    regionId: number;
    stationId: number;
    typeId: number;
    forceRefresh: boolean;
    reqId: string;
  }): Promise<{ sell: RegionMarketOrder[]; buy: RegionMarketOrder[] }> {
    const path = `/latest/markets/${params.regionId}/orders/`;

    try {
      const baseQuery = { order_type: 'all', type_id: params.typeId } as const;
      const first = await this.esi.fetchPaged<RegionMarketOrder[]>(path, {
        page: 1,
        forceRefresh: params.forceRefresh,
        reqId: params.reqId,
        query: baseQuery,
      });
      const pages = first.totalPages ?? 1;
      const all: RegionMarketOrder[] = Array.isArray(first.data)
        ? [...first.data]
        : [];
      for (let page = 2; page <= pages; page++) {
        const { data } = await this.esi.fetchJson<RegionMarketOrder[]>(path, {
          forceRefresh: params.forceRefresh,
          reqId: params.reqId,
          query: { ...baseQuery, page },
        });
        if (Array.isArray(data) && data.length) all.push(...data);
      }

      const sell: RegionMarketOrder[] = [];
      const buy: RegionMarketOrder[] = [];
      for (const o of all) {
        if (!o || o.location_id !== params.stationId) continue;
        if (o.is_buy_order) buy.push(o);
        else sell.push(o);
      }
      return { sell, buy };
    } catch (e) {
      // Safety fallback: some ESI/CDN combinations may not accept order_type=all with type_id.
      // If that happens, revert to explicit buy/sell calls.
      this.logger.warn(
        `NPC market: order_type=all failed for type=${params.typeId}; falling back to buy/sell. Err=${(e as Error)?.message ?? e}`,
      );
      const [sell, buy] = await Promise.all([
        this.fetchStationOrdersForType({
          regionId: params.regionId,
          stationId: params.stationId,
          typeId: params.typeId,
          side: 'sell',
          forceRefresh: params.forceRefresh,
          reqId: params.reqId,
        }),
        this.fetchStationOrdersForType({
          regionId: params.regionId,
          stationId: params.stationId,
          typeId: params.typeId,
          side: 'buy',
          forceRefresh: params.forceRefresh,
          reqId: params.reqId,
        }),
      ]);
      return { sell, buy };
    }
  }

  shouldNotifyFailure(now: Date): boolean {
    const cfg = AppConfig.marketNpcGather();
    this.consecutiveFailures++;
    if (this.consecutiveFailures < 3) return false;
    const nowMs = now.getTime();
    if (this.lastNotifyAt && nowMs - this.lastNotifyAt < 60 * 60 * 1000) {
      return false;
    }
    this.lastNotifyAt = nowMs;
    if (!cfg.enabled) return false;
    return true;
  }

  markSuccess(): void {
    this.consecutiveFailures = 0;
    this.lastNotifyAt = null;
  }

  async collectStationOnce(opts: {
    stationId: number;
    forceRefresh?: boolean;
    observedAt?: Date;
  }): Promise<{
    ok: true;
    stationId: number;
    regionId: number;
    baselineId: string;
    observedAt: string;
    typeCount: number;
    durationMs: number;
    aggregateKeys: number;
    hadPreviousBaseline: boolean;
  }> {
    const startedAt = Date.now();
    const cfg = AppConfig.marketNpcGather();
    const stationId = opts.stationId;
    const forceRefresh = Boolean(opts.forceRefresh);
    const observedAt = opts.observedAt ?? new Date();
    const scanDate = utcDayStart(observedAt);
    const timingDebug =
      (process.env.MARKET_NPC_GATHER_TIMING_DEBUG ?? '').toLowerCase() ===
        'true' ||
      process.env.MARKET_NPC_GATHER_TIMING_DEBUG === '1' ||
      process.env.MARKET_NPC_GATHER_TIMING_DEBUG === 'yes';

    type TimingStat = { sumMs: number; calls: number; maxMs: number };
    const timings: Record<string, TimingStat> = {};
    const recordTiming = (label: string, ms: number) => {
      const cur = timings[label] ?? { sumMs: 0, calls: 0, maxMs: 0 };
      cur.sumMs += ms;
      cur.calls += 1;
      if (ms > cur.maxMs) cur.maxMs = ms;
      timings[label] = cur;
    };
    const timed = async <T>(
      label: string,
      fn: () => Promise<T>,
    ): Promise<T> => {
      const s = Date.now();
      try {
        return await fn();
      } finally {
        recordTiming(label, Date.now() - s);
      }
    };
    const timedSync = <T>(label: string, fn: () => T): T => {
      const s = Date.now();
      try {
        return fn();
      } finally {
        recordTiming(label, Date.now() - s);
      }
    };

    const startEsiMetrics = this.esi.getMetricsSnapshot();

    const station = await timed('db.resolveStation', async () => {
      return await this.prisma.stationId.findUnique({
        where: { id: stationId },
        select: {
          id: true,
          name: true,
          solarSystem: { select: { regionId: true } },
        },
      });
    });
    if (!station) throw new Error(`Station ${stationId} not found in DB`);
    const regionId = station.solarSystem.regionId;

    const baselineId = randomUUID();
    const reqId = `npc-market:${stationId}:${baselineId}`;

    // Create run record early so we can mark failures cleanly.
    await this.prisma.npcMarketRun
      .create({
        data: {
          baselineId,
          stationId,
          regionId,
          startedAt: new Date(startedAt),
          ok: false,
        },
      })
      .catch(() => undefined);

    try {
      const prevBaseline = await timed('db.loadPrevBaseline', async () => {
        return await this.prisma.npcMarketStationBaseline.findUnique({
          where: { stationId },
          select: { baselineId: true, observedAt: true },
        });
      });
      const hadPreviousBaseline = Boolean(prevBaseline?.baselineId);

      const prevObservedAt = prevBaseline?.observedAt ?? observedAt;
      const prevBaselineId = prevBaseline?.baselineId ?? null;

      const typeIds = await timed('esi.regionTypes', async () => {
        return await this.fetchAllRegionTypes({
          regionId,
          forceRefresh,
          reqId,
        });
      });

      // Load previous snapshots in one DB query (keyed by type+side) to avoid N queries.
      const prevSnapByKey = new Map<string, RegionMarketOrder[]>();
      if (prevBaselineId) {
        const prevSnaps = await timed('db.loadPrevSnapshots', async () => {
          return await this.prisma.npcMarketSnapshot.findMany({
            where: { stationId, baselineId: prevBaselineId },
            select: { typeId: true, isBuyOrder: true, orders: true },
          });
        });
        for (const s of prevSnaps) {
          const key = `${s.typeId}:${s.isBuyOrder ? 'B' : 'S'}`;
          const orders = (s.orders ?? []) as unknown as RegionMarketOrder[];
          prevSnapByKey.set(key, Array.isArray(orders) ? orders : []);
        }
      }

      const aggs = new Map<AggKey, Agg>();

      // Batch DB writes for snapshots to avoid 2 writes per type.
      // This is independent from EsiService concurrency (network); it reduces DB write overhead
      // while keeping RAM bounded (we flush frequently).
      // Larger batches reduce DB overhead significantly; values are small because
      // each row contains JSONB order arrays. 1000 rows ≈ 500 types (sell+buy).
      const snapshotBatchSize = 1000;
      const snapshotBuffer: Array<{
        stationId: number;
        regionId: number;
        baselineId: string;
        observedAt: Date;
        typeId: number;
        isBuyOrder: boolean;
        orderCount: number;
        bestPrice: Prisma.Decimal | null;
        orders: object;
      }> = [];
      let snapshotFlushChain: Promise<void> = Promise.resolve();
      let snapshotFlushes = 0;
      let snapshotRowsWritten = 0;
      let totalSellOrders = 0;
      let totalBuyOrders = 0;

      const flushSnapshotBuffer = async (): Promise<void> => {
        if (!snapshotBuffer.length) return;
        const batch = snapshotBuffer.splice(0, snapshotBuffer.length);
        await timed('db.snapshotFlush', async () => {
          await this.prisma.npcMarketSnapshot.createMany({ data: batch });
        });
        snapshotFlushes += 1;
        snapshotRowsWritten += batch.length;
      };

      const enqueueSnapshots = async (
        rows: Array<{
          stationId: number;
          regionId: number;
          baselineId: string;
          observedAt: Date;
          typeId: number;
          isBuyOrder: boolean;
          orderCount: number;
          bestPrice: Prisma.Decimal | null;
          orders: object;
        }>,
      ): Promise<void> => {
        // Serialize buffer mutation + flush decisions to keep it safe with concurrent processType.
        snapshotFlushChain = snapshotFlushChain.then(async () => {
          snapshotBuffer.push(...rows);
          if (snapshotBuffer.length >= snapshotBatchSize) {
            await flushSnapshotBuffer();
          }
        });
        await snapshotFlushChain;
      };

      // Fire off per-type work concurrently; EsiService already enforces global request concurrency.
      const processType = async (typeId: number): Promise<void> => {
        const { sell, buy } = await timed('esi.orders', async () => {
          return await this.fetchStationOrdersForTypeAllSides({
            regionId,
            stationId,
            typeId,
            forceRefresh,
            reqId,
          });
        });

        const sellStats = computeSnapshotStats(sell, false);
        const buyStats = computeSnapshotStats(buy, true);
        totalSellOrders += sellStats.orderCount;
        totalBuyOrders += buyStats.orderCount;

        // Persist snapshots immediately (keyed by baselineId). The baseline pointer is only
        // advanced after the full run completes successfully, so partial failures won't corrupt
        // the active baseline.
        await enqueueSnapshots([
          {
            stationId,
            regionId,
            baselineId,
            observedAt,
            typeId,
            isBuyOrder: false,
            orderCount: sellStats.orderCount,
            bestPrice: sellStats.bestPrice,
            orders: sell as unknown as object,
          },
          {
            stationId,
            regionId,
            baselineId,
            observedAt,
            typeId,
            isBuyOrder: true,
            orderCount: buyStats.orderCount,
            bestPrice: buyStats.bestPrice,
            orders: buy as unknown as object,
          },
        ]);

        if (!prevBaselineId) return; // first baseline: no diffs/aggregates

        timedSync('cpu.diffAndAgg', () => {
          for (const { isBuyOrder, currOrders } of [
            { isBuyOrder: false, currOrders: sell },
            { isBuyOrder: true, currOrders: buy },
          ]) {
            const prevKey = `${typeId}:${isBuyOrder ? 'B' : 'S'}`;
            const prevOrders = prevSnapByKey.get(prevKey) ?? [];
            if (!prevOrders.length && !currOrders.length) continue;

            const prevById = new Map<number, RegionMarketOrder>();
            for (const o of prevOrders) {
              if (o && typeof o.order_id === 'number')
                prevById.set(o.order_id, o);
            }
            const currById = new Map<number, RegionMarketOrder>();
            for (const o of currOrders) {
              if (o && typeof o.order_id === 'number')
                currById.set(o.order_id, o);
            }

            // Deltas contribute to both bounds
            for (const [orderId, curr] of currById.entries()) {
              const prev = prevById.get(orderId);
              if (!prev) continue;
              const delta =
                Number(prev.volume_remain) - Number(curr.volume_remain);
              if (!Number.isFinite(delta) || delta <= 0) continue;
              const price = toDecimal(prev.price ?? curr.price);
              const amountDelta = BigInt(Math.floor(delta));

              this.addToAgg(aggs, {
                scanDate,
                stationId,
                typeId,
                isBuyOrder,
                hasGone: false,
                amountDelta,
                orderNumDelta: 1n,
                price,
              });
              this.addToAgg(aggs, {
                scanDate,
                stationId,
                typeId,
                isBuyOrder,
                hasGone: true,
                amountDelta,
                orderNumDelta: 1n,
                price,
              });
            }

            // Disappeared orders contribute to upper-bound (excluding likely-expired)
            for (const [orderId, prev] of prevById.entries()) {
              if (currById.has(orderId)) continue;
              const issued = new Date(prev.issued);
              if (Number.isNaN(issued.getTime())) continue;
              const durationDays = Number(prev.duration);
              if (!Number.isFinite(durationDays) || durationDays <= 0) continue;
              const expired = this.likelyExpired({
                issued,
                durationDays,
                prevObservedAt,
                observedAt,
                expiryWindowMinutes: cfg.expiryWindowMinutes,
              });
              if (expired) continue;
              const remaining = Number(prev.volume_remain);
              if (!Number.isFinite(remaining) || remaining <= 0) continue;
              const price = toDecimal(prev.price);
              const amountDelta = BigInt(Math.floor(remaining));
              this.addToAgg(aggs, {
                scanDate,
                stationId,
                typeId,
                isBuyOrder,
                hasGone: true,
                amountDelta,
                orderNumDelta: 1n,
                price,
              });
            }
          }
        });
      };

      await timed('run.processAllTypes', async () => {
        await Promise.all(typeIds.map((t) => processType(t)));
      });
      // Flush any remaining snapshot rows.
      await timed('db.snapshotFlushFinalize', async () => {
        await snapshotFlushChain;
        await flushSnapshotBuffer();
      });

      // Persist only after we have completed the full type list.
      await timed('db.finalizeTransaction', async () => {
        await this.prisma.$transaction(
          async (tx) => {
            await tx.npcMarketRegionTypesSnapshot.create({
              data: {
                regionId,
                baselineId,
                observedAt,
                typeIds: typeIds as unknown as object,
              },
            });

            // Merge daily aggregates (if we had a previous baseline; otherwise we collected baseline only)
            if (hadPreviousBaseline) {
              for (const agg of aggs.values()) {
                const where = {
                  scanDate_stationId_typeId_isBuyOrder_hasGone: {
                    scanDate: agg.scanDate,
                    stationId: agg.stationId,
                    typeId: agg.typeId,
                    isBuyOrder: agg.isBuyOrder,
                    hasGone: agg.hasGone,
                  },
                } as const;

                const existing = await tx.npcMarketOrderTradeDaily.findUnique({
                  where,
                  select: {
                    amount: true,
                    iskValue: true,
                    high: true,
                    low: true,
                    orderNum: true,
                  },
                });

                if (!existing) {
                  const avg =
                    agg.amount > 0n
                      ? agg.iskValue.div(
                          new Prisma.Decimal(agg.amount.toString()),
                        )
                      : new Prisma.Decimal('0');
                  await tx.npcMarketOrderTradeDaily.create({
                    data: {
                      scanDate: agg.scanDate,
                      stationId: agg.stationId,
                      typeId: agg.typeId,
                      isBuyOrder: agg.isBuyOrder,
                      hasGone: agg.hasGone,
                      amount: agg.amount,
                      orderNum: agg.orderNum,
                      iskValue: agg.iskValue,
                      high: agg.high,
                      low: agg.low,
                      avg,
                    },
                  });
                  continue;
                }

                const newAmount = existing.amount + agg.amount;
                const newIsk = existing.iskValue.add(agg.iskValue);
                const newOrderNum = existing.orderNum + agg.orderNum;
                const newHigh = maxDec(existing.high, agg.high);
                const newLow = minDec(existing.low, agg.low);
                const newAvg =
                  newAmount > 0n
                    ? newIsk.div(new Prisma.Decimal(newAmount.toString()))
                    : new Prisma.Decimal('0');

                await tx.npcMarketOrderTradeDaily.update({
                  where,
                  data: {
                    amount: newAmount,
                    iskValue: newIsk,
                    orderNum: newOrderNum,
                    high: newHigh,
                    low: newLow,
                    avg: newAvg,
                  },
                });
              }
            }

            await tx.npcMarketStationBaseline.upsert({
              where: { stationId },
              create: { stationId, regionId, baselineId, observedAt },
              update: { regionId, baselineId, observedAt },
            });

            await tx.npcMarketRun.updateMany({
              where: { baselineId },
              data: {
                finishedAt: new Date(),
                ok: true,
                typeCount: typeIds.length,
              },
            });
          },
          { timeout: 120_000, maxWait: 10_000 },
        );
      });

      this.markSuccess();
      const durationMs = Date.now() - startedAt;
      const endEsiMetrics = this.esi.getMetricsSnapshot();
      const esiDelta = {
        http200: endEsiMetrics.http200 - startEsiMetrics.http200,
        http304: endEsiMetrics.http304 - startEsiMetrics.http304,
        http401: endEsiMetrics.http401 - startEsiMetrics.http401,
        http420: endEsiMetrics.http420 - startEsiMetrics.http420,
        cacheHitMem: endEsiMetrics.cacheHitMem - startEsiMetrics.cacheHitMem,
        cacheHitDb: endEsiMetrics.cacheHitDb - startEsiMetrics.cacheHitDb,
        cacheMiss: endEsiMetrics.cacheMiss - startEsiMetrics.cacheMiss,
      };
      this.logger.log(
        `NPC market collect ok: station=${stationId} (${station.name}) region=${regionId} types=${typeIds.length} durationMs=${durationMs} keys=${aggs.size} baseline=${baselineId}`,
      );

      const timingSummary = Object.fromEntries(
        Object.entries(timings).map(([k, v]) => [
          k,
          {
            ms: v.sumMs,
            calls: v.calls,
            avgMs: Math.round(v.sumMs / Math.max(1, v.calls)),
            maxMs: v.maxMs,
          },
        ]),
      );

      this.logger.log(
        `NPC market timings: totalMs=${durationMs} steps=${JSON.stringify(
          timingSummary,
        )} snapshotsWritten=${snapshotRowsWritten} snapshotFlushes=${snapshotFlushes} stationOrdersSell=${totalSellOrders} stationOrdersBuy=${totalBuyOrders} esiDelta=${JSON.stringify(
          esiDelta,
        )}`,
      );
      if (timingDebug) {
        this.logger.debug(
          `NPC market timing debug: effectiveMaxConcurrency=${endEsiMetrics.effectiveMaxConcurrency} inflight=${endEsiMetrics.inflightSize} memCache=${endEsiMetrics.memCacheSize}`,
        );
      }
      return {
        ok: true,
        stationId,
        regionId,
        baselineId,
        observedAt: observedAt.toISOString(),
        typeCount: typeIds.length,
        durationMs,
        aggregateKeys: aggs.size,
        hadPreviousBaseline,
      };
    } catch (e) {
      let msg = e instanceof Error ? e.message : String(e ?? 'unknown');
      // Friendly message for common local-dev failure: DB schema behind migrations.
      if (
        msg.includes('order_count') &&
        msg.toLowerCase().includes('does not exist')
      ) {
        msg =
          'Database schema is behind migrations (missing npc_market_snapshots.order_count). ' +
          'Run pnpm db:migrate:dev (or db:migrate:deploy) and restart the API.';
      }
      this.logger.warn(
        `NPC market collect failed: station=${stationId} ${msg}`,
      );
      await this.prisma.npcMarketRun
        .updateMany({
          where: { baselineId },
          data: { finishedAt: new Date(), ok: false, errorMessage: msg },
        })
        .catch(() => undefined);

      if (this.shouldNotifyFailure(new Date())) {
        const notifyUserId = cfg.notifyUserId;
        if (notifyUserId) {
          await this.notifications
            .sendSystemAlertDm({
              userId: notifyUserId,
              title: 'NPC market self-gathering warning',
              lines: [`StationId: ${stationId}`, `Error: ${msg}`],
            })
            .catch(() => undefined);
        }
      }
      throw e;
    }
  }
}
