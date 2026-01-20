import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { EsiService } from '@api/esi/esi.service';
import { AppConfig } from '@api/common/config';
import { Prisma } from '@eve/prisma';

type StructureMarketOrder = {
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
  locationId: bigint;
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
  // Price values are integer ISK in ESI for structure orders.
  return new Prisma.Decimal(n.toFixed(2));
}

function maxDec(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.greaterThan(b) ? a : b;
}

function minDec(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.lessThan(b) ? a : b;
}

@Injectable()
export class SelfMarketCollectorService {
  private readonly logger = new Logger(SelfMarketCollectorService.name);

  // Simple in-memory failure throttle to avoid DM spam.
  private consecutiveFailures = 0;
  private lastNotifyAt: number | null = null; // epoch ms

  constructor(
    private readonly prisma: PrismaService,
    private readonly esi: EsiService,
  ) {}

  private buildAggKey(params: {
    scanDate: Date;
    locationId: bigint;
    typeId: number;
    isBuyOrder: boolean;
    hasGone: boolean;
  }): AggKey {
    return [
      params.scanDate.toISOString().slice(0, 10),
      params.locationId.toString(),
      String(params.typeId),
      params.isBuyOrder ? 'B' : 'S',
      params.hasGone ? 'G1' : 'G0',
    ].join(':');
  }

  private addToAgg(
    map: Map<AggKey, Agg>,
    params: {
      scanDate: Date;
      locationId: bigint;
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
        locationId: params.locationId,
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

  /**
   * Returns whether a disappeared order is likely to have expired (not filled)
   * based on computed expiresAt and the polling interval window.
   */
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

    // Disappearance occurred in (prevObservedAt, observedAt]. If expiresAt is near that window,
    // treat as likely expired and DO NOT count as a fill in upper-bound mode.
    return expiresAtMs >= prevMs - w && expiresAtMs <= nowMs + w;
  }

  async collectStructureOnce(opts?: {
    forceRefresh?: boolean;
    observedAt?: Date;
  }): Promise<{
    ok: true;
    observedAt: Date;
    orderCount: number;
    tradesKeys: number;
  }> {
    const cfg = AppConfig.marketSelfGather();
    if (!cfg.structureId) {
      throw new Error('MARKET_SELF_GATHER_STRUCTURE_ID is not configured');
    }
    if (!cfg.characterId) {
      throw new Error('MARKET_SELF_GATHER_CHARACTER_ID is not configured');
    }

    const locationId = cfg.structureId;
    const observedAt = opts?.observedAt ?? new Date();
    const scanDate = utcDayStart(observedAt);

    const path = `/latest/markets/structures/${locationId.toString()}/`;
    const forceRefresh = Boolean(opts?.forceRefresh);

    // Structure orders are paginated (1000/page). Fetch all pages so "totalOrders"
    // in the UI reflects the real snapshot size.
    const first = await this.esi.fetchPaged<StructureMarketOrder[]>(path, {
      characterId: cfg.characterId,
      forceRefresh,
      page: 1,
    });
    const currentOrders: StructureMarketOrder[] = Array.isArray(first.data)
      ? [...first.data]
      : [];

    const totalPages = first.totalPages ?? 1;
    for (let page = 2; page <= totalPages; page++) {
      const { data } = await this.esi.fetchJson<StructureMarketOrder[]>(path, {
        characterId: cfg.characterId,
        forceRefresh,
        query: { page },
      });
      if (Array.isArray(data) && data.length) currentOrders.push(...data);
    }
    const prevSnap = await this.prisma.selfMarketSnapshotLatest.findUnique({
      where: { locationId },
      select: { observedAt: true, orders: true },
    });

    const prevObservedAt = prevSnap?.observedAt ?? observedAt;
    const prevOrders = (prevSnap?.orders ??
      []) as unknown as StructureMarketOrder[];

    const prevById = new Map<number, StructureMarketOrder>();
    for (const o of prevOrders) {
      if (o && typeof o.order_id === 'number') prevById.set(o.order_id, o);
    }

    const currById = new Map<number, StructureMarketOrder>();
    for (const o of currentOrders) {
      if (o && typeof o.order_id === 'number') currById.set(o.order_id, o);
    }

    const aggs = new Map<AggKey, Agg>();

    // Deltas (contribute to both lower and upper bounds)
    for (const [orderId, curr] of currById.entries()) {
      const prev = prevById.get(orderId);
      if (!prev) continue;
      const delta = Number(prev.volume_remain) - Number(curr.volume_remain);
      if (!Number.isFinite(delta) || delta <= 0) continue;
      const typeId = Number(curr.type_id);
      const isBuyOrder = Boolean(curr.is_buy_order);
      const price = toDecimal(prev.price ?? curr.price);
      const amountDelta = BigInt(Math.floor(delta));

      // lower-bound
      this.addToAgg(aggs, {
        scanDate,
        locationId,
        typeId,
        isBuyOrder,
        hasGone: false,
        amountDelta,
        orderNumDelta: 1n,
        price,
      });
      // upper-bound
      this.addToAgg(aggs, {
        scanDate,
        locationId,
        typeId,
        isBuyOrder,
        hasGone: true,
        amountDelta,
        orderNumDelta: 1n,
        price,
      });
    }

    // Disappeared orders (upper-bound only; exclude likely-expired)
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

      const typeId = Number(prev.type_id);
      const isBuyOrder = Boolean(prev.is_buy_order);
      const price = toDecimal(prev.price);
      const amountDelta = BigInt(Math.floor(remaining));

      this.addToAgg(aggs, {
        scanDate,
        locationId,
        typeId,
        isBuyOrder,
        hasGone: true,
        amountDelta,
        orderNumDelta: 1n,
        price,
      });
    }

    // Now that we fetch full paginated snapshots, the aggregate merge can take
    // >5s on larger structures. Increase interactive transaction timeout to
    // avoid "expired transaction" errors.
    await this.prisma.$transaction(
      async (tx) => {
        await tx.selfMarketSnapshotLatest.upsert({
          where: { locationId },
          create: {
            locationId,
            observedAt,
            orders: currentOrders as unknown as object,
          },
          update: { observedAt, orders: currentOrders as unknown as object },
        });

        for (const agg of aggs.values()) {
          const where = {
            scanDate_locationId_typeId_isBuyOrder_hasGone: {
              scanDate: agg.scanDate,
              locationId: agg.locationId,
              typeId: agg.typeId,
              isBuyOrder: agg.isBuyOrder,
              hasGone: agg.hasGone,
            },
          } as const;

          const existing = await tx.selfMarketOrderTradeDaily.findUnique({
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
                ? agg.iskValue.div(new Prisma.Decimal(agg.amount.toString()))
                : new Prisma.Decimal('0');
            await tx.selfMarketOrderTradeDaily.create({
              data: {
                scanDate: agg.scanDate,
                locationId: agg.locationId,
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

          await tx.selfMarketOrderTradeDaily.update({
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
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    return {
      ok: true,
      observedAt,
      orderCount: currentOrders.length,
      tradesKeys: aggs.size,
    };
  }

  /**
   * Helper for JobsService: track failures and decide when to notify.
   */
  shouldNotifyFailure(now: Date): boolean {
    const cfg = AppConfig.marketSelfGather();
    this.consecutiveFailures++;
    // Notify on 3rd consecutive failure, then at most once per hour thereafter.
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
}
