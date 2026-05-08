import { Injectable } from '@nestjs/common';
import { Prisma } from '@eve/prisma';
import { PrismaService } from '@api/prisma/prisma.service';
import type { MarketDataSpaceReportResponse } from '@eve/shared/tradecraft-market';

type MarketTableCategory =
  MarketDataSpaceReportResponse['tables'][number]['category'];
type MarketTableRetention =
  MarketDataSpaceReportResponse['tables'][number]['retentionPolicy'];

type MarketTableDefinition = {
  tableName: string;
  label: string;
  category: MarketTableCategory;
  retentionPolicy: MarketTableRetention;
  timestampColumn: string | null;
  notes: string | null;
};

type PgSizeRow = {
  tableName: string;
  rowCountEstimate: bigint | number | string | null;
  tableBytes: bigint | number | string;
  indexBytes: bigint | number | string;
  totalBytes: bigint | number | string;
};

type TimestampRangeRow = {
  oldestRecordAt: Date | string | null;
  newestRecordAt: Date | string | null;
};

const MARKET_TABLES: MarketTableDefinition[] = [
  {
    tableName: 'npc_market_snapshots',
    label: 'NPC market raw snapshots',
    category: 'raw-npc',
    retentionPolicy: 'short-lived',
    timestampColumn: 'observed_at',
    notes: 'High-growth full JSON order snapshots; planned for 14-day retention.',
  },
  {
    tableName: 'npc_market_region_types_snapshots',
    label: 'NPC region type snapshots',
    category: 'raw-npc',
    retentionPolicy: 'short-lived',
    timestampColumn: 'observed_at',
    notes: 'Per-run ESI region type universe snapshots.',
  },
  {
    tableName: 'npc_market_runs',
    label: 'NPC market collection runs',
    category: 'run-metadata',
    retentionPolicy: 'short-lived',
    timestampColumn: 'started_at',
    notes: 'Run metadata for successful and failed NPC market scans.',
  },
  {
    tableName: 'npc_market_station_baselines',
    label: 'NPC market active baselines',
    category: 'baseline',
    retentionPolicy: 'latest-only',
    timestampColumn: 'observed_at',
    notes: 'Current baseline pointer per station; needed for snapshot diffs.',
  },
  {
    tableName: 'self_market_snapshot_latest',
    label: 'Self-market latest snapshots',
    category: 'snapshot-latest',
    retentionPolicy: 'latest-only',
    timestampColumn: 'observed_at',
    notes: 'Latest structure orderbook per configured structure.',
  },
  {
    tableName: 'npc_market_order_trades_daily',
    label: 'NPC gathered daily aggregates',
    category: 'daily-aggregate',
    retentionPolicy: 'indefinite',
    timestampColumn: 'scan_date',
    notes: 'Durable gathered NPC daily market aggregates.',
  },
  {
    tableName: 'self_market_order_trades_daily',
    label: 'Self-market daily aggregates',
    category: 'daily-aggregate',
    retentionPolicy: 'indefinite',
    timestampColumn: 'scan_date',
    notes: 'Durable gathered structure daily market aggregates.',
  },
  {
    tableName: 'market_order_trades_daily',
    label: 'Adam4EVE daily aggregates',
    category: 'daily-aggregate',
    retentionPolicy: 'indefinite',
    timestampColumn: 'scan_date',
    notes: 'Imported Adam4EVE reference aggregates.',
  },
  {
    tableName: 'market_price_anomalies',
    label: 'Market price anomalies',
    category: 'anomaly',
    retentionPolicy: 'planned',
    timestampColumn: 'scan_observed_at',
    notes: 'Planned anomaly explanation table; expected in a later issue.',
  },
];

@Injectable()
export class MarketDataSpaceReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(): Promise<MarketDataSpaceReportResponse> {
    const sizeRows = await this.loadSizeRows();
    const sizeByTable = new Map(sizeRows.map((row) => [row.tableName, row]));

    const tables = await Promise.all(
      MARKET_TABLES.map(async (definition) => {
        const size = sizeByTable.get(definition.tableName) ?? null;
        const range =
          size && definition.timestampColumn
            ? await this.loadTimestampRange(definition)
            : null;

        return {
          tableName: definition.tableName,
          label: definition.label,
          category: definition.category,
          retentionPolicy: definition.retentionPolicy,
          exists: Boolean(size),
          rowCountEstimate:
            size?.rowCountEstimate == null
              ? null
              : this.toDecimalString(size.rowCountEstimate),
          rowCountIsEstimate: true,
          tableBytes: size ? this.toDecimalString(size.tableBytes) : null,
          indexBytes: size ? this.toDecimalString(size.indexBytes) : null,
          totalBytes: size ? this.toDecimalString(size.totalBytes) : null,
          oldestRecordAt: this.toIsoString(range?.oldestRecordAt ?? null),
          newestRecordAt: this.toIsoString(range?.newestRecordAt ?? null),
          timestampColumn: definition.timestampColumn,
          notes: definition.notes,
        };
      }),
    );

    const totals = tables.reduce(
      (acc, table) => {
        acc.tableBytes += BigInt(table.tableBytes ?? 0);
        acc.indexBytes += BigInt(table.indexBytes ?? 0);
        acc.totalBytes += BigInt(table.totalBytes ?? 0);
        if (table.exists) acc.existingTableCount += 1;
        else acc.missingTableCount += 1;
        return acc;
      },
      {
        tableBytes: 0n,
        indexBytes: 0n,
        totalBytes: 0n,
        existingTableCount: 0,
        missingTableCount: 0,
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      tables,
      totals: {
        tableBytes: totals.tableBytes.toString(),
        indexBytes: totals.indexBytes.toString(),
        totalBytes: totals.totalBytes.toString(),
        existingTableCount: totals.existingTableCount,
        missingTableCount: totals.missingTableCount,
      },
    };
  }

  private async loadSizeRows(): Promise<PgSizeRow[]> {
    const tableNames = MARKET_TABLES.map((table) => table.tableName);
    return this.prisma.$queryRaw<PgSizeRow[]>(Prisma.sql`
      SELECT
        c.relname AS "tableName",
        COALESCE(s.n_live_tup, c.reltuples, 0)::bigint AS "rowCountEstimate",
        pg_relation_size(c.oid)::bigint AS "tableBytes",
        pg_indexes_size(c.oid)::bigint AS "indexBytes",
        pg_total_relation_size(c.oid)::bigint AS "totalBytes"
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = current_schema()
        AND c.relkind IN ('r', 'p')
        AND c.relname IN (${Prisma.join(tableNames)})
    `);
  }

  private async loadTimestampRange(
    definition: MarketTableDefinition,
  ): Promise<TimestampRangeRow | null> {
    if (!definition.timestampColumn) return null;

    const rows = await this.prisma.$queryRaw<TimestampRangeRow[]>(Prisma.sql`
      SELECT
        MIN(${Prisma.raw(this.quoteIdentifier(definition.timestampColumn))}) AS "oldestRecordAt",
        MAX(${Prisma.raw(this.quoteIdentifier(definition.timestampColumn))}) AS "newestRecordAt"
      FROM ${Prisma.raw(this.quoteIdentifier(definition.tableName))}
    `);
    return rows[0] ?? null;
  }

  private quoteIdentifier(identifier: string): string {
    if (!/^[a-z0-9_]+$/i.test(identifier)) {
      throw new Error(`Unsafe SQL identifier: ${identifier}`);
    }
    return `"${identifier}"`;
  }

  private toDecimalString(value: bigint | number | string): string {
    return typeof value === 'bigint' ? value.toString() : String(value);
  }

  private toIsoString(value: Date | string | null): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}

