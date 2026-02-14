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

  /**
   * Fetch all regional market orders (paged), filter to the given station, and group by type + side.
   *
   * We fetch page 1 to obtain X-Pages, then fetch remaining pages concurrently.
   * Concurrency/rate-budget are centrally handled by EsiService.
   */
  private async fetchStationOrdersSnapshotFromRegion(params: {
    regionId: number;
    stationId: number;
    forceRefresh: boolean;
    reqId: string;
  }): Promise<{
    byType: Map<
      number,
      { sell: RegionMarketOrder[]; buy: RegionMarketOrder[] }
    >;
    totalPages: number;
  }> {
    const path = `/latest/markets/${params.regionId}/orders/`;
    const byType = new Map<
      number,
      { sell: RegionMarketOrder[]; buy: RegionMarketOrder[] }
    >();

    const ingest = (data: unknown) => {
      if (!Array.isArray(data)) return;
      for (const o of data as RegionMarketOrder[]) {
        if (!o) continue;
        if (o.location_id !== params.stationId) continue;
        if (!Number.isFinite(o.volume_remain) || o.volume_remain <= 0) continue;
        const typeId = Number(o.type_id);
        if (!Number.isFinite(typeId) || typeId <= 0) continue;

        let bucket = byType.get(typeId);
        if (!bucket) {
          bucket = { sell: [], buy: [] };
          byType.set(typeId, bucket);
        }
        if (o.is_buy_order) bucket.buy.push(o);
        else bucket.sell.push(o);
      }
    };

    const first = await this.esi.fetchPaged<RegionMarketOrder[]>(path, {
      page: 1,
      forceRefresh: params.forceRefresh,
      reqId: params.reqId,
      query: { order_type: 'all' },
    });
    ingest(first.data);

    const totalPages = first.totalPages ?? 1;
    if (totalPages > 1) {
      const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      await Promise.all(
        pages.map(async (page) => {
          const { data } = await this.esi.fetchJson<RegionMarketOrder[]>(path, {
            forceRefresh: params.forceRefresh,
            reqId: params.reqId,
            query: { order_type: 'all', page },
          });
          ingest(data);
        }),
      );
    }

    return { byType, totalPages };
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
    const t0 = Date.now();
    const startedAt = t0;
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

      let tFetchMs = 0;
      let tPrevMs = 0;
      let tProcessMs = 0;
      let tFlushFinalizeMs = 0;
      let tFinalizeTxMs = 0;

      const stationSnap = await timed('esi.regionOrdersAllPages', async () => {
        const s = Date.now();
        try {
          return await this.fetchStationOrdersSnapshotFromRegion({
            regionId,
            stationId,
            forceRefresh,
            reqId,
          });
        } finally {
          tFetchMs = Date.now() - s;
        }
      });
      const currentByType = stationSnap.byType;

      // Load previous snapshots in one DB query (keyed by type+side).
      // Optimization: load only non-empty snapshots (orderCount>0); empty prev snapshots carry no diff signal.
      const prevSnapByKey = new Map<string, RegionMarketOrder[]>();
      if (prevBaselineId) {
        const s = Date.now();
        const prevSnaps = await timed('db.loadPrevSnapshots', async () => {
          return await this.prisma.npcMarketSnapshot.findMany({
            where: {
              stationId,
              baselineId: prevBaselineId,
              orderCount: { gt: 0 },
            },
            select: { typeId: true, isBuyOrder: true, orders: true },
          });
        });
        tPrevMs = Date.now() - s;
        for (const s of prevSnaps) {
          const key = `${s.typeId}:${s.isBuyOrder ? 'B' : 'S'}`;
          const orders = (s.orders ?? []) as unknown as RegionMarketOrder[];
          prevSnapByKey.set(key, Array.isArray(orders) ? orders : []);
        }
      }

      // Process the union of:
      // - types present in current station orders
      // - types present in the previous non-empty baseline snapshots
      // so "gone" deltas are still detected.
      const typeIdsSet = new Set<number>();
      for (const typeId of currentByType.keys()) typeIdsSet.add(typeId);
      for (const k of prevSnapByKey.keys()) {
        const t = Number(k.split(':')[0] ?? '');
        if (Number.isFinite(t) && t > 0) typeIdsSet.add(t);
      }
      const typeIds = Array.from(typeIdsSet.values()).sort((a, b) => a - b);

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

      const processType = async (typeId: number): Promise<void> => {
        const bucket = currentByType.get(typeId);
        const sell = bucket?.sell ?? [];
        const buy = bucket?.buy ?? [];

        const sellStats = computeSnapshotStats(sell, false);
        const buyStats = computeSnapshotStats(buy, true);
        totalSellOrders += sellStats.orderCount;
        totalBuyOrders += buyStats.orderCount;

        // Persist snapshots (keyed by baselineId). Skip empty slices to reduce DB pressure.
        // We still persist an empty slice if the previous baseline had data for that slice,
        // so diffs/"gone" debugging remains possible.
        const prevSellKey = `${typeId}:S`;
        const prevBuyKey = `${typeId}:B`;
        const shouldWriteSell =
          sellStats.orderCount > 0 ||
          (prevBaselineId && (prevSnapByKey.get(prevSellKey) ?? []).length > 0);
        const shouldWriteBuy =
          buyStats.orderCount > 0 ||
          (prevBaselineId && (prevSnapByKey.get(prevBuyKey) ?? []).length > 0);

        if (shouldWriteSell) {
          snapshotBuffer.push({
            stationId,
            regionId,
            baselineId,
            observedAt,
            typeId,
            isBuyOrder: false,
            orderCount: sellStats.orderCount,
            bestPrice: sellStats.bestPrice,
            orders: sell as unknown as object,
          });
        }
        if (shouldWriteBuy) {
          snapshotBuffer.push({
            stationId,
            regionId,
            baselineId,
            observedAt,
            typeId,
            isBuyOrder: true,
            orderCount: buyStats.orderCount,
            bestPrice: buyStats.bestPrice,
            orders: buy as unknown as object,
          });
        }
        if (snapshotBuffer.length >= snapshotBatchSize) await flushSnapshotBuffer();

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
        const s = Date.now();
        // Local CPU + DB buffering only (network already done); keep predictable memory usage.
        for (const t of typeIds) {
          await processType(t);
        }
        tProcessMs = Date.now() - s;
      });
      // Flush any remaining snapshot rows.
      await timed('db.snapshotFlushFinalize', async () => {
        const s = Date.now();
        await flushSnapshotBuffer();
        tFlushFinalizeMs = Date.now() - s;
      });

      // Persist only after we have completed the full type list.
      await timed('db.finalizeTransaction', async () => {
        const s = Date.now();
        await this.prisma.$transaction(
          async (tx) => {
            await tx.npcMarketRegionTypesSnapshot.create({
              data: {
                regionId,
                baselineId,
                observedAt,
                // Historically this stored ESI /markets/{region}/types, which created a per-type request explosion.
                // Now it stores the set of typeIds we processed for this station baseline (current station orders + prev baseline non-empty types),
                // for reproducibility and to help debug diffs.
                typeIds: typeIds as unknown as object,
              },
            });

            // Merge daily aggregates (if we had a previous baseline; otherwise we collected baseline only)
            if (hadPreviousBaseline) {
              const aggRows = Array.from(aggs.values());
              const chunkSize = 500;
              for (let i = 0; i < aggRows.length; i += chunkSize) {
                const chunk = aggRows.slice(i, i + chunkSize);
                if (chunk.length === 0) continue;

                const values = chunk.map((agg) => {
                  const avg =
                    agg.amount > 0n
                      ? agg.iskValue.div(
                          new Prisma.Decimal(agg.amount.toString()),
                        )
                      : new Prisma.Decimal('0');
                  return Prisma.sql`(
                    ${agg.scanDate},
                    ${agg.stationId},
                    ${agg.typeId},
                    ${agg.isBuyOrder},
                    ${agg.hasGone},
                    ${agg.amount},
                    ${agg.high},
                    ${agg.low},
                    ${avg},
                    ${agg.orderNum},
                    ${agg.iskValue},
                    NOW()
                  )`;
                });

                await tx.$executeRaw(
                  Prisma.sql`
                    INSERT INTO npc_market_order_trades_daily
                      (scan_date, station_id, type_id, is_buy_order, has_gone, amount, high, low, avg, order_num, isk_value, updated_at)
                    VALUES
                      ${Prisma.join(values)}
                    ON CONFLICT (scan_date, station_id, type_id, is_buy_order, has_gone)
                    DO UPDATE SET
                      amount = npc_market_order_trades_daily.amount + EXCLUDED.amount,
                      order_num = npc_market_order_trades_daily.order_num + EXCLUDED.order_num,
                      isk_value = npc_market_order_trades_daily.isk_value + EXCLUDED.isk_value,
                      high = GREATEST(npc_market_order_trades_daily.high, EXCLUDED.high),
                      low = LEAST(npc_market_order_trades_daily.low, EXCLUDED.low),
                      avg = CASE
                        WHEN (npc_market_order_trades_daily.amount + EXCLUDED.amount) > 0
                          THEN (npc_market_order_trades_daily.isk_value + EXCLUDED.isk_value)
                            / (npc_market_order_trades_daily.amount + EXCLUDED.amount)
                        ELSE 0
                      END,
                      updated_at = NOW()
                  `,
                );
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
        tFinalizeTxMs = Date.now() - s;
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

      this.logger.debug(
        `NPC market collect timings: ` +
          `fetch=${tFetchMs}ms ` +
          `prevSnap=${tPrevMs}ms ` +
          `process=${tProcessMs}ms ` +
          `flushFinalize=${tFlushFinalizeMs}ms ` +
          `finalizeTx=${tFinalizeTxMs}ms ` +
          `total=${Date.now() - t0}ms ` +
          `pages=${stationSnap.totalPages} ` +
          `stationOrders=${totalSellOrders + totalBuyOrders} ` +
          `types=${typeIds.length} ` +
          `aggs=${aggs.size} ` +
          `forceRefresh=${String(forceRefresh)}`,
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
        )} snapshotsWritten=${snapshotRowsWritten} snapshotFlushes=${snapshotFlushes} stationOrdersSell=${totalSellOrders} stationOrdersBuy=${totalBuyOrders} esiPages=${stationSnap.totalPages} esiDelta=${JSON.stringify(
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
