import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { Readable } from 'node:stream';

import { PrismaService } from '../prisma/prisma.service';
import { DataImportService } from '@shared/data-import';

@Injectable()
export class ImportService {
  private readonly BASE_URL_ADAM4EVE = 'https://static.adam4eve.eu/';

  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly dataImportService: DataImportService,
  ) {}

  async importTypeIds(batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of type_ids.csv (batchSize=${batchSize})`,
      context,
    );

    let inserted = 0,
      skipped = 0,
      totalRows = 0;

    try {
      const res = await axios.get(
        `${this.BASE_URL_ADAM4EVE}/IDs/type_ids.csv`,
        {
          responseType: 'stream',
        },
      );
      const input = res.data as Readable;

    const batcher = this.dataImportService.createBatcher<{
      id: number;
      published: boolean;
      name: string;
    }>({
      size: batchSize,
      flush: async (items) => {
        const { count } = await this.prisma.typeId.createMany({
          data: items,
          skipDuplicates: true,
        });
        inserted += count;
          this.logger.log(`Inserted ${count} type_ids`, context);
      },
    });

    await this.dataImportService.streamCsv<Record<string, string>>(
      input,
      async (row) => {
        totalRows++;
          const id = Number(row.typeID);
          const name = row.typeName?.trim();
        if (!Number.isInteger(id) || !name) {
          skipped++;
          return;
        }
        await batcher.push({ id, published: row.published === '1', name });
      },
    );

    await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed during import of type_ids.csv',
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of type_ids.csv: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import:type_ids in ${durationMs}ms (inserted=${inserted}, skipped=${skipped}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { inserted, skipped, totalRows, batchSize };
  }

  async importRegionIds(batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of region_ids.csv (batchSize=${batchSize})`,
      context,
    );

    let inserted = 0,
      skipped = 0,
      totalRows = 0;

    try {
      const res = await axios.get(
        `${this.BASE_URL_ADAM4EVE}/IDs/region_ids.csv`,
        {
          responseType: 'stream',
        },
      );
      const input = res.data as Readable;

      const batcher = this.dataImportService.createBatcher<{
        id: number;
        name: string;
      }>({
        size: batchSize,
        flush: async (items) => {
          const { count } = await this.prisma.regionId.createMany({
            data: items,
            skipDuplicates: true,
          });
          inserted += count;
          this.logger.log(`Inserted ${count} regions`, context);
        },
      });

      await this.dataImportService.streamCsv<Record<string, string>>(
        input,
        async (row) => {
          totalRows++;
          const id = Number(row.regionID);
          const name = row.regionName?.trim();
          if (!Number.isInteger(id) || !name) {
            skipped++;
            return;
          }
          await batcher.push({ id, name });
        },
      );

      await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed during import of region_ids.csv',
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of region_ids.csv: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import:region_ids in ${durationMs}ms (inserted=${inserted}, skipped=${skipped}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { inserted, skipped, totalRows, batchSize };
  }

  async importSolarSystemIds(batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of solarSystem_ids.csv (batchSize=${batchSize})`,
      context,
    );

    let inserted = 0,
      skipped = 0,
      totalRows = 0;

    try {
      const res = await axios.get(
        `${this.BASE_URL_ADAM4EVE}/IDs/solarSystem_ids.csv`,
        {
          responseType: 'stream',
        },
      );
      const input = res.data as Readable;

      const batcher = this.dataImportService.createBatcher<{
        id: number;
        regionId: number;
        name: string;
      }>({
        size: batchSize,
        flush: async (items) => {
          const { count } = await this.prisma.solarSystemId.createMany({
            data: items,
            skipDuplicates: true,
          });
          inserted += count;
          this.logger.log(`Inserted ${count} solar systems`, context);
        },
      });

      await this.dataImportService.streamCsv<Record<string, string>>(
        input,
        async (row) => {
          totalRows++;
          const id = Number(row.solarSystemID);
          const regionId = Number(row.regionID);
          const name = row.solarSystemName?.trim();
          if (!Number.isInteger(id) || !Number.isInteger(regionId) || !name) {
            skipped++;
            return;
          }
          await batcher.push({ id, regionId, name });
        },
      );

      await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed during import of solarSystem_ids.csv',
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of solarSystem_ids.csv: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import:solarSystem_ids in ${durationMs}ms (inserted=${inserted}, skipped=${skipped}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { inserted, skipped, totalRows, batchSize };
  }

  async importNpcStationIds(batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of npcStation_ids.txt (batchSize=${batchSize})`,
      context,
    );

    let inserted = 0,
      skipped = 0,
      totalRows = 0;

    try {
      const res = await axios.get(
        `${this.BASE_URL_ADAM4EVE}/IDs/npcStation_ids.txt`,
        {
          responseType: 'stream',
        },
      );
      const input = res.data as Readable;

      const batcher = this.dataImportService.createBatcher<{
        id: number;
        solarSystemId: number;
        name: string;
      }>({
        size: batchSize,
        flush: async (items) => {
          const { count } = await this.prisma.stationId.createMany({
            data: items,
            skipDuplicates: true,
          });
          inserted += count;
          this.logger.log(`Inserted ${count} stations`, context);
        },
      });

      await this.dataImportService.streamCsv<Record<string, string>>(
        input,
        async (row) => {
          totalRows++;
          const id = Number(row['Station_ID']);
          const solarSystemId = Number(row['SolarSystem_ID']);
          const name = row['Station_Name']?.trim();
          if (
            !Number.isInteger(id) ||
            !Number.isInteger(solarSystemId) ||
            !name
          ) {
            skipped++;
            return;
          }
          await batcher.push({ id, solarSystemId, name });
        },
        {
          delimiter: '\t',
          from_line: 2,
          relax_column_count: true,
          trim: true,
        },
      );

      await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed during import of npcStation_ids.txt',
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of npcStation_ids.txt: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import:npcStation_ids in ${durationMs}ms (inserted=${inserted}, skipped=${skipped}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { inserted, skipped, totalRows, batchSize };
  }

  async importAll(batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import: all datasets (batchSize=${batchSize})`,
      context,
    );

    const results: Record<string, unknown> = {};
    try {
      const [typeIdsResult, regionIdsResult] = await Promise.all([
        this.importTypeIds(batchSize),
        this.importRegionIds(batchSize),
      ]);
      results.typeIds = typeIdsResult;
      results.regionIds = regionIdsResult;

      const solarSystemsResult = await this.importSolarSystemIds(batchSize);
      results.solarSystems = solarSystemsResult;

      const stationsResult = await this.importNpcStationIds(batchSize);
      results.stations = stationsResult;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed during import: all datasets',
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import: all datasets: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import: all datasets in ${durationMs}ms`,
        context,
      );
    }

    return results;
  }

  async importMarketOrderTradesByDate(date: string, batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of marketOrderTrades_daily_${date}.csv (batchSize=${batchSize})`,
      context,
    );

    // Collect tracked station IDs to filter rows
    const tracked = await this.prisma.trackedStation.findMany({
      select: { stationId: true },
    });
    const trackedSet = new Set(tracked.map((t) => t.stationId));

    let inserted = 0,
      skipped = 0,
      totalRows = 0;

    try {
      const yyyy = date.slice(0, 4);
      const url = `${this.BASE_URL_ADAM4EVE}/MarketOrdersTrades/${yyyy}/marketOrderTrades_daily_${date}.csv`;
      const res = await axios.get(url, { responseType: 'stream' });
      const input = res.data as Readable;

      const batcher = this.dataImportService.createBatcher<{
        scanDate: Date;
        locationId: number;
        typeId: number;
        isBuyOrder: boolean;
        regionId: number;
        hasGone: boolean;
        amount: number;
        high: string;
        low: string;
        avg: string;
        orderNum: number;
        iskValue: string;
      }>({
        size: batchSize,
        flush: async (items) => {
          const { count } = await this.prisma.marketOrderTradeDaily.createMany({
            data: items,
            skipDuplicates: true,
          });
          inserted += count;
        },
      });

      const scanDate = new Date(`${date}T00:00:00.000Z`);
      await this.dataImportService.streamCsv<Record<string, string>>(
        input,
        async (row) => {
          totalRows++;
          const locationId = Number(row.location_id);
          if (!trackedSet.has(locationId)) {
            skipped++;
            return;
          }
          const regionId = Number(row.region_id);
          const typeId = Number(row.type_id);
          const isBuyOrder = row.is_buy_order === '1';
          const hasGone = row.has_gone === '1';
          const amount = Number(row.amount);
          const high = row.high;
          const low = row.low;
          const avg = row.avg;
          const orderNum = Number(row.orderNum);
          const iskValue = row.iskValue;
          if (
            !Number.isInteger(locationId) ||
            !Number.isInteger(regionId) ||
            !Number.isInteger(typeId) ||
            !Number.isInteger(amount) ||
            !Number.isInteger(orderNum)
          ) {
            skipped++;
            return;
          }
          await batcher.push({
            scanDate,
            locationId,
            typeId,
            isBuyOrder,
            regionId,
            hasGone,
            amount,
            high,
            low,
            avg,
            orderNum,
            iskValue,
          });
        },
      );

      await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed during import of marketOrderTrades_daily_${date}.csv`,
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of marketOrderTrades_daily_${date}.csv: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import: marketOrderTrades_daily_${date} in ${durationMs}ms (inserted=${inserted}, skipped=${skipped}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { inserted, skipped, totalRows, batchSize };
  }

  async getMissingMarketOrderTradeDates(daysBack = 15) {
    const dates = this.dataImportService.getLastNDates(daysBack);
    const missing: string[] = [];
    for (const date of dates) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const count = await this.prisma.marketOrderTradeDaily.count({
        where: { scanDate: dayStart },
      });
      if (count === 0) missing.push(date);
    }
    return missing;
  }

  async importMissingMarketOrderTrades(daysBack = 15, batchSize = 5000) {
    const missing = await this.getMissingMarketOrderTradeDates(daysBack);
    const results: Record<string, unknown> = {};
    for (const date of missing) {
      results[date] = await this.importMarketOrderTradesByDate(date, batchSize);
    }
    return { missing, results };
  }
}
