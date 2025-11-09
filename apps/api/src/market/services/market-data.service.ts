import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
      where: { typeId, locationId, isBuyOrder: false },
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
    const whereClause: any = {};

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
}
