import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@eve/prisma';
import { PrismaService } from '@api/prisma/prisma.service';
import type { MarketDataHealthResponse } from '@eve/shared/tradecraft-market';
import { utcDayStartFromYyyyMmDd } from '@api/tradecraft/npc-market/npc-market-date';
import { MarketDataHealthQueryDto } from './dto/market-data.dto';

type HealthSource = MarketDataHealthResponse['sources'][number];
type HealthDay = HealthSource['days'][number];

type DailyAggregate = {
  scanDate: Date;
  _count: { _all: number };
  _sum: { iskValue: Prisma.Decimal | null };
};

@Injectable()
export class MarketDataHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(
    query: MarketDataHealthQueryDto,
  ): Promise<MarketDataHealthResponse> {
    const range = this.resolveRange(query);
    const [npc, self] = await Promise.all([
      this.buildNpcHealth(range.start, range.end),
      this.buildSelfHealth(range.start, range.end),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      range: {
        startDate: this.formatDay(range.start),
        endDate: this.formatDay(range.end),
      },
      sources: [npc, self],
    };
  }

  private async buildNpcHealth(start: Date, end: Date): Promise<HealthSource> {
    const days = this.daysBetween(start, end);
    const nextEnd = this.addDays(end, 1);
    const [runs, aggregates, latestRun] = await Promise.all([
      this.prisma.npcMarketRun.findMany({
        where: { startedAt: { gte: start, lt: nextEnd } },
        select: { startedAt: true, ok: true },
      }),
      this.prisma.npcMarketOrderTradeDaily.groupBy({
        by: ['scanDate'],
        where: { scanDate: { gte: start, lte: end } },
        _count: { _all: true },
        _sum: { iskValue: true },
      }),
      this.prisma.npcMarketRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      }),
    ]);

    const runCounts = new Map<string, { successful: number; failed: number }>();
    for (const run of runs) {
      const day = this.formatDay(run.startedAt);
      const counts = runCounts.get(day) ?? { successful: 0, failed: 0 };
      if (run.ok) counts.successful += 1;
      else counts.failed += 1;
      runCounts.set(day, counts);
    }

    return this.buildSourceHealth({
      source: 'npc',
      label: 'NPC market scans',
      days,
      aggregates,
      runCounts,
      latestObservedAt: latestRun?.startedAt ?? null,
    });
  }

  private async buildSelfHealth(start: Date, end: Date): Promise<HealthSource> {
    const days = this.daysBetween(start, end);
    const [aggregates, latestSnapshot] = await Promise.all([
      this.prisma.selfMarketOrderTradeDaily.groupBy({
        by: ['scanDate'],
        where: { scanDate: { gte: start, lte: end } },
        _count: { _all: true },
        _sum: { iskValue: true },
      }),
      this.prisma.selfMarketSnapshotLatest.findFirst({
        orderBy: { observedAt: 'desc' },
        select: { observedAt: true },
      }),
    ]);

    return this.buildSourceHealth({
      source: 'self',
      label: 'Self-market scans',
      days,
      aggregates,
      runCounts: null,
      latestObservedAt: latestSnapshot?.observedAt ?? null,
    });
  }

  private buildSourceHealth(args: {
    source: 'npc' | 'self';
    label: string;
    days: string[];
    aggregates: DailyAggregate[];
    runCounts: Map<string, { successful: number; failed: number }> | null;
    latestObservedAt: Date | null;
  }): HealthSource {
    const aggregatesByDay = new Map(
      args.aggregates.map((row) => [this.formatDay(row.scanDate), row]),
    );
    const rows: HealthDay[] = [];
    const missingDays: string[] = [];
    const warnings: string[] = [];
    let previousIsk: Prisma.Decimal | null = null;

    for (const day of args.days) {
      const aggregate = aggregatesByDay.get(day) ?? null;
      const runCounts = args.runCounts?.get(day) ?? null;
      const totalIsk = aggregate?._sum.iskValue ?? new Prisma.Decimal(0);
      let warning: string | null = null;

      if (!aggregate || aggregate._count._all === 0) {
        missingDays.push(day);
        warning = 'No daily aggregate rows';
      } else if (
        previousIsk &&
        previousIsk.gt(0) &&
        totalIsk.gt(0) &&
        (totalIsk.div(previousIsk).gt(3) || totalIsk.div(previousIsk).lt(0.33))
      ) {
        warning = 'Daily ISK total changed by more than 3x from prior data day';
      }

      if (warning) warnings.push(`${day}: ${warning}`);
      if (aggregate && totalIsk.gt(0)) previousIsk = totalIsk;

      rows.push({
        date: day,
        successfulRuns: runCounts ? runCounts.successful : null,
        failedRuns: runCounts ? runCounts.failed : null,
        aggregateRows: aggregate?._count._all ?? 0,
        totalIskValue: totalIsk.toString(),
        warning,
      });
    }

    const daysWithData = rows.filter((row) => row.aggregateRows > 0).length;
    const successfulRuns =
      args.runCounts === null
        ? null
        : Array.from(args.runCounts.values()).reduce(
            (sum, counts) => sum + counts.successful,
            0,
          );
    const failedRuns =
      args.runCounts === null
        ? null
        : Array.from(args.runCounts.values()).reduce(
            (sum, counts) => sum + counts.failed,
            0,
          );

    return {
      source: args.source,
      label: args.label,
      status: this.resolveStatus(args.days.length, missingDays, warnings),
      expectedDays: args.days.length,
      daysWithData,
      missingDays,
      successfulRuns,
      failedRuns,
      latestObservedAt: args.latestObservedAt?.toISOString() ?? null,
      warnings,
      days: rows,
    };
  }

  private resolveRange(query: MarketDataHealthQueryDto): {
    start: Date;
    end: Date;
  } {
    const today = new Date();
    const defaultEnd = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const defaultStart = this.addDays(defaultEnd, -13);
    const start = query.startDate
      ? utcDayStartFromYyyyMmDd(query.startDate)
      : defaultStart;
    const end = query.endDate ? utcDayStartFromYyyyMmDd(query.endDate) : defaultEnd;
    if (!start || !end) throw new BadRequestException('Invalid date range');
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('startDate must be <= endDate');
    }
    return { start, end };
  }

  private resolveStatus(
    expectedDays: number,
    missingDays: string[],
    warnings: string[],
  ): HealthSource['status'] {
    if (missingDays.length === expectedDays) return 'missing';
    if (missingDays.length > 0 || warnings.length > 0) return 'watch';
    return 'healthy';
  }

  private daysBetween(start: Date, end: Date): string[] {
    const days: string[] = [];
    for (let day = start; day.getTime() <= end.getTime(); day = this.addDays(day, 1)) {
      days.push(this.formatDay(day));
    }
    return days;
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private formatDay(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}

