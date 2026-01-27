import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { LiquidityService } from '@api/tradecraft/market/services/liquidity.service';
import { GameDataService } from '@api/game-data/services/game-data.service';
import { ArbitragePackagerService } from '@app/arbitrage-packager';
import type {
  DestinationConfig,
  MultiPlanOptions,
  PlanResult,
} from '@app/arbitrage-packager/interfaces/packager.interfaces';
import { AppConfig } from '@api/common/config';
import { getEffectiveSell } from '@api/tradecraft/market/fees';
import type { PlanPackagesRequest } from '@api/tradecraft/market/dto/plan-packages-request.dto';
import { CreateTradeStrategyDto } from './dto/create-strategy.dto';
import { UpdateTradeStrategyDto } from './dto/update-strategy.dto';
import { CreateTradeStrategyRunDto } from './dto/create-run.dto';
import { CreateTradeStrategyWalkForwardDto } from './dto/create-walk-forward.dto';
import { CreateTradeStrategyWalkForwardAllDto } from './dto/create-walk-forward-all.dto';
import { CreateTradeStrategyCycleWalkForwardAllDto } from './dto/create-cycle-walk-forward-all.dto';
import type { LiquidityItemDto } from '@api/tradecraft/market/dto/liquidity-item.dto';
import { CreateTradeStrategyLabSweepDto } from './dto/create-lab-sweep.dto';
import { CreateTradeStrategyCycleRobustnessDto } from './dto/create-cycle-robustness.dto';
import { Prisma } from '@eve/prisma';
import { nextCheaperTick } from '@eve/eve-core/money';

type PriceModel = 'LOW' | 'AVG' | 'HIGH';

type StrategyLabBlacklist = {
  globalTypeIds: Set<number>;
  byDestinationTypeIds: Map<number, Set<number>>;
};

function compileBlacklist(input?: {
  globalTypeIds?: number[];
  byDestinationTypeIds?: Record<string, number[]>;
}): StrategyLabBlacklist | null {
  if (!input) return null;
  const global = new Set(
    (input.globalTypeIds ?? []).filter((x) => Number.isFinite(x)),
  );
  const byDest = new Map<number, Set<number>>();
  for (const [stationIdStr, typeIds] of Object.entries(
    input.byDestinationTypeIds ?? {},
  )) {
    const stationId = Number(stationIdStr);
    if (!Number.isFinite(stationId)) continue;
    const set = new Set((typeIds ?? []).filter((x) => Number.isFinite(x)));
    if (!set.size) continue;
    byDest.set(stationId, set);
  }
  if (global.size === 0 && byDest.size === 0) return null;
  return { globalTypeIds: global, byDestinationTypeIds: byDest };
}

function parseIsoDateOnly(s: string): Date {
  // Expect YYYY-MM-DD
  return new Date(`${s}T00:00:00.000Z`);
}

function formatIsoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateRangeInclusive(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  const endUtc = new Date(end);
  endUtc.setUTCHours(0, 0, 0, 0);
  while (cur.getTime() <= endUtc.getTime()) {
    out.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function getLastNDatesIso(n: number, anchorDateIso: string): string[] {
  // Mirrors DataImportService.getLastNDates():
  // - anchor normalized to UTC midnight
  // - returns last N dates ending at (anchor - 1 day)
  const dates: string[] = [];
  const anchor = parseIsoDateOnly(anchorDateIso);
  anchor.setUTCHours(0, 0, 0, 0);
  anchor.setUTCDate(anchor.getUTCDate() - 1);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(anchor);
    d.setUTCDate(anchor.getUTCDate() - i);
    dates.push(formatIsoDateOnly(d));
  }
  return dates;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

// (reserved for future numeric guards)

@Injectable()
export class StrategyLabService {
  private readonly logger = new Logger(StrategyLabService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly liquidity: LiquidityService,
    private readonly gameData: GameDataService,
    private readonly packager: ArbitragePackagerService,
  ) {}

  // ============================================================================
  // Strategies
  // ============================================================================

  async listStrategies() {
    return await this.prisma.tradeStrategy.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async createStrategy(dto: CreateTradeStrategyDto) {
    return await this.prisma.tradeStrategy.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        params: dto.params as any,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getStrategy(id: string) {
    const s = await this.prisma.tradeStrategy.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Strategy not found');
    return s;
  }

  async updateStrategy(id: string, dto: UpdateTradeStrategyDto) {
    await this.getStrategy(id);
    return await this.prisma.tradeStrategy.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        params: dto.params as any,
        isActive: dto.isActive,
      },
    });
  }

  async deleteStrategy(id: string) {
    await this.getStrategy(id);
    // soft-delete
    return await this.prisma.tradeStrategy.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deactivateStrategies(dto: { nameContains?: string }) {
    const nameContains = dto.nameContains?.trim()
      ? dto.nameContains.trim()
      : null;
    const where: any = {};
    if (nameContains)
      where.name = { contains: nameContains, mode: 'insensitive' };
    const res = await this.prisma.tradeStrategy.updateMany({
      where,
      data: { isActive: false },
    });
    return { deactivated: res.count };
  }

  async clearStrategies(dto: { nameContains?: string }) {
    const nameContains = dto.nameContains?.trim()
      ? dto.nameContains.trim()
      : null;
    const where: any = {};
    if (nameContains)
      where.name = { contains: nameContains, mode: 'insensitive' };
    const res = await this.prisma.tradeStrategy.deleteMany({ where });
    return { deletedStrategies: res.count };
  }

  // ============================================================================
  // Runs
  // ============================================================================

  async listRuns() {
    return await this.prisma.tradeStrategyRun.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: { strategy: { select: { id: true, name: true } } },
    });
  }

  async getRun(id: string) {
    const run = await this.prisma.tradeStrategyRun.findUnique({
      where: { id },
      include: {
        strategy: true,
        days: { orderBy: { date: 'asc' } },
        positions: {
          orderBy: [{ realizedProfitIsk: 'asc' }],
          include: { type: { select: { name: true } } },
        },
      },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  async clearRuns(dto: { nameContains?: string }) {
    const nameContains = dto.nameContains?.trim()
      ? dto.nameContains.trim()
      : null;
    if (!nameContains) {
      const res = await this.prisma.tradeStrategyRun.deleteMany({});
      return { deletedRuns: res.count };
    }
    const strategies = await this.prisma.tradeStrategy.findMany({
      where: { name: { contains: nameContains, mode: 'insensitive' } },
      select: { id: true },
    });
    const ids = strategies.map((s) => s.id);
    if (!ids.length) return { deletedRuns: 0 };
    const res = await this.prisma.tradeStrategyRun.deleteMany({
      where: { strategyId: { in: ids } },
    });
    return { deletedRuns: res.count };
  }

  async getMarketDataCoverage(q: { startDate: string; days: number }) {
    const start = parseIsoDateOnly(q.startDate);
    const end = addDays(start, q.days - 1);

    const stats = await this.prisma.$queryRaw<
      Array<{ minDate: Date | null; maxDate: Date | null }>
    >(Prisma.sql`
      SELECT
        MIN(scan_date)::date AS "minDate",
        MAX(scan_date)::date AS "maxDate"
      FROM market_order_trades_daily
      WHERE is_buy_order = false
        AND has_gone = false
    `);
    const minDate = stats[0]?.minDate ?? null;
    const maxDate = stats[0]?.maxDate ?? null;

    const missingAgg = await this.prisma.$queryRaw<
      Array<{ missingDays: bigint; haveDays: bigint }>
    >(Prisma.sql`
      WITH req AS (
        SELECT generate_series(${start}::date, ${end}::date, '1 day'::interval)::date AS d
      ),
      have AS (
        SELECT DISTINCT scan_date::date AS d
        FROM market_order_trades_daily
        WHERE is_buy_order = false
          AND has_gone = false
          AND scan_date >= ${start}::date
          AND scan_date <= ${end}::date
      )
      SELECT
        COUNT(*) FILTER (WHERE have.d IS NULL)::bigint AS "missingDays",
        COUNT(*) FILTER (WHERE have.d IS NOT NULL)::bigint AS "haveDays"
      FROM req
      LEFT JOIN have USING (d)
    `);

    const missingDays = Number(missingAgg[0]?.missingDays ?? 0);
    const haveDays = Number(missingAgg[0]?.haveDays ?? 0);

    const missingDates = await this.prisma.$queryRaw<Array<{ d: Date }>>(
      Prisma.sql`
        WITH req AS (
          SELECT generate_series(${start}::date, ${end}::date, '1 day'::interval)::date AS d
        ),
        have AS (
          SELECT DISTINCT scan_date::date AS d
          FROM market_order_trades_daily
          WHERE is_buy_order = false
            AND has_gone = false
            AND scan_date >= ${start}::date
            AND scan_date <= ${end}::date
        )
        SELECT req.d AS d
        FROM req
        LEFT JOIN have USING (d)
        WHERE have.d IS NULL
        ORDER BY req.d ASC
        LIMIT 60
      `,
    );

    return {
      requested: {
        startDate: q.startDate,
        endDate: formatIsoDateOnly(end),
        days: q.days,
      },
      available: {
        minDate: minDate ? formatIsoDateOnly(minDate) : null,
        maxDate: maxDate ? formatIsoDateOnly(maxDate) : null,
      },
      coverage: {
        haveDays,
        missingDays,
        isComplete: missingDays === 0,
      },
      missingDates: missingDates.map((x) => formatIsoDateOnly(x.d)),
    };
  }

  async createAndExecuteRun(dto: CreateTradeStrategyRunDto) {
    const strategy = await this.getStrategy(dto.strategyId);
    const start = parseIsoDateOnly(dto.startDate);
    const end = parseIsoDateOnly(dto.endDate);
    if (start.getTime() > end.getTime()) {
      throw new Error('startDate must be <= endDate');
    }

    const sellModel = dto.sellModel;
    const priceModel: PriceModel = dto.priceModel ?? 'LOW';

    const created = await this.prisma.tradeStrategyRun.create({
      data: {
        strategyId: strategy.id,
        status: 'RUNNING',
        startDate: start,
        endDate: end,
        initialCapitalIsk: dto.initialCapitalIsk.toFixed(2),
        sellModel,
        sellSharePct:
          dto.sellSharePct !== undefined ? String(dto.sellSharePct) : null,
        priceModel,
        startedAt: new Date(),
        assumptions: {
          fees: AppConfig.arbitrage().fees,
          sourceStationId: AppConfig.arbitrage().sourceStationId,
          relistEventsPerDay: 3,
        },
      },
    });

    try {
      await this.executeBacktestRun({
        runId: created.id,
        params: strategy.params as unknown as PlanPackagesRequest,
        start,
        end,
        initialCapitalIsk: dto.initialCapitalIsk,
        sellModel,
        sellSharePct: dto.sellSharePct,
        priceModel,
      });

      return await this.getRun(created.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`[run ${created.id}] failed: ${msg}`);
      await this.prisma.tradeStrategyRun.update({
        where: { id: created.id },
        data: { status: 'FAILED', error: msg, finishedAt: new Date() },
      });
      throw e;
    }
  }

  async createAndExecuteWalkForward(
    dto: CreateTradeStrategyWalkForwardDto,
    opts?: {
      liquidityRawByAnchor?: Map<
        string,
        Record<
          string,
          { stationName: string; totalItems: number; items: LiquidityItemDto[] }
        >
      >;
    },
  ) {
    const strategy = await this.getStrategy(dto.strategyId);

    const batchId = `wf_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const baseStart = parseIsoDateOnly(dto.startDate);
    const lastEnd = parseIsoDateOnly(dto.endDate);

    const stepDays = dto.stepDays ?? dto.testWindowDays;
    const maxRuns = dto.maxRuns ?? 12;
    const priceModel: PriceModel = dto.priceModel ?? 'LOW';

    const runs: Array<{
      runId: string;
      trainStartDate: string;
      trainEndDate: string;
      testStartDate: string;
      testEndDate: string;
      status: string;
      summary: any;
    }> = [];

    // Aggregate loser signals across runs
    const loserCounts = new Map<
      string,
      {
        typeId: number;
        destinationStationId: number;
        count: number;
        totalLoss: number;
      }
    >();

    let cursorStart = baseStart;
    for (let i = 0; i < maxRuns; i++) {
      const testStart = cursorStart;
      const testEnd = addDays(testStart, dto.testWindowDays - 1);
      if (testEnd.getTime() > lastEnd.getTime()) break;

      const trainEnd = addDays(testStart, -1);
      const trainStart = addDays(testStart, -dto.trainWindowDays);

      const effectiveParams = {
        ...(strategy.params as any),
        liquidityOptions: {
          ...(((strategy.params as any)?.liquidityOptions ?? {}) as any),
          windowDays: dto.trainWindowDays,
        },
      } as unknown as PlanPackagesRequest;

      const created = await this.prisma.tradeStrategyRun.create({
        data: {
          strategyId: strategy.id,
          status: 'RUNNING',
          startDate: testStart,
          endDate: testEnd,
          initialCapitalIsk: dto.initialCapitalIsk.toFixed(2),
          sellModel: dto.sellModel,
          sellSharePct:
            dto.sellSharePct !== undefined ? String(dto.sellSharePct) : null,
          priceModel,
          startedAt: new Date(),
          assumptions: {
            batchId,
            trainWindowDays: dto.trainWindowDays,
            testWindowDays: dto.testWindowDays,
            stepDays,
            trainStartDate: formatIsoDateOnly(trainStart),
            trainEndDate: formatIsoDateOnly(trainEnd),
            fees: AppConfig.arbitrage().fees,
            sourceStationId: AppConfig.arbitrage().sourceStationId,
            relistEventsPerDay: 3,
          },
        },
      });

      try {
        const anchorDateIso = formatIsoDateOnly(testStart);
        const liquidityRawOverride =
          opts?.liquidityRawByAnchor?.get(anchorDateIso);
        await this.executeBacktestRun({
          runId: created.id,
          params: effectiveParams,
          start: testStart,
          end: testEnd,
          initialCapitalIsk: dto.initialCapitalIsk,
          sellModel: dto.sellModel,
          sellSharePct: dto.sellSharePct,
          priceModel,
          liquidityRawOverride,
        });

        const run = await this.prisma.tradeStrategyRun.findUnique({
          where: { id: created.id },
          select: { id: true, status: true, summary: true },
        });

        // Collect losers for blacklist suggestions
        const losers = await this.prisma.tradeStrategyRunPosition.findMany({
          where: { runId: created.id },
          select: {
            typeId: true,
            destinationStationId: true,
            realizedProfitIsk: true,
          },
          orderBy: { realizedProfitIsk: 'asc' },
          take: 50,
        });
        for (const p of losers) {
          const loss = Number(p.realizedProfitIsk);
          if (!Number.isFinite(loss) || loss >= 0) continue;
          const key = `${p.typeId}:${p.destinationStationId}`;
          const cur = loserCounts.get(key) ?? {
            typeId: p.typeId,
            destinationStationId: p.destinationStationId,
            count: 0,
            totalLoss: 0,
          };
          cur.count += 1;
          cur.totalLoss += loss;
          loserCounts.set(key, cur);
        }

        runs.push({
          runId: created.id,
          trainStartDate: formatIsoDateOnly(trainStart),
          trainEndDate: formatIsoDateOnly(trainEnd),
          testStartDate: formatIsoDateOnly(testStart),
          testEndDate: formatIsoDateOnly(testEnd),
          status: run?.status ?? 'UNKNOWN',
          summary: run?.summary ?? null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(`[wf ${batchId} run ${created.id}] failed: ${msg}`);
        await this.prisma.tradeStrategyRun.update({
          where: { id: created.id },
          data: { status: 'FAILED', error: msg, finishedAt: new Date() },
        });
        runs.push({
          runId: created.id,
          trainStartDate: formatIsoDateOnly(trainStart),
          trainEndDate: formatIsoDateOnly(trainEnd),
          testStartDate: formatIsoDateOnly(testStart),
          testEndDate: formatIsoDateOnly(testEnd),
          status: 'FAILED',
          summary: null,
        });
      }

      cursorStart = addDays(cursorStart, stepDays);
    }

    // Aggregate report
    const roi = runs
      .map((r) => {
        const v = (r.summary as any)?.roiPercent;
        const n =
          typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
        return Number.isFinite(n) ? n : null;
      })
      .filter((x): x is number => x !== null);

    const dd = runs
      .map((r) => {
        const v = (r.summary as any)?.maxDrawdownPct;
        const n =
          typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
        return Number.isFinite(n) ? n : null;
      })
      .filter((x): x is number => x !== null);

    const profits = runs
      .map((r) => {
        const v = (r.summary as any)?.totalProfitIsk;
        const n =
          typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
        return Number.isFinite(n) ? n : null;
      })
      .filter((x): x is number => x !== null);

    const relistFees = runs
      .map((r) => {
        const v = (r.summary as any)?.totalRelistFeesIsk;
        const n =
          typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
        return Number.isFinite(n) ? n : null;
      })
      .filter((x): x is number => x !== null);

    const winRate =
      profits.length > 0
        ? profits.filter((p) => p > 0).length / profits.length
        : null;

    const recurringLosers = Array.from(loserCounts.values())
      .filter((x) => x.count >= 2)
      .sort((a, b) => a.totalLoss - b.totalLoss)
      .slice(0, 25);

    const typeIds = Array.from(new Set(recurringLosers.map((x) => x.typeId)));
    const names = typeIds.length
      ? await this.prisma.typeId.findMany({
          where: { id: { in: typeIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameByType = new Map(names.map((n) => [n.id, n.name]));

    const blacklistSuggestions = recurringLosers.map((x) => ({
      typeId: x.typeId,
      typeName: nameByType.get(x.typeId) ?? null,
      destinationStationId: x.destinationStationId,
      loserRuns: x.count,
      totalLossIsk: x.totalLoss,
    }));

    return {
      batchId,
      strategy: { id: strategy.id, name: strategy.name },
      config: {
        startDate: dto.startDate,
        endDate: dto.endDate,
        trainWindowDays: dto.trainWindowDays,
        testWindowDays: dto.testWindowDays,
        stepDays,
        maxRuns,
        sellModel: dto.sellModel,
        sellSharePct: dto.sellSharePct ?? null,
        priceModel,
        initialCapitalIsk: dto.initialCapitalIsk,
      },
      aggregates: {
        runs: runs.length,
        completed: runs.filter((r) => r.status === 'COMPLETED').length,
        winRate,
        roiMedian: median(roi),
        roiP10: percentile(roi, 0.1),
        roiP90: percentile(roi, 0.9),
        maxDrawdownWorst: dd.length ? Math.max(...dd) : null,
        profitMedianIsk: median(profits),
        profitP10Isk: percentile(profits, 0.1),
        profitP90Isk: percentile(profits, 0.9),
        relistFeesMedianIsk: median(relistFees),
        relistFeesP10Isk: percentile(relistFees, 0.1),
        relistFeesP90Isk: percentile(relistFees, 0.9),
      },
      runs,
      blacklistSuggestions,
    };
  }

  async createAndExecuteWalkForwardAll(
    dto: CreateTradeStrategyWalkForwardAllDto,
  ) {
    const globalBatchId = `wf_all_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const where: any = { isActive: true };
    if (dto.nameContains?.trim()) {
      where.name = { contains: dto.nameContains.trim(), mode: 'insensitive' };
    }

    const strategies = await this.prisma.tradeStrategy.findMany({
      where,
      orderBy: [{ name: 'asc' }],
    });

    // Precompute raw liquidity once per test-start anchorDate for the shared trainWindowDays.
    // This is the dominant cost in /walk-forward/all; caching here avoids repeating it per strategy.
    const stepDays = dto.stepDays ?? dto.testWindowDays;
    const maxRuns = dto.maxRuns ?? 12;
    const baseStart = parseIsoDateOnly(dto.startDate);
    const lastEnd = parseIsoDateOnly(dto.endDate);
    const liquidityRawByAnchor = new Map<
      string,
      Record<
        string,
        { stationName: string; totalItems: number; items: LiquidityItemDto[] }
      >
    >();
    {
      let cursorStart = baseStart;
      for (let i = 0; i < maxRuns; i++) {
        const testStart = cursorStart;
        const testEnd = addDays(testStart, dto.testWindowDays - 1);
        if (testEnd.getTime() > lastEnd.getTime()) break;
        const anchorDate = formatIsoDateOnly(testStart);
        if (!liquidityRawByAnchor.has(anchorDate)) {
          const raw = await this.liquidity.runRaw({
            windowDays: dto.trainWindowDays,
            anchorDate,
          });
          liquidityRawByAnchor.set(anchorDate, raw);
        }
        cursorStart = addDays(cursorStart, stepDays);
      }
    }

    const results: Array<{
      strategyId: string;
      strategyName: string;
      report: any;
    }> = [];

    const globalLosers = new Map<
      string,
      {
        typeId: number;
        typeName: string | null;
        destinationStationId: number;
        loserRuns: number;
        totalLossIsk: number;
        strategies: Set<string>;
      }
    >();

    for (const s of strategies) {
      // Reuse per-strategy walk-forward runner
      const report = await this.createAndExecuteWalkForward(
        {
          strategyId: s.id,
          startDate: dto.startDate,
          endDate: dto.endDate,
          initialCapitalIsk: dto.initialCapitalIsk,
          trainWindowDays: dto.trainWindowDays,
          testWindowDays: dto.testWindowDays,
          stepDays: dto.stepDays,
          maxRuns: dto.maxRuns,
          sellModel: dto.sellModel,
          sellSharePct: dto.sellSharePct,
          priceModel: dto.priceModel,
        },
        { liquidityRawByAnchor },
      );

      results.push({
        strategyId: s.id,
        strategyName: s.name,
        report,
      });

      // Aggregate recurring losers across all strategies
      const bl = ((report as any)?.blacklistSuggestions ?? []) as Array<{
        typeId: number;
        typeName: string | null;
        destinationStationId: number;
        loserRuns: number;
        totalLossIsk: number;
      }>;
      for (const x of bl) {
        const key = `${x.typeId}:${x.destinationStationId}`;
        const cur = globalLosers.get(key) ?? {
          typeId: x.typeId,
          typeName: x.typeName ?? null,
          destinationStationId: x.destinationStationId,
          loserRuns: 0,
          totalLossIsk: 0,
          strategies: new Set<string>(),
        };
        cur.loserRuns += x.loserRuns;
        cur.totalLossIsk += x.totalLossIsk;
        cur.strategies.add(s.name);
        if (!cur.typeName && x.typeName) cur.typeName = x.typeName;
        globalLosers.set(key, cur);
      }
    }

    // Sort for convenience: highest median ROI first (nulls last)
    results.sort((a, b) => {
      const am = Number((a.report as any)?.aggregates?.roiMedian);
      const bm = Number((b.report as any)?.aggregates?.roiMedian);
      const aOk = Number.isFinite(am);
      const bOk = Number.isFinite(bm);
      if (aOk && bOk) return bm - am;
      if (aOk) return -1;
      if (bOk) return 1;
      return a.strategyName.localeCompare(b.strategyName);
    });

    const globalBlacklistSuggestions = Array.from(globalLosers.values())
      .filter((x) => x.strategies.size >= 2)
      .sort((a, b) => a.totalLossIsk - b.totalLossIsk)
      .slice(0, 50)
      .map((x) => ({
        typeId: x.typeId,
        typeName: x.typeName,
        destinationStationId: x.destinationStationId,
        loserRuns: x.loserRuns,
        strategies: Array.from(x.strategies).sort(),
        totalLossIsk: x.totalLossIsk,
      }));

    return {
      globalBatchId,
      config: {
        startDate: dto.startDate,
        endDate: dto.endDate,
        trainWindowDays: dto.trainWindowDays,
        testWindowDays: dto.testWindowDays,
        stepDays: dto.stepDays ?? dto.testWindowDays,
        maxRuns: dto.maxRuns ?? 12,
        sellModel: dto.sellModel,
        sellSharePct: dto.sellSharePct ?? null,
        priceModel: dto.priceModel ?? 'LOW',
        initialCapitalIsk: dto.initialCapitalIsk,
        nameContains: dto.nameContains ?? null,
      },
      results,
      globalBlacklistSuggestions,
    };
  }

  /**
   * Run a lab sweep across scenarios (priceModel x sellSharePct) for all active strategies.
   * Returns a compact ranking that is easy to interpret.
   */
  async runLabSweep(dto: CreateTradeStrategyLabSweepDto) {
    const globalSweepId = `sweep_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const where: any = { isActive: true };
    if (dto.nameContains?.trim()) {
      where.name = { contains: dto.nameContains.trim(), mode: 'insensitive' };
    }
    const strategies = await this.prisma.tradeStrategy.findMany({
      where,
      orderBy: [{ name: 'asc' }],
    });

    const stepDays = dto.stepDays ?? dto.testWindowDays;
    const maxRuns = dto.maxRuns ?? 12;

    type Scenario = {
      priceModel: 'LOW' | 'AVG' | 'HIGH';
      sellSharePct: number;
    };
    const scenarios: Scenario[] = [];
    for (const pm of dto.priceModels) {
      for (const sp of dto.sellSharePcts) {
        scenarios.push({ priceModel: pm, sellSharePct: sp });
      }
    }

    // Precompute raw liquidity once per anchor window (shared across all scenarios)
    const baseStart = parseIsoDateOnly(dto.startDate);
    const lastEnd = parseIsoDateOnly(dto.endDate);
    const liquidityRawByAnchor = new Map<
      string,
      Record<
        string,
        { stationName: string; totalItems: number; items: LiquidityItemDto[] }
      >
    >();
    {
      let cursorStart = baseStart;
      for (let i = 0; i < maxRuns; i++) {
        const testStart = cursorStart;
        const testEnd = addDays(testStart, dto.testWindowDays - 1);
        if (testEnd.getTime() > lastEnd.getTime()) break;
        const anchorDate = formatIsoDateOnly(testStart);
        if (!liquidityRawByAnchor.has(anchorDate)) {
          const raw = await this.liquidity.runRaw({
            windowDays: dto.trainWindowDays,
            anchorDate,
          });
          liquidityRawByAnchor.set(anchorDate, raw);
        }
        cursorStart = addDays(cursorStart, stepDays);
      }
    }

    const results: Array<{
      strategyId: string;
      strategyName: string;
      scenarioScores: Array<{
        scenario: Scenario;
        roiMedian: number | null;
        worstDD: number | null;
        winRate: number | null;
        relistFeesMedianIsk: number | null;
        score: number | null;
      }>;
      overallScore: number | null;
      sellShareSummary: {
        bySellShare: Array<{
          sellSharePct: number;
          scoreMedianAcrossPriceModels: number | null;
          roiMedianAcrossPriceModels: number | null;
          worstDDMedianAcrossPriceModels: number | null;
          relistFeesMedianIskAcrossPriceModels: number | null;
        }>;
        robustScoreMedianAcrossSellShares: number | null;
        robustScoreMinAcrossSellShares: number | null;
        scoreAtMinSellShare: number | null;
      };
    }> = [];

    // Scoring for strategy selection:
    // ROI should dominate. DD matters (risk). Relist costs are a light operational penalty.
    //
    // score ~= roiMedian - 0.15*worstDD - 0.05*(relistFeesMedian / capital)*100
    const scoreFn = (x: {
      roiMedian: number | null;
      worstDD: number | null;
      relistFeesMedianIsk: number | null;
    }) => {
      if (
        x.roiMedian === null ||
        x.worstDD === null ||
        x.relistFeesMedianIsk === null
      )
        return null;
      const relistPct = (x.relistFeesMedianIsk / dto.initialCapitalIsk) * 100;
      const ddPenalty = 0.15 * x.worstDD;
      const relistPenalty = 0.05 * relistPct;
      return x.roiMedian - ddPenalty - relistPenalty;
    };

    // Concurrency:
    // The sweep is mostly CPU-light but DB-heavy. Run a couple of strategy-scenario
    // batches in parallel to cut wall time without overwhelming Postgres.
    const SWEEP_CONCURRENCY = 2;

    const workItems = strategies.flatMap((s) =>
      scenarios.map((sc) => ({ strategy: s, scenario: sc })),
    );

    const scored = await this.mapWithConcurrency(
      workItems,
      SWEEP_CONCURRENCY,
      async ({ strategy: s, scenario: sc }) => {
        const report = await this.createAndExecuteWalkForward(
          {
            strategyId: s.id,
            startDate: dto.startDate,
            endDate: dto.endDate,
            initialCapitalIsk: dto.initialCapitalIsk,
            trainWindowDays: dto.trainWindowDays,
            testWindowDays: dto.testWindowDays,
            stepDays: dto.stepDays,
            maxRuns: dto.maxRuns,
            sellModel: dto.sellModel,
            sellSharePct: sc.sellSharePct,
            priceModel: sc.priceModel,
          },
          { liquidityRawByAnchor },
        );

        const agg = (report as any)?.aggregates ?? {};
        const roiMedian =
          typeof agg.roiMedian === 'number'
            ? agg.roiMedian
            : agg.roiMedian != null
              ? Number(agg.roiMedian)
              : null;
        const worstDD =
          typeof agg.maxDrawdownWorst === 'number'
            ? agg.maxDrawdownWorst
            : agg.maxDrawdownWorst != null
              ? Number(agg.maxDrawdownWorst)
              : null;
        const winRate =
          typeof agg.winRate === 'number'
            ? agg.winRate
            : agg.winRate != null
              ? Number(agg.winRate)
              : null;
        const relistFeesMedianIsk =
          typeof agg.relistFeesMedianIsk === 'number'
            ? agg.relistFeesMedianIsk
            : agg.relistFeesMedianIsk != null
              ? Number(agg.relistFeesMedianIsk)
              : null;

        const score = scoreFn({ roiMedian, worstDD, relistFeesMedianIsk });
        return {
          strategyId: s.id,
          strategyName: s.name,
          scenario: sc,
          roiMedian,
          worstDD,
          winRate,
          relistFeesMedianIsk,
          score,
        };
      },
    );

    const byStrategy = new Map<
      string,
      {
        strategyId: string;
        strategyName: string;
        scenarioScores: Array<{
          scenario: Scenario;
          roiMedian: number | null;
          worstDD: number | null;
          winRate: number | null;
          relistFeesMedianIsk: number | null;
          score: number | null;
        }>;
      }
    >();

    for (const row of scored) {
      const cur = byStrategy.get(row.strategyId) ?? {
        strategyId: row.strategyId,
        strategyName: row.strategyName,
        scenarioScores: [],
      };
      cur.scenarioScores.push({
        scenario: row.scenario,
        roiMedian: row.roiMedian,
        worstDD: row.worstDD,
        winRate: row.winRate,
        relistFeesMedianIsk: row.relistFeesMedianIsk,
        score: row.score,
      });
      byStrategy.set(row.strategyId, cur);
    }

    for (const cur of byStrategy.values()) {
      const validScores = cur.scenarioScores
        .map((x) => x.score)
        .filter(
          (x): x is number => typeof x === 'number' && Number.isFinite(x),
        );
      const overallScore = validScores.length ? median(validScores) : null;

      // Robustness across sellShare:
      // 1) For each sellSharePct, aggregate across price models (median across price models)
      // 2) Then compute robustness as (median across sellShares) and (min across sellShares)
      const byShare = new Map<number, typeof cur.scenarioScores>();
      for (const s of cur.scenarioScores) {
        const sp = s.scenario.sellSharePct;
        const list = byShare.get(sp) ?? [];
        list.push(s);
        byShare.set(sp, list);
      }

      const shareKeys = Array.from(byShare.keys()).sort((a, b) => a - b);
      const medianAcross = (vals: Array<number | null>) => {
        const nums = vals
          .map((v) => (typeof v === 'number' ? v : null))
          .filter((v): v is number => v !== null && Number.isFinite(v))
          .sort((a, b) => a - b);
        return nums.length ? median(nums) : null;
      };

      const bySellShare = shareKeys.map((sellSharePct) => {
        const rows = byShare.get(sellSharePct) ?? [];
        return {
          sellSharePct,
          scoreMedianAcrossPriceModels: medianAcross(rows.map((r) => r.score)),
          roiMedianAcrossPriceModels: medianAcross(
            rows.map((r) => r.roiMedian),
          ),
          worstDDMedianAcrossPriceModels: medianAcross(
            rows.map((r) => r.worstDD),
          ),
          relistFeesMedianIskAcrossPriceModels: medianAcross(
            rows.map((r) => r.relistFeesMedianIsk),
          ),
        };
      });

      const shareScores = bySellShare
        .map((x) => x.scoreMedianAcrossPriceModels)
        .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
        .sort((a, b) => a - b);
      const robustScoreMedianAcrossSellShares = shareScores.length
        ? median(shareScores)
        : null;
      const robustScoreMinAcrossSellShares = shareScores.length
        ? Math.min(...shareScores)
        : null;
      const minShare = shareKeys.length ? shareKeys[0] : null;
      const scoreAtMinSellShare =
        minShare !== null
          ? (bySellShare.find((x) => x.sellSharePct === minShare)
              ?.scoreMedianAcrossPriceModels ?? null)
          : null;

      results.push({
        strategyId: cur.strategyId,
        strategyName: cur.strategyName,
        scenarioScores: cur.scenarioScores,
        overallScore,
        sellShareSummary: {
          bySellShare,
          robustScoreMedianAcrossSellShares,
          robustScoreMinAcrossSellShares,
          scoreAtMinSellShare,
        },
      });
    }

    results.sort((a, b) => {
      // Primary: robustness at the lowest sellShare (most realistic)
      const aLow = a.sellShareSummary.scoreAtMinSellShare;
      const bLow = b.sellShareSummary.scoreAtMinSellShare;
      const aLowOk = typeof aLow === 'number' && Number.isFinite(aLow);
      const bLowOk = typeof bLow === 'number' && Number.isFinite(bLow);
      if (aLowOk && bLowOk && aLow !== bLow) return bLow - aLow;
      if (aLowOk && !bLowOk) return -1;
      if (!aLowOk && bLowOk) return 1;

      // Secondary: robustness across sellShares (min, then median)
      const aMin = a.sellShareSummary.robustScoreMinAcrossSellShares;
      const bMin = b.sellShareSummary.robustScoreMinAcrossSellShares;
      const aMinOk = typeof aMin === 'number' && Number.isFinite(aMin);
      const bMinOk = typeof bMin === 'number' && Number.isFinite(bMin);
      if (aMinOk && bMinOk && aMin !== bMin) return bMin - aMin;

      const aMed = a.sellShareSummary.robustScoreMedianAcrossSellShares;
      const bMed = b.sellShareSummary.robustScoreMedianAcrossSellShares;
      const aMedOk = typeof aMed === 'number' && Number.isFinite(aMed);
      const bMedOk = typeof bMed === 'number' && Number.isFinite(bMed);
      if (aMedOk && bMedOk && aMed !== bMed) return bMed - aMed;

      // Fallback: old overallScore
      const aOk =
        typeof a.overallScore === 'number' && Number.isFinite(a.overallScore);
      const bOk =
        typeof b.overallScore === 'number' && Number.isFinite(b.overallScore);
      if (aOk && bOk)
        return (b.overallScore as number) - (a.overallScore as number);
      if (aOk) return -1;
      if (bOk) return 1;
      return a.strategyName.localeCompare(b.strategyName);
    });

    return {
      globalSweepId,
      config: {
        startDate: dto.startDate,
        endDate: dto.endDate,
        trainWindowDays: dto.trainWindowDays,
        testWindowDays: dto.testWindowDays,
        stepDays,
        maxRuns,
        sellModel: dto.sellModel,
        priceModels: dto.priceModels,
        sellSharePcts: dto.sellSharePcts,
        initialCapitalIsk: dto.initialCapitalIsk,
        nameContains: dto.nameContains ?? null,
      },
      scenarios,
      results,
    };
  }

  private async mapWithConcurrency<TIn, TOut>(
    items: TIn[],
    concurrency: number,
    worker: (item: TIn) => Promise<TOut>,
  ): Promise<TOut[]> {
    const c = Math.max(1, Math.floor(concurrency));
    const out: TOut[] = new Array(items.length);
    let idx = 0;

    const runWorker = async () => {
      for (;;) {
        const i = idx++;
        if (i >= items.length) return;
        out[i] = await worker(items[i]);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(c, items.length) }, () => runWorker()),
    );
    return out;
  }

  // ============================================================================
  // Backtest core (MVP)
  // ============================================================================

  private pickPrice(
    latest: { high: string; low: string; avg: string },
    m: PriceModel,
  ) {
    const high = Number(latest.high);
    const low = Number(latest.low);
    const avg = Number(latest.avg);
    if (m === 'HIGH') return high;
    if (m === 'AVG') return avg;
    return low;
  }

  private async getLatestSellTradesForTypesOnOrBefore(params: {
    locationId: number;
    typeIds: number[];
    onOrBefore: Date; // inclusive
  }): Promise<
    Map<
      number,
      { scanDate: Date; high: number; low: number; avg: number; amount: number }
    >
  > {
    const out = new Map<
      number,
      { scanDate: Date; high: number; low: number; avg: number; amount: number }
    >();
    if (!params.typeIds.length) return out;

    // DISTINCT ON (type_id) gives newest row <= anchor per type at this station.
    const rows = await this.prisma.$queryRaw<
      Array<{
        typeId: number;
        scanDate: Date;
        high: unknown;
        low: unknown;
        avg: unknown;
        amount: number;
      }>
    >`
      SELECT DISTINCT ON (m.type_id)
        m.type_id as "typeId",
        m.scan_date as "scanDate",
        m.high as "high",
        m.low as "low",
        m.avg as "avg",
        m.amount as "amount"
      FROM market_order_trades_daily m
      WHERE m.location_id = ${params.locationId}
        AND m.is_buy_order = false
        AND m.has_gone = false
        AND m.type_id = ANY(${params.typeIds}::int[])
        AND m.scan_date <= ${params.onOrBefore}::date
      ORDER BY m.type_id, m.scan_date DESC
    `;

    for (const r of rows) {
      out.set(r.typeId, {
        scanDate: r.scanDate,
        high: Number(r.high),
        low: Number(r.low),
        avg: Number(r.avg),
        amount: r.amount,
      });
    }
    return out;
  }

  private async buildHistoricalPlan(params: {
    request: PlanPackagesRequest;
    anchorDate: string; // YYYY-MM-DD (window ends at anchor-1)
    priceModel: PriceModel;
    liquidityRawOverride?: Record<
      string,
      { stationName: string; totalItems: number; items: LiquidityItemDto[] }
    >;
    existingUnitsByPair?: Map<string, number>; // key = `${stationId}:${typeId}`
    inventoryMode?: 'IGNORE' | 'SKIP_EXISTING' | 'TOP_OFF';
    blacklist?: StrategyLabBlacklist | null;
  }): Promise<{
    plan: PlanResult;
    buyUnitPriceByType: Map<number, number>;
  }> {
    const defaults = AppConfig.arbitrage();
    const fees = defaults.fees;
    const sourceStationId = defaults.sourceStationId;

    const maxInventoryDays =
      params.request.arbitrageOptions?.maxInventoryDays ??
      defaults.maxInventoryDays;
    const minMarginPercent =
      params.request.arbitrageOptions?.minMarginPercent ??
      defaults.minMarginPercent;
    const minTotalProfitISK =
      params.request.arbitrageOptions?.minTotalProfitISK ??
      defaults.minTotalProfitISK;

    const salesTaxPercent =
      params.request.arbitrageOptions?.salesTaxPercent ?? fees.salesTaxPercent;
    const brokerFeePercent =
      params.request.arbitrageOptions?.brokerFeePercent ??
      fees.brokerFeePercent;
    const feeInputs = { salesTaxPercent, brokerFeePercent };

    const liquidityWindowDays =
      params.request.liquidityOptions?.windowDays ?? 30;
    // Pull raw liquidity once (optionally supplied by caller) and apply the request thresholds locally.
    // This enables caching in Strategy Lab and avoids expensive recomputation for /walk-forward/all.
    const liquidityRaw =
      params.liquidityRawOverride ??
      (await this.liquidity.runRaw({
        windowDays: liquidityWindowDays,
        anchorDate: params.anchorDate,
      }));

    const minCoverageRatio =
      params.request.liquidityOptions?.minCoverageRatio ?? 0.57;
    const minISK =
      params.request.liquidityOptions?.minLiquidityThresholdISK ?? 1_000_000;
    const minTrades = params.request.liquidityOptions?.minWindowTrades ?? 5;

    const liquidity: typeof liquidityRaw = {};
    for (const [stationId, data] of Object.entries(liquidityRaw)) {
      const filtered = data.items.filter((it) => {
        const coverage = it.coverageDays / Math.max(1, liquidityWindowDays);
        if (coverage < minCoverageRatio) return false;
        if (it.avgDailyIskValue < minISK) return false;
        if (it.avgDailyTrades < minTrades) return false;
        return true;
      });
      liquidity[stationId] = {
        stationName: data.stationName,
        totalItems: filtered.length,
        items: filtered,
      };
    }

    // Apply station filters if provided (match live arbitrage service behavior)
    let stations = Object.entries(liquidity);
    const allow = params.request.arbitrageOptions?.destinationStationIds;
    if (allow?.length) {
      const allowSet = new Set(allow.map(String));
      stations = stations.filter(([id]) => allowSet.has(id));
    }
    const exclude =
      params.request.arbitrageOptions?.excludeDestinationStationIds;
    if (exclude?.length) {
      const exSet = new Set(exclude.map(String));
      stations = stations.filter(([id]) => !exSet.has(id));
    }

    // Apply optional blacklist (Strategy Lab only).
    // Supports global typeId exclusions and per-destination exclusions.
    if (params.blacklist) {
      const global = params.blacklist.globalTypeIds;
      const byDest = params.blacklist.byDestinationTypeIds;
      stations = stations
        .map(([stationIdStr, g]) => {
          const stationId = Number(stationIdStr);
          const per = byDest.get(stationId);
          const filteredItems = g.items.filter((it) => {
            if (global.has(it.typeId)) return false;
            if (per && per.has(it.typeId)) return false;
            return true;
          });
          return [
            stationIdStr,
            {
              ...g,
              totalItems: filteredItems.length,
              items: filteredItems,
            },
          ] as [
            string,
            {
              stationName: string;
              totalItems: number;
              items: LiquidityItemDto[];
            },
          ];
        })
        .filter(([, g]) => g.items.length > 0);
    }

    const anchorMinus1 = parseIsoDateOnly(params.anchorDate);
    anchorMinus1.setUTCDate(anchorMinus1.getUTCDate() - 1);

    // Collect all typeIds we might consider so we can fetch source prices in one go.
    const allTypeIds = Array.from(
      new Set(stations.flatMap(([, g]) => g.items.map((it) => it.typeId))),
    );

    const sourceTradesByType = await this.getLatestSellTradesForTypesOnOrBefore(
      {
        locationId: sourceStationId,
        typeIds: allTypeIds,
        onOrBefore: anchorMinus1,
      },
    );

    // Volumes for packager:
    // Prefer volumeM3 coming from LiquidityService (join from type_ids) to avoid a huge "typeId IN (...)"
    // lookup per run. Fall back to gameData only if missing.
    const volByType = new Map<number, number>();
    for (const [, g] of stations) {
      for (const it of g.items) {
        if (typeof it.volumeM3 === 'number' && Number.isFinite(it.volumeM3)) {
          volByType.set(it.typeId, it.volumeM3);
        }
      }
    }
    const missingVol = allTypeIds.filter((id) => !volByType.has(id));
    if (missingVol.length) {
      // If we’re missing *a lot* of volumes, querying item_types for all of them tends to be slow and
      // (in dev) often just returns null volumes anyway. In that case we simply skip those items.
      //
      // If the missing set is small, we do a best-effort lookup (cached/chunked in GameDataService).
      const LOOKUP_LIMIT = 200;
      if (missingVol.length <= LOOKUP_LIMIT) {
        const volumeData = await this.gameData.getTypesWithVolumes(missingVol);
        for (const [id, data] of volumeData.entries()) {
          if (typeof data.volume === 'number' && Number.isFinite(data.volume)) {
            volByType.set(id, data.volume);
          }
        }
      } else {
        this.logger.warn(
          `[strategy-lab] Missing volumeM3 for ${missingVol.length} types in planning window ${params.anchorDate}. ` +
            `Skipping those items to avoid slow type volume lookups. ` +
            `If this causes empty plans, run ImportService.importTypeVolumes() in dev.`,
        );
      }
    }

    const destinations: DestinationConfig[] = [];
    const buyUnitPriceByType = new Map<number, number>();

    for (const [stationIdStr, group] of stations) {
      const destinationStationId = Number(stationIdStr);
      const items = [];

      for (const liq of group.items) {
        const srcTrade = sourceTradesByType.get(liq.typeId) ?? null;
        if (!srcTrade) continue;

        const srcPriceRaw = this.pickPrice(
          {
            high: String(srcTrade.high),
            low: String(srcTrade.low),
            avg: String(srcTrade.avg),
          },
          // For MVP: buy price conservatism is handled by priceModel; caller can choose HIGH.
          params.priceModel,
        );

        if (!Number.isFinite(srcPriceRaw) || srcPriceRaw <= 0) continue;
        buyUnitPriceByType.set(liq.typeId, srcPriceRaw);

        const latest = liq.latest;
        if (!latest) continue;
        const dstPriceRaw = this.pickPrice(latest, params.priceModel);
        if (!Number.isFinite(dstPriceRaw) || dstPriceRaw <= 0) continue;

        // Optional deviation filter vs historical avg from liquidity window.
        const maxDev =
          params.request.arbitrageOptions?.maxPriceDeviationMultiple;
        if (maxDev !== undefined) {
          const liqAvg = Number(latest.avg);
          if (liqAvg > 0 && dstPriceRaw > liqAvg * maxDev) continue;
        }

        const effectiveSell = getEffectiveSell(dstPriceRaw, feeInputs);
        const unitProfit = effectiveSell - srcPriceRaw;
        const marginPct = (unitProfit / srcPriceRaw) * 100;
        if (marginPct < minMarginPercent) continue;

        const qty = Math.max(
          0,
          Math.floor(liq.avgDailyAmount * maxInventoryDays),
        );
        if (qty <= 0) continue;

        // Inventory behavior: allow the simulator to mimic prod behavior.
        // - IGNORE: always plan full qty (matches current Strategy Lab behavior)
        // - SKIP_EXISTING: if we already hold any of this pair, skip
        // - TOP_OFF: reduce planned qty so we don't exceed maxInventoryDays worth of stock
        const invMode = params.inventoryMode ?? 'IGNORE';
        const existing =
          params.existingUnitsByPair?.get(
            `${destinationStationId}:${liq.typeId}`,
          ) ?? 0;
        let plannedQty = qty;
        if (invMode === 'SKIP_EXISTING') {
          if (existing > 0) continue;
        } else if (invMode === 'TOP_OFF') {
          plannedQty = Math.max(0, qty - existing);
          if (plannedQty <= 0) continue;
        }
        const totalProfit = unitProfit * plannedQty;
        if (totalProfit < minTotalProfitISK) continue;

        const m3 = volByType.get(liq.typeId) ?? 0;
        if (m3 <= 0) continue;

        items.push({
          typeId: liq.typeId,
          name: liq.typeName ?? String(liq.typeId),
          sourceStationId,
          destinationStationId,
          sourcePrice: srcPriceRaw,
          destinationPrice: dstPriceRaw,
          netProfitISK: unitProfit,
          arbitrageQuantity: plannedQty,
          m3,
        });
      }

      if (items.length === 0) continue;

      destinations.push({
        destinationStationId,
        shippingCostISK:
          (params.request.shippingCostByStation as any)?.[
            destinationStationId
          ] ?? 0,
        items,
      });
    }

    const opts: MultiPlanOptions = {
      packageCapacityM3: params.request.packageCapacityM3,
      investmentISK: params.request.investmentISK,
      perDestinationMaxBudgetSharePerItem:
        params.request.perDestinationMaxBudgetSharePerItem ?? 0.2,
      maxPackagesHint: params.request.maxPackagesHint ?? 30,
      maxPackageCollateralISK: params.request.maxPackageCollateralISK,
      courierContracts: params.request.courierContracts?.map((c) => ({
        id: c.id,
        label: c.label,
        maxVolumeM3: c.maxVolumeM3,
        maxCollateralISK: c.maxCollateralISK,
      })),
      minPackageNetProfitISK: params.request.minPackageNetProfitISK,
      minPackageROIPercent: params.request.minPackageROIPercent,
      shippingMarginMultiplier: params.request.shippingMarginMultiplier,
      densityWeight: params.request.densityWeight,
      destinationCaps: params.request.destinationCaps as any,
      allocation: params.request.allocation as any,
    };

    const plan = this.packager.planMultiDestination(destinations, opts);
    return { plan, buyUnitPriceByType };
  }

  private async executeBacktestRun(params: {
    runId: string;
    params: PlanPackagesRequest;
    start: Date;
    end: Date;
    initialCapitalIsk: number;
    sellModel: 'VOLUME_SHARE' | 'CALIBRATED_CAPTURE';
    sellSharePct?: number;
    priceModel: PriceModel;
    liquidityRawOverride?: Record<
      string,
      { stationName: string; totalItems: number; items: LiquidityItemDto[] }
    >;
    blacklist?: StrategyLabBlacklist | null;
  }) {
    const defaults = AppConfig.arbitrage();
    const fees = defaults.fees;
    const feeInputs = {
      salesTaxPercent:
        params.params.arbitrageOptions?.salesTaxPercent ?? fees.salesTaxPercent,
      brokerFeePercent:
        params.params.arbitrageOptions?.brokerFeePercent ??
        fees.brokerFeePercent,
    };
    const relistFeePercent: number =
      (params.params as any)?.arbitrageOptions?.relistFeePercent ??
      fees.relistFeePercent;
    const relistEventsPerDay: number =
      (params.params as any)?.arbitrageOptions?.relistEventsPerDay ?? 3;

    // For planning, anchor window ends at (start - 1 day). Use startDate as anchor.
    const anchorDate = formatIsoDateOnly(params.start);
    const { plan, buyUnitPriceByType } = await this.buildHistoricalPlan({
      request: params.params,
      anchorDate,
      priceModel: params.priceModel,
      liquidityRawOverride: params.liquidityRawOverride,
      blacklist: params.blacklist ?? null,
    });

    // Aggregate positions from plan
    const unitsByKey = new Map<
      string,
      { destinationStationId: number; typeId: number; units: number }
    >();
    for (const pkg of plan.packages) {
      for (const it of pkg.items) {
        const key = `${pkg.destinationStationId}:${it.typeId}`;
        const cur = unitsByKey.get(key);
        if (cur) cur.units += it.units;
        else
          unitsByKey.set(key, {
            destinationStationId: pkg.destinationStationId,
            typeId: it.typeId,
            units: it.units,
          });
      }
    }

    const positions = Array.from(unitsByKey.values()).map((p) => {
      const buy = buyUnitPriceByType.get(p.typeId) ?? null;
      if (buy === null) {
        throw new Error(`Missing buy price for typeId=${p.typeId} at source`);
      }
      const costBasis = buy * p.units;
      return {
        destinationStationId: p.destinationStationId,
        typeId: p.typeId,
        plannedUnits: p.units,
        buyUnitPriceIsk: buy,
        unitsSold: 0,
        unitsRemaining: p.units,
        costBasisIskRemaining: costBasis,
        realizedProfitIsk: 0,
      };
    });

    // Fetch market daily rows for all involved pairs across date range (destination sells only)
    const dates = dateRangeInclusive(params.start, params.end);
    const stationIds = Array.from(
      new Set(positions.map((p) => p.destinationStationId)),
    );
    const typeIds = Array.from(new Set(positions.map((p) => p.typeId)));

    const marketRows = await this.prisma.marketOrderTradeDaily.findMany({
      where: {
        isBuyOrder: false,
        hasGone: false,
        locationId: { in: stationIds },
        typeId: { in: typeIds },
        scanDate: { gte: params.start, lte: params.end },
      },
      select: {
        scanDate: true,
        locationId: true,
        typeId: true,
        high: true,
        low: true,
        avg: true,
        amount: true,
      },
      orderBy: [{ scanDate: 'asc' }],
    });

    const marketByKey = new Map<string, { price: number; amount: number }>();
    for (const r of marketRows) {
      const dateKey = r.scanDate.toISOString().slice(0, 10);
      const price =
        params.priceModel === 'HIGH'
          ? Number(r.high)
          : params.priceModel === 'AVG'
            ? Number(r.avg)
            : Number(r.low);
      marketByKey.set(`${dateKey}:${r.locationId}:${r.typeId}`, {
        price,
        amount: r.amount,
      });
    }

    const sellSharePct =
      params.sellModel === 'VOLUME_SHARE'
        ? (params.sellSharePct ?? 0.05)
        : null;

    // Optional: calibrated per-pair capture shares derived from historical sales allocations vs market volume.
    // This reduces "fantasy fills" from a global sellSharePct and reflects how much volume we tend to capture
    // for each item/destination, based on historical operations.
    const calibrated =
      params.sellModel === 'CALIBRATED_CAPTURE'
        ? await this.computeCalibratedCapture({
            stationIds,
            typeIds,
            anchorDateIso: formatIsoDateOnly(params.start),
            windowDays: params.params.liquidityOptions?.windowDays ?? 14,
          })
        : null;
    const calibratedShareByPair = calibrated?.shareByPair ?? null;
    const calibratedFallbackShare = calibrated?.fallbackShare ?? 0.02;
    const totalSpend = plan.totalSpendISK;
    const totalShipping = plan.totalShippingISK;
    const cash0 = params.initialCapitalIsk - totalSpend - totalShipping;

    // Simulate day-by-day
    let cash = cash0;
    let realizedProfit = 0;
    let relistFeesPaid = 0;
    let navPeak = Number.NEGATIVE_INFINITY;
    let maxDrawdown = 0;

    // last-known price per pair for missing days
    const lastPrice = new Map<string, number>();
    const lastAmount = new Map<string, number>();
    // last known price we "listed at" for relist logic
    const lastListedPrice = new Map<string, number>();

    const dayRows: Array<{
      date: Date;
      cashIsk: number;
      inventoryCostIsk: number;
      inventoryMarkIsk: number;
      realizedProfitIsk: number;
      unrealizedProfitIsk: number;
      navIsk: number;
    }> = [];

    for (const day of dates) {
      const dayKey = day.toISOString().slice(0, 10);

      // Track which pairs likely triggered repricing today (proxy for being undercut).
      // We approximate "needs relist" as: today's gross price proxy < last listed gross price.
      const relistPairsToday = new Set<string>();

      // Sell loop
      for (const pos of positions) {
        if (pos.unitsRemaining <= 0) continue;

        const pairKey = `${pos.destinationStationId}:${pos.typeId}`;
        const rowKey = `${dayKey}:${pos.destinationStationId}:${pos.typeId}`;
        const row = marketByKey.get(rowKey) ?? null;
        if (row && Number.isFinite(row.price) && row.price > 0) {
          // Determine if we'd need to reprice: proxy price moved down vs last "listed" price
          const prevListed = lastListedPrice.get(pairKey) ?? row.price;
          if (row.price < prevListed) relistPairsToday.add(pairKey);
          lastListedPrice.set(pairKey, row.price);

          lastPrice.set(pairKey, row.price);
          lastAmount.set(pairKey, row.amount);
        }
        const priceRaw = lastPrice.get(pairKey) ?? null;
        // Only sell on days where we have actual market rows.
        // Missing days should be "no data" (no sells), consistent with coverage checks.
        const dailyAmount = row ? row.amount : 0;
        if (priceRaw === null) continue;

        const share =
          params.sellModel === 'VOLUME_SHARE'
            ? (sellSharePct ?? 0.05)
            : (calibratedShareByPair?.get(pairKey) ?? calibratedFallbackShare);
        const cap = Math.max(0, Math.floor(dailyAmount * share));
        if (cap <= 0) continue;

        const sold = Math.min(pos.unitsRemaining, cap);
        if (sold <= 0) continue;

        const netSell = getEffectiveSell(priceRaw, feeInputs);
        const profitPerUnit = netSell - pos.buyUnitPriceIsk;
        const profitToday = profitPerUnit * sold;

        pos.unitsSold += sold;
        pos.unitsRemaining -= sold;
        pos.realizedProfitIsk += profitToday;
        pos.costBasisIskRemaining = pos.buyUnitPriceIsk * pos.unitsRemaining;

        realizedProfit += profitToday;
        cash += netSell * sold;
      }

      // Relist fees (operational drag):
      // Undercut-checker uses: fee = remainingUnits * newPrice * (relistPct/100).
      // Here we apply that ONLY on days where the price proxy moved down (reprice needed),
      // and only for positions that still have remaining units.
      if (
        relistFeePercent > 0 &&
        relistEventsPerDay > 0 &&
        relistPairsToday.size
      ) {
        let dailyRelistFee = 0;
        for (const pos of positions) {
          if (pos.unitsRemaining <= 0) continue;
          const pairKey = `${pos.destinationStationId}:${pos.typeId}`;
          if (!relistPairsToday.has(pairKey)) continue;
          const priceGross = lastPrice.get(pairKey) ?? pos.buyUnitPriceIsk;
          if (!Number.isFinite(priceGross) || priceGross <= 0) continue;
          const remainingOrderValue = priceGross * pos.unitsRemaining;
          dailyRelistFee +=
            remainingOrderValue * (relistFeePercent / 100) * relistEventsPerDay;
        }
        if (dailyRelistFee > 0) {
          cash -= dailyRelistFee;
          realizedProfit -= dailyRelistFee;
          relistFeesPaid += dailyRelistFee;
        }
      }

      // Mark-to-market remaining inventory
      let inventoryCost = 0;
      let inventoryMark = 0;
      for (const pos of positions) {
        inventoryCost += pos.costBasisIskRemaining;
        const pairKey = `${pos.destinationStationId}:${pos.typeId}`;
        const priceRaw = lastPrice.get(pairKey) ?? null;
        if (priceRaw === null || pos.unitsRemaining <= 0) continue;
        inventoryMark +=
          getEffectiveSell(priceRaw, feeInputs) * pos.unitsRemaining;
      }

      const nav = cash + inventoryMark;
      navPeak = Math.max(navPeak, nav);
      if (navPeak > 0) {
        const dd = (navPeak - nav) / navPeak;
        maxDrawdown = Math.max(maxDrawdown, dd);
      }

      dayRows.push({
        date: day,
        cashIsk: cash,
        inventoryCostIsk: inventoryCost,
        inventoryMarkIsk: inventoryMark,
        realizedProfitIsk: realizedProfit,
        unrealizedProfitIsk: inventoryMark - inventoryCost,
        navIsk: nav,
      });
    }

    const navEnd = dayRows[dayRows.length - 1]?.navIsk ?? cash0;
    const totalProfit = navEnd - params.initialCapitalIsk;

    // Persist everything
    await this.prisma.$transaction(async (tx) => {
      await tx.tradeStrategyRunPosition.createMany({
        data: positions.map((p) => ({
          runId: params.runId,
          destinationStationId: p.destinationStationId,
          typeId: p.typeId,
          plannedUnits: p.plannedUnits,
          buyUnitPriceIsk: p.buyUnitPriceIsk.toFixed(2),
          unitsSold: p.unitsSold,
          unitsRemaining: p.unitsRemaining,
          costBasisIskRemaining: p.costBasisIskRemaining.toFixed(2),
          realizedProfitIsk: p.realizedProfitIsk.toFixed(2),
        })),
      });

      await tx.tradeStrategyRunDay.createMany({
        data: dayRows.map((d) => ({
          runId: params.runId,
          date: d.date,
          cashIsk: d.cashIsk.toFixed(2),
          inventoryCostIsk: d.inventoryCostIsk.toFixed(2),
          inventoryMarkIsk: d.inventoryMarkIsk.toFixed(2),
          realizedProfitIsk: d.realizedProfitIsk.toFixed(2),
          unrealizedProfitIsk: d.unrealizedProfitIsk.toFixed(2),
          navIsk: d.navIsk.toFixed(2),
        })),
      });

      await tx.tradeStrategyRun.update({
        where: { id: params.runId },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          summary: {
            totalSpendIsk: totalSpend,
            totalShippingIsk: totalShipping,
            totalRelistFeesIsk: relistFeesPaid,
            totalProfitIsk: totalProfit,
            roiPercent:
              params.initialCapitalIsk > 0
                ? (totalProfit / params.initialCapitalIsk) * 100
                : null,
            maxDrawdownPct: maxDrawdown * 100,
            days: dayRows.length,
            relistFeePercent,
            relistEventsPerDay,
            fillModel:
              params.sellModel === 'CALIBRATED_CAPTURE'
                ? {
                    mode: 'CALIBRATED_CAPTURE',
                    fallbackShare: calibratedFallbackShare,
                    calibratedPairs: calibratedShareByPair?.size ?? 0,
                  }
                : {
                    mode: 'VOLUME_SHARE',
                    sellSharePct,
                  },
          },
        },
      });
    });
  }

  /**
   * Cycle-walk-forward (MVP):
   * - Simulates consecutive fixed-length cycles (default 14 days)
   * - Rebuy trigger: when cash/(cash+inventoryCost) >= threshold, run planner and buy again
   * - Reprice logic: if market price drops vs our last listed, only reprice if not "red" (<= -10% margin)
   * - Sells: volume-share capped, but only when we're competitively priced (listed <= market proxy)
   * - Profit accounting: Δ(total capital at cost) per cycle, where total capital at cost = cash + inventoryCost
   *
   * This matches the operational workflow:
   * - Inventory rolls over at cost (admin buyback/sellback), so leftover inventory does not distort cycle profit.
   */
  async createAndExecuteCycleWalkForwardAll(
    dto: CreateTradeStrategyCycleWalkForwardAllDto,
  ) {
    const singleBuy = dto.singleBuy ?? false;
    const priceModel: PriceModel =
      dto.priceModel ?? (singleBuy ? 'AVG' : 'LOW');
    const cycles = dto.cycles;
    const cycleDays = dto.cycleDays ?? 14;
    const rebuyTriggerCashPct = dto.rebuyTriggerCashPct ?? 0.25;
    const reserveCashPct = dto.reserveCashPct ?? 0.02;
    const repricesPerDay = dto.repricesPerDay ?? (singleBuy ? 1 : 3);
    const skipRepriceIfMarginPctLeq = dto.skipRepriceIfMarginPctLeq ?? -10;
    const inventoryMode = dto.inventoryMode ?? 'SKIP_EXISTING';

    if (dto.sellModel !== 'VOLUME_SHARE') {
      throw new Error(
        'Only sellModel=VOLUME_SHARE is supported for cycle sim MVP',
      );
    }

    const start0 = parseIsoDateOnly(dto.startDate);
    const nameContains = dto.nameContains?.trim()
      ? dto.nameContains.trim().toLowerCase()
      : null;

    const all = await this.prisma.tradeStrategy.findMany({
      where: { isActive: true },
      select: { id: true, name: true, params: true },
      orderBy: { name: 'asc' },
    });
    const strategies = nameContains
      ? all.filter((s) => s.name.toLowerCase().includes(nameContains))
      : all;

    const liquidityRawByAnchor = new Map<
      string,
      Record<
        string,
        { stationName: string; totalItems: number; items: LiquidityItemDto[] }
      >
    >();

    const results: Array<{
      strategyId: string;
      strategyName: string;
      totalProfitIsk: number;
      totalProfitCashIsk: number;
      avgProfitIskPerCycle: number;
      avgProfitCashIskPerCycle: number;
      cycles: Array<{
        cycleIndex: number;
        startDate: string;
        endDate: string;
        profitIsk: number;
        profitCashIsk: number;
        capitalStartIsk: number;
        capitalEndIsk: number;
        cashEndIsk: number;
        inventoryCostEndIsk: number;
        buyEvents: number;
        totalSpendIsk: number;
        totalShippingIsk: number;
        relistFeesPaidIsk: number;
        repricesApplied: number;
        repricesSkippedRed: number;
        unitsSold: number;
      }>;
      notes: string[];
    }> = [];

    // bounded concurrency to keep DB stable
    const concurrency = 2;
    let idx = 0;
    const workers = Array.from(
      { length: Math.min(concurrency, strategies.length) },
      async () => {
        for (;;) {
          const current = idx++;
          if (current >= strategies.length) break;
          const s = strategies[current];
          try {
            const r = await this.simulateCycleWalkForwardStrategy({
              strategyId: s.id,
              strategyName: s.name,
              params: s.params as unknown as PlanPackagesRequest,
              start0,
              cycles,
              cycleDays,
              initialCapitalIsk: dto.initialCapitalIsk,
              sellSharePct: dto.sellSharePct,
              priceModel,
              rebuyTriggerCashPct,
              reserveCashPct,
              repricesPerDay,
              skipRepriceIfMarginPctLeq,
              inventoryMode,
              singleBuy,
              liquidityRawByAnchor,
            });
            results.push(r);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`[cycle-wf] strategy=${s.name} failed: ${msg}`);
            results.push({
              strategyId: s.id,
              strategyName: s.name,
              totalProfitIsk: Number.NEGATIVE_INFINITY,
              totalProfitCashIsk: Number.NEGATIVE_INFINITY,
              avgProfitIskPerCycle: Number.NEGATIVE_INFINITY,
              avgProfitCashIskPerCycle: Number.NEGATIVE_INFINITY,
              cycles: [],
              notes: [`FAILED: ${msg}`],
            });
          }
        }
      },
    );
    await Promise.all(workers);

    // sort best-first by total cash profit (matches /tradecraft/admin/profit)
    results.sort(
      (a, b) =>
        (b.totalProfitCashIsk ?? -Infinity) -
        (a.totalProfitCashIsk ?? -Infinity),
    );

    return {
      settings: {
        startDate: dto.startDate,
        cycles,
        cycleDays,
        initialCapitalIsk: dto.initialCapitalIsk,
        sellModel: dto.sellModel,
        sellSharePct: dto.sellSharePct,
        priceModel,
        rebuyTriggerCashPct,
        reserveCashPct,
        repricesPerDay,
        skipRepriceIfMarginPctLeq,
        inventoryMode,
        singleBuy,
        nameContains: dto.nameContains ?? null,
      },
      results,
    };
  }

  async createAndExecuteCycleRobustness(
    dto: CreateTradeStrategyCycleRobustnessDto,
  ) {
    const stepDays = dto.stepDays ?? 2;
    const maxDays = dto.maxDays ?? 21;
    const repricesPerDay = dto.repricesPerDay ?? 1;
    const skipRepriceIfMarginPctLeq = dto.skipRepriceIfMarginPctLeq ?? -10;
    const priceModel: PriceModel = dto.priceModel ?? 'AVG';
    const inventoryMode = dto.inventoryMode ?? 'SKIP_EXISTING';

    const startFrom = parseIsoDateOnly(dto.startDateFrom);
    const startTo = parseIsoDateOnly(dto.startDateTo);
    if (startFrom.getTime() > startTo.getTime()) {
      throw new Error('startDateFrom must be <= startDateTo');
    }

    const nameContains = dto.nameContains?.trim()
      ? dto.nameContains.trim().toLowerCase()
      : null;

    const all = await this.prisma.tradeStrategy.findMany({
      where: { isActive: true },
      select: { id: true, name: true, params: true },
      orderBy: { name: 'asc' },
    });
    const strategies = nameContains
      ? all.filter((s) => s.name.toLowerCase().includes(nameContains))
      : all;

    const starts: Date[] = [];
    {
      let cur = new Date(startFrom);
      cur.setUTCHours(0, 0, 0, 0);
      const end = new Date(startTo);
      end.setUTCHours(0, 0, 0, 0);
      while (cur.getTime() <= end.getTime()) {
        starts.push(new Date(cur));
        cur = addDays(cur, stepDays);
      }
    }

    // Shared liquidity raw cache
    const liquidityRawByAnchor = new Map<
      string,
      Record<
        string,
        { stationName: string; totalItems: number; items: LiquidityItemDto[] }
      >
    >();

    const blacklistCompiled = compileBlacklist(dto.blacklist);

    const runVariant = async (variant: {
      label: 'NO_BLACKLIST' | 'WITH_BLACKLIST';
      blacklist: StrategyLabBlacklist | null;
    }) => {
      // Run bounded concurrency to avoid hammering Postgres
      const CONCURRENCY = 2;
      const work = strategies.flatMap((s) => starts.map((d) => ({ s, d })));

      const rows = await this.mapWithConcurrency(
        work,
        CONCURRENCY,
        async ({ s, d }) => {
          const start0 = new Date(d);
          const r = await this.simulateCycleWalkForwardStrategy({
            strategyId: s.id,
            strategyName: s.name,
            params: s.params as unknown as PlanPackagesRequest,
            start0,
            cycles: 1,
            cycleDays: maxDays,
            initialCapitalIsk: dto.initialCapitalIsk,
            sellSharePct: dto.sellSharePct,
            priceModel,
            rebuyTriggerCashPct: 1, // unused (singleBuy=true)
            reserveCashPct: 0, // unused (singleBuy=true)
            repricesPerDay,
            skipRepriceIfMarginPctLeq,
            inventoryMode,
            singleBuy: true,
            blacklist: variant.blacklist,
            liquidityRawByAnchor,
          });

          const c0 = r.cycles[0];
          const profitCash = c0?.profitCashIsk ?? 0;
          return {
            strategyId: s.id,
            strategyName: s.name,
            startDate: formatIsoDateOnly(start0),
            profitCashIsk: profitCash,
            positionsSummary: r.positionsSummary ?? [],
          };
        },
      );

      const byStrategy = new Map<
        string,
        {
          strategyId: string;
          strategyName: string;
          profits: number[];
          best?: { startDate: string; profitCashIsk: number };
          worst?: { startDate: string; profitCashIsk: number };
        }
      >();

      for (const r of rows) {
        const cur = byStrategy.get(r.strategyId) ?? {
          strategyId: r.strategyId,
          strategyName: r.strategyName,
          profits: [],
        };
        cur.profits.push(r.profitCashIsk);
        if (!cur.best || r.profitCashIsk > cur.best.profitCashIsk) {
          cur.best = { startDate: r.startDate, profitCashIsk: r.profitCashIsk };
        }
        if (!cur.worst || r.profitCashIsk < cur.worst.profitCashIsk) {
          cur.worst = {
            startDate: r.startDate,
            profitCashIsk: r.profitCashIsk,
          };
        }
        byStrategy.set(r.strategyId, cur);
      }

      // Aggregate repeat offenders across all strategies/runs (typeId + destination).
      const offenders = new Map<
        string,
        {
          typeId: number;
          typeName: string | null;
          destinationStationId: number;
          stationName: string | null;
          runs: number;
          loserRuns: number;
          redRuns: number;
          totalProfitCashIsk: number;
          totalLossCashIsk: number;
          strategies: Set<string>;
        }
      >();
      for (const row of rows) {
        for (const p of row.positionsSummary) {
          const key = `${p.destinationStationId}:${p.typeId}`;
          const cur = offenders.get(key) ?? {
            typeId: p.typeId,
            typeName: p.typeName ?? null,
            destinationStationId: p.destinationStationId,
            stationName: p.stationName ?? null,
            runs: 0,
            loserRuns: 0,
            redRuns: 0,
            totalProfitCashIsk: 0,
            totalLossCashIsk: 0,
            strategies: new Set<string>(),
          };
          cur.runs += 1;
          cur.strategies.add(row.strategyName);
          cur.totalProfitCashIsk += p.profitCashIsk;
          if (p.profitCashIsk < 0) {
            cur.loserRuns += 1;
            cur.totalLossCashIsk += p.profitCashIsk;
          }
          if (p.isRed) cur.redRuns += 1;
          if (!cur.typeName && p.typeName) cur.typeName = p.typeName;
          if (!cur.stationName && p.stationName)
            cur.stationName = p.stationName;
          offenders.set(key, cur);
        }
      }

      const repeatOffenders = Array.from(offenders.values())
        .filter((x) => x.loserRuns >= 2 || x.redRuns >= 2)
        .sort((a, b) => {
          if (a.totalLossCashIsk !== b.totalLossCashIsk)
            return a.totalLossCashIsk - b.totalLossCashIsk;
          if (a.redRuns !== b.redRuns) return b.redRuns - a.redRuns;
          if (a.loserRuns !== b.loserRuns) return b.loserRuns - a.loserRuns;
          return `${a.typeId}`.localeCompare(`${b.typeId}`);
        })
        .slice(0, 50)
        .map((x) => ({
          typeId: x.typeId,
          typeName: x.typeName,
          destinationStationId: x.destinationStationId,
          stationName: x.stationName,
          runs: x.runs,
          loserRuns: x.loserRuns,
          redRuns: x.redRuns,
          totalProfitCashIsk: x.totalProfitCashIsk,
          totalLossCashIsk: x.totalLossCashIsk,
          strategies: Array.from(x.strategies).sort(),
        }));

      const results = Array.from(byStrategy.values()).map((x) => {
        const profits = x.profits.filter((n) => Number.isFinite(n));
        const lossRate =
          profits.length > 0
            ? profits.filter((p) => p < 0).length / profits.length
            : null;
        return {
          strategyId: x.strategyId,
          strategyName: x.strategyName,
          runs: profits.length,
          lossRate,
          profitP10Isk: percentile(profits, 0.1),
          profitMedianIsk: median(profits),
          profitP90Isk: percentile(profits, 0.9),
          best: x.best ?? null,
          worst: x.worst ?? null,
        };
      });

      results.sort((a, b) => {
        const ap10 =
          typeof a.profitP10Isk === 'number' ? a.profitP10Isk : -Infinity;
        const bp10 =
          typeof b.profitP10Isk === 'number' ? b.profitP10Isk : -Infinity;
        if (ap10 !== bp10) return bp10 - ap10;
        const am =
          typeof a.profitMedianIsk === 'number' ? a.profitMedianIsk : -Infinity;
        const bm =
          typeof b.profitMedianIsk === 'number' ? b.profitMedianIsk : -Infinity;
        if (am !== bm) return bm - am;
        const al = typeof a.lossRate === 'number' ? a.lossRate : 1;
        const bl = typeof b.lossRate === 'number' ? b.lossRate : 1;
        if (al !== bl) return al - bl;
        return a.strategyName.localeCompare(b.strategyName);
      });

      return { label: variant.label, results, repeatOffenders };
    };

    const noBlacklist = await runVariant({
      label: 'NO_BLACKLIST',
      blacklist: null,
    });
    const withBlacklist = blacklistCompiled
      ? await runVariant({
          label: 'WITH_BLACKLIST',
          blacklist: blacklistCompiled,
        })
      : null;

    return {
      config: {
        startDateFrom: dto.startDateFrom,
        startDateTo: dto.startDateTo,
        stepDays,
        maxDays,
        initialCapitalIsk: dto.initialCapitalIsk,
        sellSharePct: dto.sellSharePct,
        priceModel,
        repricesPerDay,
        skipRepriceIfMarginPctLeq,
        inventoryMode,
        nameContains: dto.nameContains ?? null,
      },
      starts: starts.map((d) => formatIsoDateOnly(d)),
      blacklist: dto.blacklist ?? null,
      reports: {
        noBlacklist,
        withBlacklist,
      },
    };
  }

  private async simulateCycleWalkForwardStrategy(params: {
    strategyId: string;
    strategyName: string;
    params: PlanPackagesRequest;
    start0: Date;
    cycles: number;
    cycleDays: number;
    initialCapitalIsk: number;
    sellSharePct: number;
    priceModel: PriceModel;
    rebuyTriggerCashPct: number;
    reserveCashPct: number;
    repricesPerDay: number;
    skipRepriceIfMarginPctLeq: number;
    inventoryMode: 'IGNORE' | 'SKIP_EXISTING' | 'TOP_OFF';
    singleBuy?: boolean;
    blacklist?: StrategyLabBlacklist | null;
    liquidityRawByAnchor: Map<
      string,
      Record<
        string,
        { stationName: string; totalItems: number; items: LiquidityItemDto[] }
      >
    >;
  }): Promise<{
    strategyId: string;
    strategyName: string;
    totalProfitIsk: number;
    totalProfitCashIsk: number;
    avgProfitIskPerCycle: number;
    avgProfitCashIskPerCycle: number;
    cycles: Array<{
      cycleIndex: number;
      startDate: string;
      endDate: string;
      profitIsk: number;
      profitCashIsk: number;
      roiPct: number | null;
      capitalStartIsk: number;
      capitalEndIsk: number;
      cashStartIsk: number;
      inventoryCostStartIsk: number;
      cashEndIsk: number;
      inventoryCostEndIsk: number;
      cashPctMin: number;
      cashPctMax: number;
      buyEvents: number;
      buyDates: string[];
      totalSpendIsk: number;
      totalShippingIsk: number;
      relistFeesPaidIsk: number;
      repricesApplied: number;
      repricesSkippedRed: number;
      unitsSold: number;
      grossSalesIsk: number;
      salesNetIsk: number;
      avgNetSellPerUnitIsk: number | null;
      salesTaxIsk: number;
      brokerFeesIsk: number;
      cogsIsk: number;
      positionsHeldEnd: number;
    }>;
    notes: string[];
    positionsSummary?: Array<{
      destinationStationId: number;
      stationName: string | null;
      typeId: number;
      typeName: string | null;
      isRed: boolean;
      profitCashIsk: number;
      totalShippingIsk: number;
      totalRelistFeesIsk: number;
      totalBrokerFeesIsk: number;
      unitsSold: number;
      unitsRemaining: number;
    }>;
  }> {
    const defaults = AppConfig.arbitrage();
    const fees = defaults.fees;
    const feeInputs = {
      salesTaxPercent:
        params.params.arbitrageOptions?.salesTaxPercent ?? fees.salesTaxPercent,
      brokerFeePercent:
        params.params.arbitrageOptions?.brokerFeePercent ??
        fees.brokerFeePercent,
    };
    const relistFeePercent: number =
      (params.params as any)?.arbitrageOptions?.relistFeePercent ??
      fees.relistFeePercent;
    const singleBuy = params.singleBuy ?? false;

    const key = (stationId: number, typeId: number) => `${stationId}:${typeId}`;
    type Position = {
      destinationStationId: number;
      typeId: number;
      units: number;
      totalCostIsk: number; // WAC * units (cost basis)
      listedPriceIsk: number | null; // last listed gross price
      isRed: boolean; // true once margin drops into "red" zone (no more updates)
      // Per-position cash metrics (for repeat offender analysis)
      grossSalesIsk: number;
      salesNetIsk: number;
      salesTaxIsk: number;
      cogsIsk: number;
      brokerFeesIsk: number;
      relistFeesIsk: number;
      shippingIsk: number;
      unitsSold: number;
    };

    const positions = new Map<string, Position>();
    let cash = params.initialCapitalIsk;

    const marketByKey = new Map<string, { price: number; amount: number }>();
    const ensureMarketRows = async (p: {
      stationIds: number[];
      typeIds: number[];
      start: Date;
      end: Date;
    }) => {
      const stationIds = Array.from(new Set(p.stationIds)).filter((x) =>
        Number.isFinite(x),
      );
      const typeIds = Array.from(new Set(p.typeIds)).filter((x) =>
        Number.isFinite(x),
      );
      if (!stationIds.length || !typeIds.length) return;
      const rows = await this.prisma.marketOrderTradeDaily.findMany({
        where: {
          isBuyOrder: false,
          hasGone: false,
          locationId: { in: stationIds },
          typeId: { in: typeIds },
          scanDate: { gte: p.start, lte: p.end },
        },
        select: {
          scanDate: true,
          locationId: true,
          typeId: true,
          high: true,
          low: true,
          avg: true,
          amount: true,
        },
        orderBy: [{ scanDate: 'asc' }],
      });
      for (const r of rows) {
        const dateKey = r.scanDate.toISOString().slice(0, 10);
        const price =
          params.priceModel === 'HIGH'
            ? Number(r.high)
            : params.priceModel === 'AVG'
              ? Number(r.avg)
              : Number(r.low);
        if (!Number.isFinite(price) || price <= 0) continue;
        marketByKey.set(`${dateKey}:${r.locationId}:${r.typeId}`, {
          price,
          amount: r.amount,
        });
      }
    };

    const inventoryCostTotal = () => {
      let sum = 0;
      for (const p of positions.values()) sum += p.totalCostIsk;
      return sum;
    };

    const capitalAtCost = () => cash + inventoryCostTotal();

    const cycleRows: Array<{
      cycleIndex: number;
      startDate: string;
      endDate: string;
      profitIsk: number;
      capitalStartIsk: number;
      capitalEndIsk: number;
      cashStartIsk: number;
      inventoryCostStartIsk: number;
      cashEndIsk: number;
      inventoryCostEndIsk: number;
      cashPctMin: number;
      cashPctMax: number;
      buyEvents: number;
      buyDates: string[];
      totalSpendIsk: number;
      totalShippingIsk: number;
      relistFeesPaidIsk: number;
      repricesApplied: number;
      repricesSkippedRed: number;
      unitsSold: number;
      grossSalesIsk: number;
      salesNetIsk: number;
      avgNetSellPerUnitIsk: number | null;
      salesTaxIsk: number;
      brokerFeesIsk: number;
      cogsIsk: number;
      profitCashIsk: number;
      roiPct: number | null;
      positionsHeldEnd: number;
    }> = [];

    const notes: string[] = [];
    let cursor = params.start0;

    for (let c = 0; c < params.cycles; c++) {
      const cycleStart = cursor;
      const cycleEnd = addDays(cycleStart, params.cycleDays - 1);
      const dates = dateRangeInclusive(cycleStart, cycleEnd);
      const cashStart = cash;
      const invStart = inventoryCostTotal();
      const capitalStart = cashStart + invStart;

      let buyEvents = 0;
      const buyDates: string[] = [];
      let totalSpend = 0;
      let totalShipping = 0;
      let relistFeesPaid = 0;
      let repricesApplied = 0;
      let repricesSkippedRed = 0;
      let unitsSold = 0;
      let grossSalesIsk = 0;
      let salesNetIsk = 0;
      let salesTaxIsk = 0;
      let brokerFeesIsk = 0;
      let cogsIsk = 0;
      let cashPctMin = 1;
      let cashPctMax = 0;

      const observeCashPct = () => {
        const invCost = inventoryCostTotal();
        const denom = cash + invCost;
        const cashPct = denom > 0 ? cash / denom : 1;
        cashPctMin = Math.min(cashPctMin, cashPct);
        cashPctMax = Math.max(cashPctMax, cashPct);
      };

      const runPlannerBuy = async (
        dayIso: string,
        buyDate: Date,
      ): Promise<boolean> => {
        const invCost = inventoryCostTotal();
        const denom = cash + invCost;
        const reserveTarget = denom * params.reserveCashPct;
        const investable = Math.max(0, cash - reserveTarget);
        if (investable <= 1_000_000) return false;

        const anchorDateIso = dayIso;
        const windowDays = params.params.liquidityOptions?.windowDays ?? 14;
        const liqKey = `${anchorDateIso}:${windowDays}`;
        const liqRaw =
          params.liquidityRawByAnchor.get(liqKey) ??
          (await this.liquidity.runRaw({
            windowDays,
            anchorDate: anchorDateIso,
          }));
        if (!params.liquidityRawByAnchor.has(liqKey))
          params.liquidityRawByAnchor.set(liqKey, liqRaw);

        const req = {
          ...(params.params as any),
          investmentISK: investable,
        } as PlanPackagesRequest;

        const existingUnitsByPair = new Map<string, number>();
        if (params.inventoryMode !== 'IGNORE') {
          for (const p of positions.values()) {
            if (p.units > 0) {
              existingUnitsByPair.set(
                `${p.destinationStationId}:${p.typeId}`,
                p.units,
              );
            }
          }
        }

        const { plan, buyUnitPriceByType } = await this.buildHistoricalPlan({
          request: req,
          anchorDate: anchorDateIso,
          priceModel: params.priceModel,
          liquidityRawOverride: liqRaw,
          existingUnitsByPair:
            params.inventoryMode !== 'IGNORE' ? existingUnitsByPair : undefined,
          inventoryMode: params.inventoryMode,
          blacklist: params.blacklist ?? null,
        });

        if (plan.packages.length === 0) return false;

        // Cash-constrained execution: buy only packages we can afford while preserving reserve.
        let boughtAny = false;
        let spendThisBuy = 0;
        let shipThisBuy = 0;

        const boughtByPair = new Map<
          string,
          {
            stationId: number;
            typeId: number;
            units: number;
            unitCost: number;
            shippingIsk: number;
          }
        >();

        for (const pkg of plan.packages) {
          const pkgCost = pkg.spendISK + pkg.shippingISK;
          if (pkgCost <= 0) continue;
          if (cash - pkgCost < reserveTarget) break;

          cash -= pkgCost;
          spendThisBuy += pkg.spendISK;
          shipThisBuy += pkg.shippingISK;
          boughtAny = true;

          // Allocate package shipping across items proportional to item spend.
          const itemCosts = pkg.items.map((it) => {
            const unitCost = buyUnitPriceByType.get(it.typeId) ?? it.unitCost;
            const cost = unitCost * it.units;
            return { typeId: it.typeId, units: it.units, unitCost, cost };
          });
          const totalItemCost = itemCosts.reduce(
            (s, x) => s + (x.cost > 0 ? x.cost : 0),
            0,
          );

          for (const it of pkg.items) {
            const unitCost = buyUnitPriceByType.get(it.typeId) ?? it.unitCost;
            const k = key(pkg.destinationStationId, it.typeId);
            const cur = boughtByPair.get(k);
            const itemCost = unitCost * it.units;
            const shipAlloc =
              pkg.shippingISK > 0 && totalItemCost > 0 && itemCost > 0
                ? (pkg.shippingISK * itemCost) / totalItemCost
                : 0;
            if (cur) {
              cur.units += it.units;
              cur.shippingIsk += shipAlloc;
            } else
              boughtByPair.set(k, {
                stationId: pkg.destinationStationId,
                typeId: it.typeId,
                units: it.units,
                unitCost,
                shippingIsk: shipAlloc,
              });
          }
        }

        if (!boughtAny) return false;

        buyEvents++;
        buyDates.push(dayIso);
        totalSpend += spendThisBuy;
        totalShipping += shipThisBuy;

        // Observe cash% after buys as well (will usually be near reserve)
        observeCashPct();

        const newStationIds = Array.from(
          new Set(Array.from(boughtByPair.values()).map((x) => x.stationId)),
        );
        const newTypeIds = Array.from(
          new Set(Array.from(boughtByPair.values()).map((x) => x.typeId)),
        );
        await ensureMarketRows({
          stationIds: newStationIds,
          typeIds: newTypeIds,
          start: buyDate,
          end: cycleEnd,
        });

        for (const b of boughtByPair.values()) {
          const k = key(b.stationId, b.typeId);
          const addCost = b.unitCost * b.units;
          const row =
            marketByKey.get(`${dayIso}:${b.stationId}:${b.typeId}`) ?? null;
          const initialList =
            row && row.price > 0 ? nextCheaperTick(row.price) : null;

          const cur = positions.get(k);
          if (cur) {
            cur.units += b.units;
            cur.totalCostIsk += addCost;
            cur.shippingIsk += b.shippingIsk;
            if (cur.listedPriceIsk === null) cur.listedPriceIsk = initialList;
          } else {
            positions.set(k, {
              destinationStationId: b.stationId,
              typeId: b.typeId,
              units: b.units,
              totalCostIsk: addCost,
              listedPriceIsk: initialList,
              isRed: false,
              grossSalesIsk: 0,
              salesNetIsk: 0,
              salesTaxIsk: 0,
              cogsIsk: 0,
              brokerFeesIsk: 0,
              relistFeesIsk: 0,
              shippingIsk: b.shippingIsk,
              unitsSold: 0,
            });
          }
        }

        return true;
      };

      // Prime market cache for existing inventory pairs (if any)
      if (positions.size) {
        const stationIds = Array.from(
          new Set(
            Array.from(positions.values()).map((p) => p.destinationStationId),
          ),
        );
        const typeIds = Array.from(
          new Set(Array.from(positions.values()).map((p) => p.typeId)),
        );
        await ensureMarketRows({
          stationIds,
          typeIds,
          start: cycleStart,
          end: cycleEnd,
        });
      }

      let lastSimDay = cycleEnd;

      if (singleBuy) {
        await runPlannerBuy(formatIsoDateOnly(cycleStart), cycleStart);
      }

      for (const day of dates) {
        const dayIso = formatIsoDateOnly(day);
        observeCashPct();

        // Reprice pass (skip reds)
        if (relistFeePercent > 0 && params.repricesPerDay > 0) {
          for (const p of positions.values()) {
            if (p.units <= 0) continue;
            if (singleBuy && p.isRed) continue;
            const row =
              marketByKey.get(
                `${dayIso}:${p.destinationStationId}:${p.typeId}`,
              ) ?? null;
            if (!row || !Number.isFinite(row.price) || row.price <= 0) continue;

            if (p.listedPriceIsk === null) {
              const initialListPrice = nextCheaperTick(row.price);
              const grossListValue = initialListPrice * p.units;
              const brokerFee =
                grossListValue * (feeInputs.brokerFeePercent / 100);

              // Cash-constrained: if we can't afford to list, skip listing today.
              if (brokerFee > 0) {
                if (brokerFee > cash) continue;
                cash -= brokerFee;
                brokerFeesIsk += brokerFee;
                p.brokerFeesIsk += brokerFee;
              }

              p.listedPriceIsk = initialListPrice;
              continue;
            }

            if (row.price >= p.listedPriceIsk) continue;

            const suggested = nextCheaperTick(row.price);
            const unitCost = p.units > 0 ? p.totalCostIsk / p.units : 0;
            if (unitCost <= 0) continue;

            const effectiveSell = getEffectiveSell(suggested, feeInputs);
            const profitPerUnit = effectiveSell - unitCost;
            const marginPct = (profitPerUnit / unitCost) * 100;

            if (marginPct <= params.skipRepriceIfMarginPctLeq) {
              repricesSkippedRed++;
              if (singleBuy) {
                p.isRed = true;
              }
              continue;
            }

            const remainingValueGross = suggested * p.units;
            const fee =
              remainingValueGross *
              (relistFeePercent / 100) *
              params.repricesPerDay;
            // Cash-constrained: if we can't afford the reprice fees, we simply skip the update.
            if (fee > 0) {
              if (fee > cash) continue;
              cash -= fee;
              relistFeesPaid += fee;
              p.relistFeesIsk += fee;
            }
            p.listedPriceIsk = suggested;
            repricesApplied++;
          }
        }

        // Sell pass
        for (const p of positions.values()) {
          if (p.units <= 0) continue;
          if (singleBuy && p.isRed) continue;
          const row =
            marketByKey.get(
              `${dayIso}:${p.destinationStationId}:${p.typeId}`,
            ) ?? null;
          if (!row || !Number.isFinite(row.price) || row.price <= 0) continue;
          if (!Number.isFinite(row.amount) || row.amount <= 0) continue;
          if (p.listedPriceIsk === null) continue;
          if (p.listedPriceIsk > row.price) continue;

          const cap = Math.max(0, Math.floor(row.amount * params.sellSharePct));
          if (cap <= 0) continue;
          const sold = Math.min(p.units, cap);
          if (sold <= 0) continue;

          const unitCost = p.units > 0 ? p.totalCostIsk / p.units : 0;
          const grossSell = p.listedPriceIsk * sold;
          const salesTax = grossSell * (feeInputs.salesTaxPercent / 100);
          const netSales = grossSell - salesTax;
          cash += netSales;
          grossSalesIsk += grossSell;
          salesNetIsk += netSales;
          salesTaxIsk += salesTax;
          cogsIsk += unitCost * sold;
          p.grossSalesIsk += grossSell;
          p.salesNetIsk += netSales;
          p.salesTaxIsk += salesTax;
          p.cogsIsk += unitCost * sold;
          p.unitsSold += sold;

          p.units -= sold;
          p.totalCostIsk -= unitCost * sold;
          if (p.units <= 0) {
            p.units = 0;
            p.totalCostIsk = 0;
          }
          unitsSold += sold;
        }

        // Observe cash% after sells (this is what drives rebuy triggers)
        observeCashPct();

        // Rebuy trigger (disabled in single-buy mode)
        if (!singleBuy) {
          const invCost = inventoryCostTotal();
          const denom = cash + invCost;
          const cashPct = denom > 0 ? cash / denom : 1;
          if (cashPct >= params.rebuyTriggerCashPct) {
            await runPlannerBuy(dayIso, day);
          }
        }

        if (singleBuy) {
          const hasActive = Array.from(positions.values()).some(
            (p) => p.units > 0 && !p.isRed,
          );
          if (!hasActive) {
            lastSimDay = day;
            break;
          }
        }
      }

      const capitalEnd = capitalAtCost();
      const profit = capitalEnd - capitalStart;
      const positionsHeldEnd = Array.from(positions.values()).filter(
        (p) => p.units > 0,
      ).length;
      const avgNetSellPerUnitIsk =
        unitsSold > 0 ? salesNetIsk / unitsSold : null;
      const profitCashIsk =
        salesNetIsk - cogsIsk - totalShipping - brokerFeesIsk - relistFeesPaid;
      const roiPct =
        capitalStart > 0 ? (profitCashIsk / capitalStart) * 100 : null;

      cycleRows.push({
        cycleIndex: c + 1,
        startDate: formatIsoDateOnly(cycleStart),
        endDate: formatIsoDateOnly(lastSimDay),
        profitIsk: profit,
        capitalStartIsk: capitalStart,
        capitalEndIsk: capitalEnd,
        cashStartIsk: cashStart,
        inventoryCostStartIsk: invStart,
        cashEndIsk: cash,
        inventoryCostEndIsk: inventoryCostTotal(),
        cashPctMin,
        cashPctMax,
        buyEvents,
        buyDates,
        totalSpendIsk: totalSpend,
        totalShippingIsk: totalShipping,
        relistFeesPaidIsk: relistFeesPaid,
        repricesApplied,
        repricesSkippedRed,
        unitsSold,
        grossSalesIsk,
        salesNetIsk,
        avgNetSellPerUnitIsk,
        salesTaxIsk,
        brokerFeesIsk,
        cogsIsk,
        profitCashIsk,
        roiPct,
        positionsHeldEnd,
      });

      cursor = addDays(lastSimDay, 1);
    }

    const totalProfitNavIsk = cycleRows.reduce((s, r) => s + r.profitIsk, 0);
    const totalProfitCashIsk = cycleRows.reduce(
      (s, r) => s + r.profitCashIsk,
      0,
    );
    const avgProfitNavIsk = cycleRows.length
      ? totalProfitNavIsk / cycleRows.length
      : 0;
    const avgProfitCashIsk = cycleRows.length
      ? totalProfitCashIsk / cycleRows.length
      : 0;

    notes.push(
      `Profit accounting: Δ(cash + inventoryCost) per cycle (inventory at cost, rollover-neutral).`,
    );
    notes.push(
      `Rebuy: triggers at cashPct>=${params.rebuyTriggerCashPct.toFixed(
        3,
      )}, then keeps reserveCashPct≈${params.reserveCashPct.toFixed(3)}.`,
    );
    notes.push(
      `Reprice skip: marginPct<=${params.skipRepriceIfMarginPctLeq.toFixed(
        2,
      )}% treated as red (no update).`,
    );
    notes.push(`Inventory mode: ${params.inventoryMode}.`);
    if (singleBuy) {
      notes.push(
        `Single-buy mode: one initial plan only; cycle ends when all positions are sold or marked red.`,
      );
    }

    // Build per-position summary for repeat-offender analysis (used by robustness runner).
    const stationIdsForNames = Array.from(
      new Set(
        Array.from(positions.values()).map((p) => p.destinationStationId),
      ),
    );
    const typeIdsForNames = Array.from(
      new Set(Array.from(positions.values()).map((p) => p.typeId)),
    );
    const stationInfo = stationIdsForNames.length
      ? await this.gameData.getStationsWithRegions(stationIdsForNames)
      : new Map<number, { name: string }>();
    const typeNames = typeIdsForNames.length
      ? await this.gameData.getTypeNames(typeIdsForNames)
      : new Map<number, string>();

    const positionsSummary = Array.from(positions.values()).map((p) => {
      const profitCashIsk =
        p.salesNetIsk -
        p.cogsIsk -
        p.shippingIsk -
        p.brokerFeesIsk -
        p.relistFeesIsk;
      return {
        destinationStationId: p.destinationStationId,
        stationName: stationInfo.get(p.destinationStationId)?.name ?? null,
        typeId: p.typeId,
        typeName: typeNames.get(p.typeId) ?? null,
        isRed: p.isRed,
        profitCashIsk,
        totalShippingIsk: p.shippingIsk,
        totalRelistFeesIsk: p.relistFeesIsk,
        totalBrokerFeesIsk: p.brokerFeesIsk,
        unitsSold: p.unitsSold,
        unitsRemaining: p.units,
      };
    });

    return {
      strategyId: params.strategyId,
      strategyName: params.strategyName,
      totalProfitIsk: totalProfitNavIsk,
      totalProfitCashIsk,
      avgProfitIskPerCycle: avgProfitNavIsk,
      avgProfitCashIskPerCycle: avgProfitCashIsk,
      cycles: cycleRows,
      notes,
      positionsSummary,
    };
  }

  private async computeCalibratedCapture(params: {
    stationIds: number[];
    typeIds: number[];
    anchorDateIso: string;
    windowDays: number;
  }): Promise<{ shareByPair: Map<string, number>; fallbackShare: number }> {
    const out = new Map<string, number>();
    const stationIds = Array.from(new Set(params.stationIds)).filter((x) =>
      Number.isFinite(x),
    );
    const typeIds = Array.from(new Set(params.typeIds)).filter((x) =>
      Number.isFinite(x),
    );
    if (!stationIds.length || !typeIds.length)
      return { shareByPair: out, fallbackShare: 0.02 };

    const dates = getLastNDatesIso(params.windowDays, params.anchorDateIso);
    if (!dates.length) return { shareByPair: out, fallbackShare: 0.02 };
    const windowStart = parseIsoDateOnly(dates[0]);
    const windowEnd = parseIsoDateOnly(dates[dates.length - 1]);
    const windowEndExclusive = addDays(windowEnd, 1);

    const marketTotals = await this.prisma.$queryRaw<
      Array<{ stationId: number; typeId: number; amount: bigint }>
    >(Prisma.sql`
      SELECT
        location_id AS "stationId",
        type_id AS "typeId",
        SUM(amount)::bigint AS "amount"
      FROM market_order_trades_daily
      WHERE is_buy_order = false
        AND has_gone = false
        AND location_id IN (${Prisma.join(stationIds)})
        AND type_id IN (${Prisma.join(typeIds)})
        AND scan_date >= ${windowStart}
        AND scan_date <= ${windowEnd}
      GROUP BY location_id, type_id
    `);

    const marketByPair = new Map<string, number>();
    let marketTotalAll = 0;
    for (const r of marketTotals) {
      const amt = Number(r.amount);
      marketByPair.set(`${r.stationId}:${r.typeId}`, amt);
      if (Number.isFinite(amt) && amt > 0) marketTotalAll += amt;
    }

    // We do NOT have sell_allocations populated in this environment (count=0).
    // Instead, calibrate capture using OUR actual sell wallet transactions at the destination station:
    // share ~= (our sold qty over window) / (market volume over window)
    const sellTotals = await this.prisma.$queryRaw<
      Array<{ stationId: number; typeId: number; qty: bigint }>
    >(Prisma.sql`
      SELECT
        location_id AS "stationId",
        type_id AS "typeId",
        SUM(quantity)::bigint AS "qty"
      FROM wallet_transactions
      WHERE is_buy = false
        AND location_id IN (${Prisma.join(stationIds)})
        AND type_id IN (${Prisma.join(typeIds)})
        AND date >= ${windowStart}
        AND date < ${windowEndExclusive}
      GROUP BY location_id, type_id
    `);

    let soldTotalAll = 0;
    for (const r of sellTotals) {
      const k = `${r.stationId}:${r.typeId}`;
      const sold = Number(r.qty);
      const market = marketByPair.get(k) ?? 0;
      if (!Number.isFinite(sold) || sold <= 0) continue;
      if (!Number.isFinite(market) || market <= 0) continue;
      const raw = sold / market;
      // Clamp to avoid pathological ratios; calibrated capture is meant to be conservative.
      const share = Math.max(0.0, Math.min(0.2, raw));
      out.set(k, share);
      soldTotalAll += sold;
    }

    // Data-driven fallback:
    // If we have any historical sells, use the *global* observed capture share over this same window.
    // This avoids the "everything falls back to 2%" behavior, which can make calibrated sweeps look
    // artificially flat and overly punitive.
    const globalRaw =
      marketTotalAll > 0 && soldTotalAll > 0
        ? soldTotalAll / marketTotalAll
        : 0;
    const fallbackShare =
      globalRaw > 0 ? Math.max(0.0, Math.min(0.2, globalRaw)) : 0.02;

    return { shareByPair: out, fallbackShare };
  }
}
