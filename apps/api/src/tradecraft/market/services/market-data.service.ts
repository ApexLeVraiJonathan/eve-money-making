import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';

/**
 * MarketDataService provides centralized access to market data.
 * This includes tracked stations, market order trades, and liquidity checks.
 *
 * Domain: Market data (trackedStation, marketOrderTradeDaily, liquidityCheck tables)
 */
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all tracked stations
   */
  async getTrackedStations(): Promise<
    Array<{
      id: string;
      stationId: number;
    }>
  > {
    return await this.prisma.trackedStation.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        stationId: true,
      },
    });
  }

  /**
   * Get tracked station IDs only
   */
  async getTrackedStationIds(): Promise<number[]> {
    const stations = await this.prisma.trackedStation.findMany({
      select: { stationId: true },
    });

    return stations.map((s) => s.stationId);
  }

  /**
   * Get latest market trade data for a type at a location
   */
  async getLatestMarketTrade(
    typeId: number,
    locationId: number,
  ): Promise<{
    scanDate: Date;
    high: number;
    low: number;
    avg: number;
    amount: number;
  } | null> {
    const latest = await this.prisma.marketOrderTradeDaily.findFirst({
      // Default to conservative mode for downstream heuristics.
      where: { typeId, locationId, isBuyOrder: false, hasGone: false },
      orderBy: { scanDate: 'desc' },
      select: {
        scanDate: true,
        high: true,
        low: true,
        avg: true,
        amount: true,
      },
    });

    if (!latest) return null;

    return {
      scanDate: latest.scanDate,
      high: Number(latest.high),
      low: Number(latest.low),
      avg: Number(latest.avg),
      amount: latest.amount,
    };
  }

  /**
   * Bulk fetch market trade data for multiple type-location combinations
   */
  async getMarketTrades(params: {
    typeIds?: number[];
    locationIds?: number[];
    since?: Date;
    limit?: number;
  }): Promise<
    Array<{
      typeId: number;
      locationId: number;
      scanDate: Date;
      high: string;
      low: string;
      avg: string;
      amount: number;
    }>
  > {
    // Default to conservative mode (hasGone=false).
    const whereClause: any = { hasGone: false };

    if (params.typeIds && params.typeIds.length > 0) {
      whereClause.typeId = { in: params.typeIds };
    }

    if (params.locationIds && params.locationIds.length > 0) {
      whereClause.locationId = { in: params.locationIds };
    }

    if (params.since) {
      whereClause.scanDate = { gte: params.since };
    }

    const rows = await this.prisma.marketOrderTradeDaily.findMany({
      where: whereClause,
      orderBy: { scanDate: 'desc' },
      take: params.limit ?? 1000,
    });

    return rows.map((r) => ({
      typeId: r.typeId,
      locationId: r.locationId,
      scanDate: r.scanDate,
      high: r.high.toString(),
      low: r.low.toString(),
      avg: r.avg.toString(),
      amount: r.amount,
    }));
  }

  /**
   * Get tracked station by station ID
   */
  async getTrackedStationByStationId(stationId: number): Promise<{
    id: string;
    stationId: number;
  } | null> {
    return await this.prisma.trackedStation.findFirst({
      where: { stationId },
      select: {
        id: true,
        stationId: true,
      },
    });
  }

  /**
   * Check if a station is tracked
   */
  async isStationTracked(stationId: number): Promise<boolean> {
    const count = await this.prisma.trackedStation.count({
      where: { stationId },
    });

    return count > 0;
  }

  /**
   * Get tracked stations with station details
   */
  async getTrackedStationsWithDetails(): Promise<
    Array<{
      stationId: number;
      stationName: string;
    }>
  > {
    const stations = await this.prisma.trackedStation.findMany({
      select: { stationId: true, station: { select: { name: true } } },
    });

    return stations.map((t) => ({
      stationId: t.stationId,
      stationName: t.station.name,
    }));
  }

  /**
   * Bulk fetch latest market trade data for many (typeId, locationId) pairs.
   *
   * This is used by pricing/undercut tooling to avoid N queries when
   * determining the "daily units sold" heuristic.
   */
  async getLatestMarketTradesForPairs(
    pairs: Array<{ typeId: number; locationId: number }>,
  ): Promise<
    Map<
      string,
      {
        scanDate: Date;
        high: number;
        low: number;
        avg: number;
        amount: number;
      }
    >
  > {
    const out = new Map<
      string,
      { scanDate: Date; high: number; low: number; avg: number; amount: number }
    >();
    if (!pairs.length) return out;

    const typeIds = Array.from(new Set(pairs.map((p) => p.typeId)));
    const locationIds = Array.from(new Set(pairs.map((p) => p.locationId)));
    const wanted = new Set(pairs.map((p) => `${p.locationId}:${p.typeId}`));

    // Fetch recent rows for the cartesian filter, then keep only the latest per pair.
    const rows = await this.prisma.marketOrderTradeDaily.findMany({
      where: {
        isBuyOrder: false,
        hasGone: false,
        typeId: { in: typeIds },
        locationId: { in: locationIds },
      },
      orderBy: [{ scanDate: 'desc' }],
      select: {
        typeId: true,
        locationId: true,
        scanDate: true,
        high: true,
        low: true,
        avg: true,
        amount: true,
      },
    });

    for (const r of rows) {
      const key = `${r.locationId}:${r.typeId}`;
      if (!wanted.has(key)) continue;
      if (out.has(key)) continue; // rows are scanDate desc; first hit is latest
      out.set(key, {
        scanDate: r.scanDate,
        high: Number(r.high),
        low: Number(r.low),
        avg: Number(r.avg),
        amount: r.amount,
      });
      if (out.size >= wanted.size) break;
    }

    return out;
  }
}
