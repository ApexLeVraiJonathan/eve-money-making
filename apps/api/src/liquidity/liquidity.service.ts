import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataImportService } from '@shared/data-import';
import type { Prisma } from '@eve/prisma';
import type { LiquidityItemDto } from './dto/liquidity-item.dto';

@Injectable()
export class LiquidityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataImport: DataImportService,
  ) {}

  async runCheck(
    params?: {
      station_id?: number;
      windowDays?: number;
      minCoverageRatio?: number; // 0..1
      minLiquidityThresholdISK?: number; // average daily isk_value
      minWindowTrades?: number; // average trades per day over window
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _reqId?: string,
  ): Promise<
    Record<
      string,
      { stationName: string; totalItems: number; items: LiquidityItemDto[] }
    >
  > {
    const stationId = params?.station_id;
    const windowDays = params?.windowDays ?? 30;
    const minCoverageRatio = params?.minCoverageRatio ?? 0.57;
    const minISK = params?.minLiquidityThresholdISK ?? 1_000_000; // 1M
    const minTradesPerDay = params?.minWindowTrades ?? 5; // average trades/day

    // Determine stations to analyze and station names
    let stationIds: number[] = [];
    const stationIdToName = new Map<number, string>();

    if (stationId) {
      stationIds = [stationId];
      const s = await this.prisma.stationId.findUnique({
        where: { id: stationId },
        select: { name: true },
      });
      if (s?.name) stationIdToName.set(stationId, s.name);
    } else {
      const tracked = await this.prisma.trackedStation.findMany({
        select: { stationId: true, station: { select: { name: true } } },
      });
      stationIds = tracked.map((t) => t.stationId);
      for (const t of tracked) {
        if (t.station?.name) stationIdToName.set(t.stationId, t.station.name);
      }
    }

    if (stationIds.length === 0) return {};

    // Date window (yesterday backward)
    const dates = this.dataImport.getLastNDates(windowDays);
    const result: Record<
      string,
      { stationName: string; totalItems: number; items: LiquidityItemDto[] }
    > = {};

    // Concurrency limit to avoid overloading DB
    const concurrency = Math.min(4, Math.max(1, stationIds.length));
    let index = 0;
    const entries: Array<[number, LiquidityItemDto[]]> = [];

    const workers = Array.from({ length: concurrency }, async () => {
      for (;;) {
        const current = index++;
        if (current >= stationIds.length) break;
        const sId = stationIds[current];
        const items = await this.computeStationLiquidity(
          sId,
          dates,
          minCoverageRatio,
          minISK,
          minTradesPerDay,
        );
        entries.push([sId, items]);
      }
    });

    await Promise.all(workers);

    for (const [sId, items] of entries) {
      result[String(sId)] = {
        stationName: stationIdToName.get(sId) ?? '',
        totalItems: items.length,
        items,
      };
    }

    return result;
  }

  private async computeStationLiquidity(
    sId: number,
    dates: string[],
    minCoverageRatio: number,
    minISK: number,
    minTradesPerDay: number,
  ): Promise<LiquidityItemDto[]> {
    const rows = (await this.prisma.marketOrderTradeDaily.findMany({
      where: {
        locationId: sId,
        isBuyOrder: false,
        scanDate: { in: dates.map((d) => new Date(`${d}T00:00:00.000Z`)) },
      },
      include: { type: true },
    })) as unknown as Array<{
      typeId: number;
      scanDate: Date;
      amount: number;
      iskValue: Prisma.Decimal;
      high: Prisma.Decimal;
      low: Prisma.Decimal;
      avg: Prisma.Decimal;
      orderNum: number;
      type: { name: string } | null;
    }>;

    const byType = new Map<
      number,
      Array<{
        typeId: number;
        scanDate: Date;
        amount: number;
        iskValue: Prisma.Decimal;
        high: Prisma.Decimal;
        low: Prisma.Decimal;
        avg: Prisma.Decimal;
        orderNum: number;
        type: { name: string } | null;
      }>
    >();
    for (const r of rows) {
      const list = byType.get(r.typeId) ?? [];
      list.push(r);
      byType.set(r.typeId, list);
    }

    const items: LiquidityItemDto[] = [];
    for (const [tId, list] of byType) {
      const uniqueDays = new Set(list.map((r) => r.scanDate.toISOString()));
      const coverage = uniqueDays.size / dates.length;
      if (coverage < minCoverageRatio) continue;

      const totalAmount = list.reduce((sum, r) => sum + r.amount, 0);
      const avgDailyAmount = Math.round(totalAmount / dates.length);

      const totalIsk = list.reduce((sum, r) => sum + Number(r.iskValue), 0);
      const avgDailyIskValue = Math.round(totalIsk / dates.length);
      if (avgDailyIskValue < minISK) continue;

      // Average trades per day over the window, from orderNum
      const totalTrades = list.reduce((sum, r) => sum + (r.orderNum ?? 0), 0);
      const avgDailyTrades = Math.round(totalTrades / dates.length);
      if (avgDailyTrades < minTradesPerDay) continue;

      let latest = null as { high: string; low: string; avg: string } | null;
      let latestDateMs = -1;
      for (const r of list) {
        const ms = r.scanDate.getTime();
        if (ms > latestDateMs) {
          latestDateMs = ms;
          latest = {
            high: r.high.toString(),
            low: r.low.toString(),
            avg: r.avg.toString(),
          };
        }
      }

      items.push({
        typeId: tId,
        typeName: list[0]?.type?.name,
        avgDailyAmount,
        latest,
        avgDailyIskValue,
        coverageDays: uniqueDays.size,
        avgDailyTrades,
      });
    }

    return items.sort((a, b) => b.avgDailyIskValue - a.avgDailyIskValue);
  }

  async getItemStats(
    params: {
      itemId?: number;
      itemName?: string;
      stationId?: number;
      stationName?: string;
      isBuyOrder?: boolean;
      windowDays?: number;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _reqId?: string,
  ): Promise<
    Record<
      string,
      {
        stationName: string;
        buy?: {
          perDay: Array<{
            date: string;
            amount: number;
            high: string;
            low: string;
            avg: string;
            orderNum: number;
            iskValue: string;
          }>;
          windowAverages: { amountAvg: number; iskValueAvg: number };
        };
        sell?: {
          perDay: Array<{
            date: string;
            amount: number;
            high: string;
            low: string;
            avg: string;
            orderNum: number;
            iskValue: string;
          }>;
          windowAverages: { amountAvg: number; iskValueAvg: number };
        };
      }
    >
  > {
    const windowDays = params.windowDays ?? 7;
    // Resolve typeId
    let typeId = params.itemId;
    if (!typeId && params.itemName) {
      const t = await this.prisma.typeId.findFirst({
        where: { name: params.itemName },
        select: { id: true },
      });
      typeId = t?.id;
    }
    if (!typeId) return {};

    // Resolve stations and names
    let stationIds: number[] = [];
    const stationIdToName = new Map<number, string>();
    if (params.stationId) {
      stationIds = [params.stationId];
      const s = await this.prisma.stationId.findUnique({
        where: { id: params.stationId },
        select: { name: true },
      });
      if (s?.name) stationIdToName.set(params.stationId, s.name);
    } else if (params.stationName) {
      const s = await this.prisma.stationId.findFirst({
        where: { name: params.stationName },
        select: { id: true, name: true },
      });
      if (s) {
        stationIds = [s.id];
        stationIdToName.set(s.id, s.name);
      }
    } else {
      const tracked = await this.prisma.trackedStation.findMany({
        select: { stationId: true, station: { select: { name: true } } },
      });
      stationIds = tracked.map((t) => t.stationId);
      for (const t of tracked) {
        if (t.station?.name) stationIdToName.set(t.stationId, t.station.name);
      }
    }
    if (stationIds.length === 0) return {};

    const dates = this.dataImport.getLastNDates(windowDays);

    const sides: boolean[] =
      typeof params.isBuyOrder === 'boolean'
        ? [params.isBuyOrder]
        : [true, false];

    type SideStats = {
      perDay: Array<{
        date: string;
        amount: number;
        high: string;
        low: string;
        avg: string;
        orderNum: number;
        iskValue: string;
      }>;
      windowAverages: { amountAvg: number; iskValueAvg: number };
    };

    const result: Record<
      string,
      { stationName: string; buy?: SideStats; sell?: SideStats }
    > = {};

    const concurrency = Math.min(4, Math.max(1, stationIds.length));
    let idx = 0;
    const entries: Array<
      [number, { stationName: string; buy?: SideStats; sell?: SideStats }]
    > = [];

    const computeSide = async (
      sId: number,
      isBuy: boolean,
    ): Promise<SideStats> => {
      const rows = await this.prisma.marketOrderTradeDaily.findMany({
        where: {
          locationId: sId,
          typeId,
          isBuyOrder: isBuy,
          scanDate: { in: dates.map((d) => new Date(`${d}T00:00:00.000Z`)) },
        },
        orderBy: { scanDate: 'asc' },
      });

      const perDay = rows.map((r) => ({
        date: r.scanDate.toISOString().slice(0, 10),
        amount: r.amount,
        high: (r.high as unknown as Prisma.Decimal).toString(),
        low: (r.low as unknown as Prisma.Decimal).toString(),
        avg: (r.avg as unknown as Prisma.Decimal).toString(),
        orderNum: r.orderNum,
        iskValue: (r.iskValue as unknown as Prisma.Decimal).toString(),
      }));

      const amountAvg = Math.round(
        perDay.reduce((s, d) => s + d.amount, 0) / Math.max(1, perDay.length),
      );
      const iskValueAvg = Math.round(
        perDay.reduce((s, d) => s + Number(d.iskValue), 0) /
          Math.max(1, perDay.length),
      );

      return { perDay, windowAverages: { amountAvg, iskValueAvg } };
    };

    const workers = Array.from({ length: concurrency }, async () => {
      for (;;) {
        const current = idx++;
        if (current >= stationIds.length) break;
        const sId = stationIds[current];
        const stationName = stationIdToName.get(sId) ?? '';
        const entry: {
          stationName: string;
          buy?: SideStats;
          sell?: SideStats;
        } = { stationName };

        if (sides.length === 2) {
          const [buyStats, sellStats] = await Promise.all([
            computeSide(sId, true),
            computeSide(sId, false),
          ]);
          entry.buy = buyStats;
          entry.sell = sellStats;
        } else {
          const only = await computeSide(sId, sides[0]);
          if (sides[0]) entry.buy = only;
          else entry.sell = only;
        }

        entries.push([sId, entry]);
      }
    });

    await Promise.all(workers);

    for (const [sId, entry] of entries) {
      result[String(sId)] = entry;
    }

    return result;
  }
}
