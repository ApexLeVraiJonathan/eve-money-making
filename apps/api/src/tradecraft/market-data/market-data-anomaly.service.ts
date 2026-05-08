import { Injectable } from '@nestjs/common';
import { AppConfig } from '@api/common/config';
import { Prisma } from '@eve/prisma';
import { PrismaService } from '@api/prisma/prisma.service';
import type { MarketDataAnomaliesResponse } from '@eve/shared/tradecraft-market';

type MarketDataSource = 'npc' | 'self';
type AnomalySeverity =
  | 'normal'
  | 'borderline'
  | 'severe'
  | 'insufficient-reference';
type AnomalyAction = 'none' | 'included_flagged' | 'excluded';

export type MarketPriceAnomalyDecision = {
  severity: AnomalySeverity;
  action: AnomalyAction;
  reasonCode: string;
  observedPrice: Prisma.Decimal;
  referencePrice: Prisma.Decimal | null;
  referenceSource: string | null;
  thresholdLow: Prisma.Decimal | null;
  thresholdHigh: Prisma.Decimal | null;
};

export type MarketPriceReference = {
  price: Prisma.Decimal | null;
  source: string | null;
};

export type MarketPriceAnomalyInput = {
  source: MarketDataSource;
  locationId: bigint;
  typeId: number;
  isBuyOrder: boolean;
  observedPrice: Prisma.Decimal.Value;
  observedVolume: bigint;
  scanObservedAt: Date;
  localReference?: MarketPriceReference;
  regionalReferencePrice?: Prisma.Decimal.Value | null;
  metadata?: Prisma.InputJsonValue;
};

type LocalAggregateRow = {
  amount: bigint | number;
  avg: Prisma.Decimal;
};

@Injectable()
export class MarketDataAnomalyService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateAndRecord(
    input: MarketPriceAnomalyInput,
  ): Promise<MarketPriceAnomalyDecision> {
    const decision = await this.evaluate(input);
    if (decision.action !== 'none') {
      await this.record(input, decision);
    }
    return decision;
  }

  async evaluate(
    input: MarketPriceAnomalyInput,
  ): Promise<MarketPriceAnomalyDecision> {
    return this.evaluateWithReference(input, await this.resolveReference(input));
  }

  evaluateWithReference(
    input: MarketPriceAnomalyInput,
    reference: MarketPriceReference,
  ): MarketPriceAnomalyDecision {
    const observedPrice = new Prisma.Decimal(input.observedPrice);
    const referencePrice = reference.price;
    const referenceSource = reference.source;

    if (!referencePrice || referencePrice.lte(0)) {
      return {
        severity: 'insufficient-reference',
        action: 'included_flagged',
        reasonCode: 'INSUFFICIENT_REFERENCE_PRICE',
        observedPrice,
        referencePrice: null,
        referenceSource: null,
        thresholdLow: null,
        thresholdHigh: null,
      };
    }

    const severeLow = referencePrice.mul(0.1);
    const severeHigh = referencePrice.mul(10);
    const borderlineLow = referencePrice.mul(0.33);
    const borderlineHigh = referencePrice.mul(3);

    if (observedPrice.gte(severeHigh) || observedPrice.lte(severeLow)) {
      return {
        severity: 'severe',
        action: 'excluded',
        reasonCode: observedPrice.gte(severeHigh)
          ? this.sideAwareReason(input.isBuyOrder, 'HIGH')
          : this.sideAwareReason(input.isBuyOrder, 'LOW'),
        observedPrice,
        referencePrice,
        referenceSource,
        thresholdLow: severeLow,
        thresholdHigh: severeHigh,
      };
    }

    if (observedPrice.gte(borderlineHigh) || observedPrice.lte(borderlineLow)) {
      return {
        severity: 'borderline',
        action: 'included_flagged',
        reasonCode: observedPrice.gte(borderlineHigh)
          ? this.sideAwareReason(input.isBuyOrder, 'HIGH')
          : this.sideAwareReason(input.isBuyOrder, 'LOW'),
        observedPrice,
        referencePrice,
        referenceSource,
        thresholdLow: borderlineLow,
        thresholdHigh: borderlineHigh,
      };
    }

    return {
      severity: 'normal',
      action: 'none',
      reasonCode: 'PRICE_WITHIN_REFERENCE_RANGE',
      observedPrice,
      referencePrice,
      referenceSource,
      thresholdLow: borderlineLow,
      thresholdHigh: borderlineHigh,
    };
  }

  async preloadLocalReferences(params: {
    source: MarketDataSource;
    locationId: bigint;
    typeIds: number[];
    observedAt: Date;
  }): Promise<Map<string, MarketPriceReference>> {
    const uniqueTypeIds = Array.from(new Set(params.typeIds)).filter(
      (typeId) => Number.isFinite(typeId) && typeId > 0,
    );
    if (!uniqueTypeIds.length) return new Map();

    const since = new Date(params.observedAt.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rows =
      params.source === 'npc'
        ? await this.prisma.npcMarketOrderTradeDaily.findMany({
            where: {
              stationId: Number(params.locationId),
              typeId: { in: uniqueTypeIds },
              hasGone: false,
              scanDate: { gte: since, lt: params.observedAt },
            },
            select: {
              typeId: true,
              isBuyOrder: true,
              amount: true,
              avg: true,
            },
          })
        : await this.prisma.selfMarketOrderTradeDaily.findMany({
            where: {
              locationId: params.locationId,
              typeId: { in: uniqueTypeIds },
              hasGone: false,
              scanDate: { gte: since, lt: params.observedAt },
            },
            select: {
              typeId: true,
              isBuyOrder: true,
              amount: true,
              avg: true,
            },
          });

    const byTypeSide = new Map<string, LocalAggregateRow[]>();
    for (const row of rows) {
      const key = this.referenceKey(row.typeId, row.isBuyOrder);
      const bucket = byTypeSide.get(key) ?? [];
      bucket.push(row);
      byTypeSide.set(key, bucket);
    }

    const refs = new Map<string, MarketPriceReference>();
    for (const [key, bucket] of byTypeSide.entries()) {
      refs.set(key, this.weightedAverage(bucket));
    }
    return refs;
  }

  shouldIncludeInAggregate(decision: MarketPriceAnomalyDecision): boolean {
    return decision.action !== 'excluded';
  }

  shouldRecordAggregateDecision(decision: MarketPriceAnomalyDecision): boolean {
    return (
      decision.action !== 'none' && decision.severity !== 'insufficient-reference'
    );
  }

  referenceKey(typeId: number, isBuyOrder: boolean): string {
    return `${typeId}:${isBuyOrder ? 'B' : 'S'}`;
  }

  async recordBatch(
    inputs: Array<{
      input: MarketPriceAnomalyInput;
      decision: MarketPriceAnomalyDecision;
    }>,
    client: Pick<PrismaService, 'marketPriceAnomaly'> = this.prisma,
  ): Promise<number> {
    const rows = inputs
      .filter(({ decision }) => decision.action !== 'none')
      .map(({ input, decision }) => ({
        source: input.source,
        locationId: input.locationId,
        typeId: input.typeId,
        isBuyOrder: input.isBuyOrder,
        observedPrice: decision.observedPrice,
        observedVolume: input.observedVolume,
        referencePrice: decision.referencePrice,
        thresholdLow: decision.thresholdLow,
        thresholdHigh: decision.thresholdHigh,
        severity: decision.severity,
        action: decision.action,
        reasonCode: decision.reasonCode,
        referenceSource: decision.referenceSource,
        scanObservedAt: input.scanObservedAt,
        metadata: input.metadata,
      }));
    if (!rows.length) return 0;
    const res = await client.marketPriceAnomaly.createMany({ data: rows });
    return res.count;
  }

  async getRecentAnomalies(): Promise<MarketDataAnomaliesResponse> {
    const retentionDays = AppConfig.marketDataRetention().anomalyRetentionDays;
    const since = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const [examples, bySeverity, byAction] = await Promise.all([
      this.prisma.marketPriceAnomaly.findMany({
        where: { scanObservedAt: { gte: since } },
        orderBy: { scanObservedAt: 'desc' },
        take: 50,
      }),
      this.prisma.marketPriceAnomaly.groupBy({
        by: ['severity'],
        where: { scanObservedAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.marketPriceAnomaly.groupBy({
        by: ['action'],
        where: { scanObservedAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    const severityCounts = Object.fromEntries(
      bySeverity.map((row) => [row.severity, row._count._all]),
    );
    const actionCounts = Object.fromEntries(
      byAction.map((row) => [row.action, row._count._all]),
    );

    return {
      generatedAt: new Date().toISOString(),
      retentionDays,
      summary: {
        total: bySeverity.reduce((sum, row) => sum + row._count._all, 0),
        bySeverity: severityCounts,
        byAction: actionCounts,
      },
      examples: examples.map((row) => ({
        id: row.id,
        source: row.source === 'self' ? 'self' : 'npc',
        locationId: row.locationId.toString(),
        typeId: row.typeId,
        isBuyOrder: row.isBuyOrder,
        observedPrice: row.observedPrice.toString(),
        observedVolume: row.observedVolume.toString(),
        referencePrice: row.referencePrice?.toString() ?? null,
        thresholdLow: row.thresholdLow?.toString() ?? null,
        thresholdHigh: row.thresholdHigh?.toString() ?? null,
        severity: row.severity,
        action: row.action,
        reasonCode: row.reasonCode,
        referenceSource: row.referenceSource,
        scanObservedAt: row.scanObservedAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private async record(
    input: MarketPriceAnomalyInput,
    decision: MarketPriceAnomalyDecision,
  ): Promise<void> {
    await this.prisma.marketPriceAnomaly.create({
      data: {
        source: input.source,
        locationId: input.locationId,
        typeId: input.typeId,
        isBuyOrder: input.isBuyOrder,
        observedPrice: decision.observedPrice,
        observedVolume: input.observedVolume,
        referencePrice: decision.referencePrice,
        thresholdLow: decision.thresholdLow,
        thresholdHigh: decision.thresholdHigh,
        severity: decision.severity,
        action: decision.action,
        reasonCode: decision.reasonCode,
        referenceSource: decision.referenceSource,
        scanObservedAt: input.scanObservedAt,
        metadata: input.metadata,
      },
    });
  }

  private async resolveReference(
    input: MarketPriceAnomalyInput,
  ): Promise<MarketPriceReference> {
    if (input.localReference !== undefined) {
      const regionalReference =
        input.regionalReferencePrice == null
          ? null
          : new Prisma.Decimal(input.regionalReferencePrice);
      return {
        price: input.localReference.price ?? regionalReference,
        source:
          input.localReference.source ??
          (regionalReference ? 'esi-regional-depth' : null),
      };
    }

    const localReference = await this.loadLocalReference(input);
    const regionalReference =
      input.regionalReferencePrice == null
        ? null
        : new Prisma.Decimal(input.regionalReferencePrice);
    return {
      price: localReference.price ?? regionalReference,
      source:
        localReference.source ??
        (regionalReference ? 'esi-regional-depth' : null),
    };
  }

  private async loadLocalReference(input: MarketPriceAnomalyInput): Promise<{
    price: Prisma.Decimal | null;
    source: string | null;
  }> {
    const since = new Date(
      input.scanObservedAt.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
    const rows =
      input.source === 'npc'
        ? await this.loadNpcLocalRows(input, since)
        : await this.loadSelfLocalRows(input, since);
    return this.weightedAverage(rows);
  }

  private async loadNpcLocalRows(
    input: MarketPriceAnomalyInput,
    since: Date,
  ): Promise<LocalAggregateRow[]> {
    return this.prisma.npcMarketOrderTradeDaily.findMany({
      where: {
        stationId: Number(input.locationId),
        typeId: input.typeId,
        isBuyOrder: input.isBuyOrder,
        hasGone: false,
        scanDate: { gte: since, lt: input.scanObservedAt },
      },
      select: { amount: true, avg: true },
    });
  }

  private async loadSelfLocalRows(
    input: MarketPriceAnomalyInput,
    since: Date,
  ): Promise<LocalAggregateRow[]> {
    return this.prisma.selfMarketOrderTradeDaily.findMany({
      where: {
        locationId: input.locationId,
        typeId: input.typeId,
        isBuyOrder: input.isBuyOrder,
        hasGone: false,
        scanDate: { gte: since, lt: input.scanObservedAt },
      },
      select: { amount: true, avg: true },
    });
  }

  private weightedAverage(rows: LocalAggregateRow[]): MarketPriceReference {
    const totals = rows.reduce(
      (acc, row) => {
        const amount = new Prisma.Decimal(row.amount.toString());
        return {
          amount: acc.amount.add(amount),
          value: acc.value.add(row.avg.mul(amount)),
        };
      },
      { amount: new Prisma.Decimal(0), value: new Prisma.Decimal(0) },
    );
    if (totals.amount.lte(0)) return { price: null, source: null };
    return {
      price: totals.value.div(totals.amount),
      source: 'accepted-local-history',
    };
  }

  private sideAwareReason(isBuyOrder: boolean, direction: 'HIGH' | 'LOW'): string {
    if (isBuyOrder && direction === 'HIGH') return 'DANGEROUS_HIGH_BUY_PRICE';
    if (!isBuyOrder && direction === 'LOW') return 'DANGEROUS_LOW_SELL_PRICE';
    return direction === 'HIGH' ? 'UNUSUAL_HIGH_PRICE' : 'UNUSUAL_LOW_PRICE';
  }
}

