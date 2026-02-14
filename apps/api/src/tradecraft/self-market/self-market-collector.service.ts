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
    const t0 = Date.now();
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

    // Fail fast with a helpful message instead of an opaque ESI 401.
    // Structure market requires a token that includes esi-markets.structure_markets.v1
    const requiredScope = 'esi-markets.structure_markets.v1';
    const tTokenStart = Date.now();
    const token = await this.prisma.characterToken.findUnique({
      where: { characterId: cfg.characterId },
      select: { scopes: true, refreshTokenEnc: true },
    });
    const tTokenEnd = Date.now();
    if (!token) {
      throw new Error(
        `No token found for MARKET_SELF_GATHER_CHARACTER_ID=${cfg.characterId}. ` +
          `Set MARKET_SELF_GATHER_CHARACTER_ID to a linked character with structure market access.`,
      );
    }
    const scopes = (token.scopes ?? '')
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!scopes.includes(requiredScope)) {
      throw new Error(
        `Character ${cfg.characterId} is missing required ESI scope "${requiredScope}" for structure market collection. ` +
          `Re-link that character with the correct scopes (or choose another character).`,
      );
    }
    if (!token.refreshTokenEnc || token.refreshTokenEnc.trim().length === 0) {
      throw new Error(
        `Character ${cfg.characterId} has no refresh token stored. Re-link the character so the API can refresh access tokens.`,
      );
    }

    const path = `/latest/markets/structures/${locationId.toString()}/`;
    const forceRefresh = Boolean(opts?.forceRefresh);

    // Structure orders are paginated (1000/page). Fetch all pages so "totalOrders"
    // in the UI reflects the real snapshot size.
    const tFetchStart = Date.now();
    const first = await this.esi.fetchPaged<StructureMarketOrder[]>(path, {
      characterId: cfg.characterId,
      forceRefresh,
      page: 1,
    });
    const currentOrders: StructureMarketOrder[] = Array.isArray(first.data)
      ? [...first.data]
      : [];

    const totalPages = first.totalPages ?? 1;
    if (totalPages > 1) {
      // Full parallelization: allow EsiService to do concurrency/rate-budget control.
      const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const results = await Promise.all(
        pages.map((page) =>
          this.esi.fetchJson<StructureMarketOrder[]>(path, {
            characterId: cfg.characterId ?? undefined,
            forceRefresh,
            query: { page },
          }),
        ),
      );
      for (const r of results) {
        if (Array.isArray(r.data) && r.data.length)
          currentOrders.push(...r.data);
      }
    }
    const tFetchEnd = Date.now();
    const tPrevStart = Date.now();
    const prevSnap = await this.prisma.selfMarketSnapshotLatest.findUnique({
      where: { locationId },
      select: { observedAt: true, orders: true },
    });
    const tPrevEnd = Date.now();

    const prevObservedAt = prevSnap?.observedAt ?? observedAt;
    const prevOrders = (prevSnap?.orders ??
      []) as unknown as StructureMarketOrder[];

    const tDiffStart = Date.now();
    const prevById = new Map<number, StructureMarketOrder>();
    for (const o of prevOrders) {
      if (o && typeof o.order_id === 'number') prevById.set(o.order_id, o);
    }

    const currById = new Map<number, StructureMarketOrder>();
    for (const o of currentOrders) {
      if (o && typeof o.order_id === 'number') currById.set(o.order_id, o);
    }

    const aggs = new Map<AggKey, Agg>();

    // Fast path: if the snapshot is bitwise-equivalent (for our purposes), skip
    // aggregate computation and avoid rewriting the large JSONB `orders` payload.
    let snapshotUnchanged = Boolean(prevSnap) && prevById.size === currById.size;
    if (snapshotUnchanged) {
      for (const [orderId, prev] of prevById.entries()) {
        const curr = currById.get(orderId);
        if (!curr) {
          snapshotUnchanged = false;
          break;
        }
        // Compare only the fields that matter for diff/trade deduction.
        if (
          prev.volume_remain !== curr.volume_remain ||
          prev.volume_total !== curr.volume_total ||
          prev.price !== curr.price ||
          prev.is_buy_order !== curr.is_buy_order ||
          prev.type_id !== curr.type_id
        ) {
          snapshotUnchanged = false;
          break;
        }
      }
    }

    if (!snapshotUnchanged) {
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
    }
    const tDiffEnd = Date.now();

    // Now that we fetch full paginated snapshots, the aggregate merge can take
    // >5s on larger structures. Increase interactive transaction timeout to
    // avoid "expired transaction" errors.
    const tDbStart = Date.now();
    let dbSnapMs = 0;
    let dbAggMs = 0;
    await this.prisma.$transaction(
      async (tx) => {
        const tSnapStart = Date.now();
        if (snapshotUnchanged && prevSnap) {
          await tx.selfMarketSnapshotLatest.update({
            where: { locationId },
            data: { observedAt },
          });
        } else {
          await tx.selfMarketSnapshotLatest.upsert({
            where: { locationId },
            create: {
              locationId,
              observedAt,
              orders: currentOrders as unknown as object,
            },
            update: { observedAt, orders: currentOrders as unknown as object },
          });
        }
        dbSnapMs = Date.now() - tSnapStart;

        const tAggStart = Date.now();
        const aggRows = Array.from(aggs.values());
        const chunkSize = 500;
        for (let i = 0; i < aggRows.length; i += chunkSize) {
          const chunk = aggRows.slice(i, i + chunkSize);
          if (chunk.length === 0) continue;

          const values = chunk.map((agg) => {
            const avg =
              agg.amount > 0n
                ? agg.iskValue.div(new Prisma.Decimal(agg.amount.toString()))
                : new Prisma.Decimal('0');
            return Prisma.sql`(
              ${agg.scanDate},
              ${agg.locationId},
              ${agg.typeId},
              ${agg.isBuyOrder},
              ${agg.hasGone},
              ${agg.amount},
              ${agg.orderNum},
              ${agg.iskValue},
              ${agg.high},
              ${agg.low},
              ${avg},
              NOW()
            )`;
          });

          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO self_market_order_trades_daily
                (scan_date, location_id, type_id, is_buy_order, has_gone, amount, order_num, isk_value, high, low, avg, updated_at)
              VALUES
                ${Prisma.join(values)}
              ON CONFLICT (scan_date, location_id, type_id, is_buy_order, has_gone)
              DO UPDATE SET
                amount = self_market_order_trades_daily.amount + EXCLUDED.amount,
                order_num = self_market_order_trades_daily.order_num + EXCLUDED.order_num,
                isk_value = self_market_order_trades_daily.isk_value + EXCLUDED.isk_value,
                high = GREATEST(self_market_order_trades_daily.high, EXCLUDED.high),
                low = LEAST(self_market_order_trades_daily.low, EXCLUDED.low),
                avg = CASE
                  WHEN (self_market_order_trades_daily.amount + EXCLUDED.amount) > 0
                    THEN (self_market_order_trades_daily.isk_value + EXCLUDED.isk_value)
                      / (self_market_order_trades_daily.amount + EXCLUDED.amount)
                  ELSE 0
                END,
                updated_at = NOW()
            `,
          );
        }
        dbAggMs = Date.now() - tAggStart;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    const tDbEnd = Date.now();

    this.logger.debug(
      `SelfMarket collect timings: token=${tTokenEnd - tTokenStart}ms ` +
        `fetch=${tFetchEnd - tFetchStart}ms ` +
        `prevSnap=${tPrevEnd - tPrevStart}ms ` +
        `diff=${tDiffEnd - tDiffStart}ms ` +
        `db=${tDbEnd - tDbStart}ms (dbSnap=${dbSnapMs}ms dbAgg=${dbAggMs}ms) ` +
        `total=${tDbEnd - t0}ms ` +
        `pages=${first.totalPages ?? 1} orders=${currentOrders.length} aggs=${aggs.size} unchanged=${String(snapshotUnchanged)} forceRefresh=${String(forceRefresh)}`,
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
