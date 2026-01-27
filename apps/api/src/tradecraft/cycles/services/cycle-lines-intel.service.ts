import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { GameDataService } from '@api/game-data/services/game-data.service';
import { MarketDataService } from '@api/tradecraft/market/services/market-data.service';
import { getEffectiveSell } from '@api/tradecraft/market/fees';
import { AppConfig } from '@api/common/config';

type CycleIntelRow = {
  typeId: number;
  typeName: string;
  destinationStationId?: number;
  destinationStationName?: string;
  isRollover?: boolean;
  unitsBought: number;
  unitsSold: number;
  unitsRemaining: number;
  buyCostIsk: string;
  cogsSoldIsk: string;
  wacUnitCostIsk: string;
  salesNetIsk: string;
  feesIsk: string;
  profitIsk: string;
  inventoryCostRemainingIsk: string;
  // Expected profit from remaining inventory at current sell price (if available)
  expectedProfitIsk?: string;
  currentSellPriceIsk?: string | null;
  // Market-based risk info (if available)
  marketLowSellIsk?: string | null;
  estimatedMarginPercentAtMarket?: string | null;
  estimatedProfitAtMarketIsk?: string | null;
  // Internal classification helpers for global aggregation
  _isRed?: boolean;
  _hasListedPrice?: boolean;
};

type CycleIntelTotals = {
  unitsBought: number;
  unitsSold: number;
  unitsRemaining: number;
  buyCostIsk: string;
  cogsSoldIsk: string;
  inventoryCostRemainingIsk: string;
  salesNetIsk: string;
  feesIsk: string;
  profitIsk: string;
  expectedProfitIsk?: string;
  lossIsk?: string;
};

type CycleIntelBlock = {
  profitable: { rows: CycleIntelRow[]; totals: CycleIntelTotals };
  potential: { rows: CycleIntelRow[]; totals: CycleIntelTotals };
  red: { rows: CycleIntelRow[]; totals: CycleIntelTotals };
};

export type CycleLinesIntelResponse = {
  cycleId: string;
  global: CycleIntelBlock;
  destinations: Array<
    {
      destinationStationId: number;
      destinationStationName: string;
    } & CycleIntelBlock
  >;
};

@Injectable()
export class CycleLinesIntelService {
  private readonly logger = new Logger(CycleLinesIntelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameData: GameDataService,
    private readonly marketData: MarketDataService,
  ) {}

  private format2(n: number): string {
    return n.toFixed(2);
  }

  private sumTotals(rows: CycleIntelRow[]): CycleIntelTotals {
    const totals = rows.reduce(
      (acc, r) => {
        acc.unitsBought += r.unitsBought;
        acc.unitsSold += r.unitsSold;
        acc.unitsRemaining += r.unitsRemaining;
        acc.buyCostIsk += Number(r.buyCostIsk);
        acc.cogsSoldIsk += Number(r.cogsSoldIsk);
        acc.inventoryCostRemainingIsk += Number(r.inventoryCostRemainingIsk);
        acc.salesNetIsk += Number(r.salesNetIsk);
        acc.feesIsk += Number(r.feesIsk);
        acc.profitIsk += Number(r.profitIsk);
        acc.expectedProfitIsk += Number(r.expectedProfitIsk ?? 0);
        acc.lossIsk += Number(r.estimatedProfitAtMarketIsk ?? 0);
        return acc;
      },
      {
        unitsBought: 0,
        unitsSold: 0,
        unitsRemaining: 0,
        buyCostIsk: 0,
        cogsSoldIsk: 0,
        inventoryCostRemainingIsk: 0,
        salesNetIsk: 0,
        feesIsk: 0,
        profitIsk: 0,
        expectedProfitIsk: 0,
        lossIsk: 0,
      },
    );

    const out: CycleIntelTotals = {
      unitsBought: totals.unitsBought,
      unitsSold: totals.unitsSold,
      unitsRemaining: totals.unitsRemaining,
      buyCostIsk: this.format2(totals.buyCostIsk),
      cogsSoldIsk: this.format2(totals.cogsSoldIsk),
      inventoryCostRemainingIsk: this.format2(totals.inventoryCostRemainingIsk),
      salesNetIsk: this.format2(totals.salesNetIsk),
      feesIsk: this.format2(totals.feesIsk),
      profitIsk: this.format2(totals.profitIsk),
    };

    if (rows.some((r) => r.expectedProfitIsk !== undefined)) {
      out.expectedProfitIsk = this.format2(totals.expectedProfitIsk);
    }

    if (rows.some((r) => r.estimatedProfitAtMarketIsk !== undefined)) {
      out.lossIsk = this.format2(totals.lossIsk);
    }

    return out;
  }

  private buildBlock(params: {
    rows: CycleIntelRow[];
    redMarginThresholdPct: number;
  }): CycleIntelBlock {
    // "Profitable" means the position is completed (no remaining inventory) AND realized profit > 0.
    const profitable = params.rows
      .filter((r) => r.unitsRemaining === 0 && Number(r.profitIsk) > 0)
      .sort((a, b) => Number(b.profitIsk) - Number(a.profitIsk));

    // "Potential": not currently generating profit, but listed above breakeven
    const potential = params.rows
      .filter((r) => {
        const expected = Number(r.expectedProfitIsk ?? 0);
        const hasPrice = r._hasListedPrice === true;
        return r.unitsRemaining > 0 && expected > 0 && hasPrice;
      })
      .sort(
        (a, b) =>
          Number(b.expectedProfitIsk ?? 0) - Number(a.expectedProfitIsk ?? 0),
      );

    // "Red": negative margin at market (includes both yellow and red from undercut-checker logic)
    const red = params.rows
      .filter((r) => {
        if (r._isRed === true) return true;
        const m = r.estimatedMarginPercentAtMarket
          ? Number(r.estimatedMarginPercentAtMarket)
          : null;
        if (m === null || Number.isNaN(m)) return false;
        return m < 0;
      })
      .sort(
        (a, b) =>
          Number(a.estimatedProfitAtMarketIsk ?? 0) -
          Number(b.estimatedProfitAtMarketIsk ?? 0),
      );

    return {
      profitable: { rows: profitable, totals: this.sumTotals(profitable) },
      potential: { rows: potential, totals: this.sumTotals(potential) },
      red: { rows: red, totals: this.sumTotals(red) },
    };
  }

  /**
   * Returns cycle intelligence for the admin "lines" page:
   * - Global view aggregated by typeId
   * - Destination view aggregated by (destinationStationId, typeId)
   *
   * Notes:
   * - Profit uses realized profit: SalesNet - COGS - broker/relist fees (same as CycleLineService)
   * - Expected profit uses remaining inventory at *currentSellPriceIsk* when available
   * - "Red" uses live-ish market lowest sell at destination and evaluates margin at the next cheaper tick
   */
  async getCycleLinesIntel(cycleId: string): Promise<CycleLinesIntelResponse> {
    const feeDefaults = AppConfig.arbitrage().fees;
    const redMarginThresholdPct = -10;

    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: {
        typeId: true,
        destinationStationId: true,
        isRollover: true,
        unitsBought: true,
        unitsSold: true,
        buyCostIsk: true,
        salesNetIsk: true,
        brokerFeesIsk: true,
        relistFeesIsk: true,
        currentSellPriceIsk: true,
      },
    });

    const typeIds = Array.from(new Set(lines.map((l) => l.typeId)));
    const stationIds = Array.from(
      new Set(lines.map((l) => l.destinationStationId)),
    );

    // Market "low sell" per (station,type) for RED computation.
    // To keep the query fast, only compute this for lines that are BOTH remaining > 0 AND have a listed price.
    // (i.e. items actually being sold in that destination)
    const redPairs = Array.from(
      new Set(
        lines
          .filter(
            (l) =>
              Math.max(0, l.unitsBought - l.unitsSold) > 0 &&
              l.currentSellPriceIsk !== null,
          )
          .map((l) => `${l.destinationStationId}:${l.typeId}`),
      ),
    ).map((k) => {
      const [stationIdStr, typeIdStr] = k.split(':');
      return { stationId: Number(stationIdStr), typeId: Number(typeIdStr) };
    });

    const [
      typeNameById,
      stationNameById,
      stationsWithRegions,
      latestTradesByKey,
    ] = await Promise.all([
      this.gameData.getTypeNames(typeIds),
      this.gameData.getStationNames(stationIds),
      this.gameData.getStationsWithRegions(stationIds),
      // PERF: avoid cartesian filter on (locationId IN ... AND typeId IN ...) by joining exact pairs
      this.getLatestMarketTradesForPairsExact(redPairs),
    ]);

    const regionByStation = new Map<number, number>();
    for (const [stationId, data] of stationsWithRegions.entries()) {
      if (data.regionId) regionByStation.set(stationId, data.regionId);
    }

    // Build per-line base rows (not yet aggregated)
    const baseRows = lines.map((l) => {
      const unitsRemaining = Math.max(0, l.unitsBought - l.unitsSold);
      const wac = l.unitsBought > 0 ? Number(l.buyCostIsk) / l.unitsBought : 0;
      const cogs = wac * l.unitsSold;
      const fees = Number(l.brokerFeesIsk) + Number(l.relistFeesIsk);
      const profit = Number(l.salesNetIsk) - cogs - fees;
      const inventoryCostRemaining = wac * unitsRemaining;

      // Expected additional profit at currentSellPriceIsk (if any)
      const currentSellPrice = l.currentSellPriceIsk
        ? Number(l.currentSellPriceIsk)
        : null;
      let expectedProfit: number | null = null;
      if (unitsRemaining > 0 && currentSellPrice && wac > 0) {
        const gross = unitsRemaining * currentSellPrice;
        const salesTax = gross * (feeDefaults.salesTaxPercent / 100);
        const net = gross - salesTax;
        const costBasis = wac * unitsRemaining;
        expectedProfit = net - costBasis;
      }

      // Market-based "red" computation: estimate margin/profit if selling remaining at market low.
      // We use the latest scanned daily low as a low-cost proxy to avoid live ESI station order scans.
      let marketLow: number | null = null;
      let marginPctAtMarket: number | null = null;
      let profitAtMarket: number | null = null;
      let isRed = false;

      const hasListedPrice = currentSellPrice !== null;
      if (unitsRemaining > 0 && wac > 0 && hasListedPrice) {
        const dailyKey = `${l.destinationStationId}:${l.typeId}`;
        const latest = latestTradesByKey.get(dailyKey) ?? null;
        marketLow = latest ? Number(latest.low) : null;
        if (marketLow !== null && marketLow > 0) {
          const effectiveSell = getEffectiveSell(marketLow, feeDefaults);
          const profitPerUnit = effectiveSell - wac;
          profitAtMarket = profitPerUnit * unitsRemaining;
          marginPctAtMarket = (profitPerUnit / wac) * 100;
          isRed = marginPctAtMarket < 0;
        }
      }

      return {
        typeId: l.typeId,
        typeName: typeNameById.get(l.typeId) ?? `Type ${l.typeId}`,
        destinationStationId: l.destinationStationId,
        destinationStationName:
          stationNameById.get(l.destinationStationId) ??
          `Station ${l.destinationStationId}`,
        isRollover: l.isRollover,
        unitsBought: l.unitsBought,
        unitsSold: l.unitsSold,
        unitsRemaining,
        buyCostIsk: this.format2(Number(l.buyCostIsk)),
        cogsSoldIsk: this.format2(cogs),
        wacUnitCostIsk: this.format2(wac),
        salesNetIsk: this.format2(Number(l.salesNetIsk)),
        feesIsk: this.format2(fees),
        profitIsk: this.format2(profit),
        inventoryCostRemainingIsk: this.format2(inventoryCostRemaining),
        expectedProfitIsk:
          expectedProfit !== null ? this.format2(expectedProfit) : undefined,
        currentSellPriceIsk:
          currentSellPrice !== null ? this.format2(currentSellPrice) : null,
        marketLowSellIsk: marketLow !== null ? this.format2(marketLow) : null,
        estimatedMarginPercentAtMarket:
          marginPctAtMarket !== null ? this.format2(marginPctAtMarket) : null,
        estimatedProfitAtMarketIsk:
          profitAtMarket !== null ? this.format2(profitAtMarket) : null,
        _isRed: isRed,
        _hasListedPrice: hasListedPrice,
      } satisfies CycleIntelRow;
    });

    // Aggregate global by typeId
    const globalByType = new Map<number, CycleIntelRow>();
    for (const r of baseRows) {
      const existing = globalByType.get(r.typeId);
      if (!existing) {
        globalByType.set(r.typeId, {
          typeId: r.typeId,
          typeName: r.typeName,
          // Tri-state: true=all rollover, false=all new, undefined=mixed
          isRollover: r.isRollover,
          unitsBought: r.unitsBought,
          unitsSold: r.unitsSold,
          unitsRemaining: r.unitsRemaining,
          buyCostIsk: r.buyCostIsk,
          cogsSoldIsk: r.cogsSoldIsk,
          wacUnitCostIsk: r.wacUnitCostIsk,
          salesNetIsk: r.salesNetIsk,
          feesIsk: r.feesIsk,
          profitIsk: r.profitIsk,
          inventoryCostRemainingIsk: r.inventoryCostRemainingIsk,
          expectedProfitIsk: r.expectedProfitIsk,
          currentSellPriceIsk: undefined, // meaningless at global level
          marketLowSellIsk: undefined,
          estimatedMarginPercentAtMarket: undefined,
          estimatedProfitAtMarketIsk: r.estimatedProfitAtMarketIsk,
          _isRed: r._isRed,
          _hasListedPrice: r._hasListedPrice,
        });
        continue;
      }

      existing.unitsBought += r.unitsBought;
      existing.unitsSold += r.unitsSold;
      existing.unitsRemaining += r.unitsRemaining;
      existing.buyCostIsk = this.format2(
        Number(existing.buyCostIsk) + Number(r.buyCostIsk),
      );
      existing.cogsSoldIsk = this.format2(
        Number(existing.cogsSoldIsk) + Number(r.cogsSoldIsk),
      );
      existing.salesNetIsk = this.format2(
        Number(existing.salesNetIsk) + Number(r.salesNetIsk),
      );
      existing.feesIsk = this.format2(
        Number(existing.feesIsk) + Number(r.feesIsk),
      );
      existing.profitIsk = this.format2(
        Number(existing.profitIsk) + Number(r.profitIsk),
      );
      existing.inventoryCostRemainingIsk = this.format2(
        Number(existing.inventoryCostRemainingIsk) +
          Number(r.inventoryCostRemainingIsk),
      );

      if (
        existing.expectedProfitIsk !== undefined ||
        r.expectedProfitIsk !== undefined
      ) {
        existing.expectedProfitIsk = this.format2(
          Number(existing.expectedProfitIsk ?? 0) +
            Number(r.expectedProfitIsk ?? 0),
        );
      }

      if (
        existing.estimatedProfitAtMarketIsk !== undefined ||
        r.estimatedProfitAtMarketIsk !== undefined
      ) {
        existing.estimatedProfitAtMarketIsk = this.format2(
          Number(existing.estimatedProfitAtMarketIsk ?? 0) +
            Number(r.estimatedProfitAtMarketIsk ?? 0),
        );
      }

      existing._isRed = existing._isRed === true || r._isRed === true;
      existing._hasListedPrice =
        existing._hasListedPrice === true || r._hasListedPrice === true;

      // rollover tri-state aggregation
      if (existing.isRollover !== undefined && r.isRollover !== undefined) {
        if (existing.isRollover !== r.isRollover)
          existing.isRollover = undefined;
      } else if (existing.isRollover !== r.isRollover) {
        // one side missing/undefined => treat as mixed
        existing.isRollover = undefined;
      }
    }

    const globalRows = Array.from(globalByType.values());

    // Aggregate destination by stationId + typeId
    const destMap = new Map<
      number,
      {
        destinationStationId: number;
        destinationStationName: string;
        rows: CycleIntelRow[];
      }
    >();
    for (const r of baseRows) {
      const dest = destMap.get(r.destinationStationId);
      if (!dest) {
        destMap.set(r.destinationStationId, {
          destinationStationId: r.destinationStationId,
          destinationStationName: r.destinationStationName,
          rows: [r],
        });
      } else {
        dest.rows.push(r);
      }
    }

    const destinations = Array.from(destMap.values())
      .sort((a, b) =>
        a.destinationStationName.localeCompare(b.destinationStationName),
      )
      .map((d) => {
        // Further aggregate within destination by typeId (in case multiple lines exist per type/station)
        const byType = new Map<number, CycleIntelRow>();
        for (const r of d.rows) {
          const existing = byType.get(r.typeId);
          if (!existing) {
            byType.set(r.typeId, { ...r });
            continue;
          }
          existing.unitsBought += r.unitsBought;
          existing.unitsSold += r.unitsSold;
          existing.unitsRemaining += r.unitsRemaining;
          existing.buyCostIsk = this.format2(
            Number(existing.buyCostIsk) + Number(r.buyCostIsk),
          );
          existing.cogsSoldIsk = this.format2(
            Number(existing.cogsSoldIsk) + Number(r.cogsSoldIsk),
          );
          existing.salesNetIsk = this.format2(
            Number(existing.salesNetIsk) + Number(r.salesNetIsk),
          );
          existing.feesIsk = this.format2(
            Number(existing.feesIsk) + Number(r.feesIsk),
          );
          existing.profitIsk = this.format2(
            Number(existing.profitIsk) + Number(r.profitIsk),
          );
          existing.inventoryCostRemainingIsk = this.format2(
            Number(existing.inventoryCostRemainingIsk) +
              Number(r.inventoryCostRemainingIsk),
          );
          if (
            existing.expectedProfitIsk !== undefined ||
            r.expectedProfitIsk !== undefined
          ) {
            existing.expectedProfitIsk = this.format2(
              Number(existing.expectedProfitIsk ?? 0) +
                Number(r.expectedProfitIsk ?? 0),
            );
          }
          if (
            existing.estimatedProfitAtMarketIsk !== undefined ||
            r.estimatedProfitAtMarketIsk !== undefined
          ) {
            existing.estimatedProfitAtMarketIsk = this.format2(
              Number(existing.estimatedProfitAtMarketIsk ?? 0) +
                Number(r.estimatedProfitAtMarketIsk ?? 0),
            );
          }

          existing._isRed = existing._isRed === true || r._isRed === true;
          existing._hasListedPrice =
            existing._hasListedPrice === true || r._hasListedPrice === true;

          // rollover tri-state aggregation (true=all rollover, false=all new, undefined=mixed)
          if (existing.isRollover !== undefined && r.isRollover !== undefined) {
            if (existing.isRollover !== r.isRollover)
              existing.isRollover = undefined;
          } else if (existing.isRollover !== r.isRollover) {
            existing.isRollover = undefined;
          }
        }

        const rows = Array.from(byType.values());
        const block = this.buildBlock({ rows, redMarginThresholdPct });
        return {
          destinationStationId: d.destinationStationId,
          destinationStationName: d.destinationStationName,
          ...block,
        };
      });

    return {
      cycleId,
      global: this.buildBlock({ rows: globalRows, redMarginThresholdPct }),
      destinations,
    };
  }

  private async getLatestMarketTradesForPairsExact(
    pairs: Array<{ stationId: number; typeId: number }>,
  ): Promise<
    Map<
      string,
      { scanDate: Date; high: number; low: number; avg: number; amount: number }
    >
  > {
    const out = new Map<
      string,
      { scanDate: Date; high: number; low: number; avg: number; amount: number }
    >();
    if (!pairs.length) return out;

    const locationIds = pairs.map((p) => p.stationId);
    const typeIds = pairs.map((p) => p.typeId);

    // DISTINCT ON gives us the newest scan_date row per (location_id, type_id)
    // and the join prevents cartesian explosion from IN(typeIds) x IN(locationIds).
    const rows = await this.prisma.$queryRaw<
      Array<{
        locationId: number;
        typeId: number;
        scanDate: Date;
        high: unknown;
        low: unknown;
        avg: unknown;
        amount: number;
      }>
    >`
      SELECT DISTINCT ON (m.location_id, m.type_id)
        m.location_id as "locationId",
        m.type_id as "typeId",
        m.scan_date as "scanDate",
        m.high as "high",
        m.low as "low",
        m.avg as "avg",
        m.amount as "amount"
      FROM market_order_trades_daily m
      JOIN (
        SELECT *
        FROM unnest(${locationIds}::int[], ${typeIds}::int[]) AS t(location_id, type_id)
      ) p ON p.location_id = m.location_id AND p.type_id = m.type_id
      WHERE m.is_buy_order = false
        AND m.has_gone = false
      ORDER BY m.location_id, m.type_id, m.scan_date DESC
    `;

    for (const r of rows) {
      const key = `${r.locationId}:${r.typeId}`;
      out.set(key, {
        scanDate: r.scanDate,
        high: Number(r.high),
        low: Number(r.low),
        avg: Number(r.avg),
        amount: r.amount,
      });
    }

    return out;
  }
}
