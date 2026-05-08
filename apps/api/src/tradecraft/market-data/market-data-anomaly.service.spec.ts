import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@eve/prisma';
import { PrismaService } from '@api/prisma/prisma.service';
import { MarketDataAnomalyService } from './market-data-anomaly.service';

describe('MarketDataAnomalyService', () => {
  let service: MarketDataAnomalyService;
  let prisma: {
    npcMarketOrderTradeDaily: { findMany: jest.Mock };
    selfMarketOrderTradeDaily: { findMany: jest.Mock };
    marketPriceAnomaly: {
      create: jest.Mock;
      createMany: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      npcMarketOrderTradeDaily: { findMany: jest.fn() },
      selfMarketOrderTradeDaily: { findMany: jest.fn() },
      marketPriceAnomaly: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataAnomalyService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<MarketDataAnomalyService>(MarketDataAnomalyService);
  });

  it('uses accepted local history first and records severe outliers', async () => {
    prisma.npcMarketOrderTradeDaily.findMany.mockResolvedValue([
      { amount: 10n, avg: new Prisma.Decimal(20_000_000) },
      { amount: 10n, avg: new Prisma.Decimal(20_000_000) },
    ]);
    prisma.marketPriceAnomaly.create.mockResolvedValue({});

    const decision = await service.evaluateAndRecord({
      source: 'npc',
      locationId: 60004588n,
      typeId: 34,
      isBuyOrder: false,
      observedPrice: new Prisma.Decimal(20_000_000_000),
      observedVolume: 1n,
      scanObservedAt: new Date('2026-05-08T12:00:00.000Z'),
      regionalReferencePrice: new Prisma.Decimal(100_000_000),
    });

    expect(decision).toMatchObject({
      severity: 'severe',
      action: 'excluded',
      reasonCode: 'UNUSUAL_HIGH_PRICE',
      referenceSource: 'accepted-local-history',
    });
    expect(decision.referencePrice?.toString()).toBe('20000000');
    expect(prisma.marketPriceAnomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'npc',
          locationId: 60004588n,
          typeId: 34,
          severity: 'severe',
          action: 'excluded',
          referenceSource: 'accepted-local-history',
        }),
      }),
    );
  });

  it('falls back to regional ESI context when local history is missing', async () => {
    prisma.selfMarketOrderTradeDaily.findMany.mockResolvedValue([]);
    prisma.marketPriceAnomaly.create.mockResolvedValue({});

    const decision = await service.evaluateAndRecord({
      source: 'self',
      locationId: 1045667241057n,
      typeId: 35,
      isBuyOrder: true,
      observedPrice: new Prisma.Decimal(20),
      observedVolume: 2n,
      scanObservedAt: new Date('2026-05-08T12:00:00.000Z'),
      regionalReferencePrice: new Prisma.Decimal(100),
    });

    expect(decision).toMatchObject({
      severity: 'borderline',
      action: 'included_flagged',
      reasonCode: 'UNUSUAL_LOW_PRICE',
      referenceSource: 'esi-regional-depth',
    });
    expect(prisma.marketPriceAnomaly.create).toHaveBeenCalledTimes(1);
  });

  it('flags insufficient reference data without excluding the order', async () => {
    prisma.npcMarketOrderTradeDaily.findMany.mockResolvedValue([]);
    prisma.marketPriceAnomaly.create.mockResolvedValue({});

    const decision = await service.evaluateAndRecord({
      source: 'npc',
      locationId: 60004588n,
      typeId: 36,
      isBuyOrder: true,
      observedPrice: new Prisma.Decimal(10),
      observedVolume: 1n,
      scanObservedAt: new Date('2026-05-08T12:00:00.000Z'),
    });

    expect(decision).toMatchObject({
      severity: 'insufficient-reference',
      action: 'included_flagged',
      reasonCode: 'INSUFFICIENT_REFERENCE_PRICE',
    });
    expect(prisma.marketPriceAnomaly.create).toHaveBeenCalledTimes(1);
  });

  it('uses precomputed references without querying local history', () => {
    const decision = service.evaluateWithReference(
      {
        source: 'npc',
        locationId: 60004588n,
        typeId: 34,
        isBuyOrder: true,
        observedPrice: new Prisma.Decimal(1_000),
        observedVolume: 1n,
        scanObservedAt: new Date('2026-05-08T12:00:00.000Z'),
      },
      {
        price: new Prisma.Decimal(100),
        source: 'accepted-local-history',
      },
    );

    expect(prisma.npcMarketOrderTradeDaily.findMany).not.toHaveBeenCalled();
    expect(decision).toMatchObject({
      severity: 'severe',
      action: 'excluded',
      reasonCode: 'DANGEROUS_HIGH_BUY_PRICE',
      referenceSource: 'accepted-local-history',
    });
  });

  it('uses severe thresholds to exclude aggregate contributions', () => {
    const highDecision = service.evaluateWithReference(
      {
        source: 'npc',
        locationId: 60004588n,
        typeId: 34,
        isBuyOrder: true,
        observedPrice: new Prisma.Decimal(1_000),
        observedVolume: 1n,
        scanObservedAt: new Date('2026-05-08T12:00:00.000Z'),
      },
      { price: new Prisma.Decimal(100), source: 'accepted-local-history' },
    );
    const lowDecision = service.evaluateWithReference(
      {
        source: 'npc',
        locationId: 60004588n,
        typeId: 34,
        isBuyOrder: false,
        observedPrice: new Prisma.Decimal(10),
        observedVolume: 1n,
        scanObservedAt: new Date('2026-05-08T12:00:00.000Z'),
      },
      { price: new Prisma.Decimal(100), source: 'accepted-local-history' },
    );

    expect(highDecision).toMatchObject({
      severity: 'severe',
      action: 'excluded',
      reasonCode: 'DANGEROUS_HIGH_BUY_PRICE',
    });
    expect(lowDecision).toMatchObject({
      severity: 'severe',
      action: 'excluded',
      reasonCode: 'DANGEROUS_LOW_SELL_PRICE',
    });
    expect(service.shouldIncludeInAggregate(highDecision)).toBe(false);
    expect(service.shouldIncludeInAggregate(lowDecision)).toBe(false);
    expect(service.shouldRecordAggregateDecision(highDecision)).toBe(true);
  });

  it('keeps borderline aggregate contributions but records them as flagged', () => {
    const highDecision = service.evaluateWithReference(
      {
        source: 'self',
        locationId: 1045667241057n,
        typeId: 35,
        isBuyOrder: false,
        observedPrice: new Prisma.Decimal(300),
        observedVolume: 2n,
        scanObservedAt: new Date('2026-05-08T12:00:00.000Z'),
      },
      { price: new Prisma.Decimal(100), source: 'accepted-local-history' },
    );
    const lowDecision = service.evaluateWithReference(
      {
        source: 'self',
        locationId: 1045667241057n,
        typeId: 35,
        isBuyOrder: false,
        observedPrice: new Prisma.Decimal(33),
        observedVolume: 2n,
        scanObservedAt: new Date('2026-05-08T12:00:00.000Z'),
      },
      { price: new Prisma.Decimal(100), source: 'accepted-local-history' },
    );

    expect(highDecision).toMatchObject({
      severity: 'borderline',
      action: 'included_flagged',
      reasonCode: 'UNUSUAL_HIGH_PRICE',
    });
    expect(lowDecision).toMatchObject({
      severity: 'borderline',
      action: 'included_flagged',
      reasonCode: 'DANGEROUS_LOW_SELL_PRICE',
    });
    expect(service.shouldIncludeInAggregate(highDecision)).toBe(true);
    expect(service.shouldIncludeInAggregate(lowDecision)).toBe(true);
    expect(service.shouldRecordAggregateDecision(highDecision)).toBe(true);
  });

  it('does not record aggregate anomalies for missing references', () => {
    const decision = service.evaluateWithReference(
      {
        source: 'self',
        locationId: 1045667241057n,
        typeId: 35,
        isBuyOrder: true,
        observedPrice: new Prisma.Decimal(100),
        observedVolume: 2n,
        scanObservedAt: new Date('2026-05-08T12:00:00.000Z'),
      },
      { price: null, source: null },
    );

    expect(decision).toMatchObject({
      severity: 'insufficient-reference',
      action: 'included_flagged',
    });
    expect(service.shouldIncludeInAggregate(decision)).toBe(true);
    expect(service.shouldRecordAggregateDecision(decision)).toBe(false);
  });

  it('batch records only decisions that require an anomaly row', async () => {
    prisma.marketPriceAnomaly.createMany.mockResolvedValue({ count: 1 });

    const input = {
      source: 'self' as const,
      locationId: 1045667241057n,
      typeId: 35,
      isBuyOrder: false,
      observedPrice: new Prisma.Decimal(10),
      observedVolume: 2n,
      scanObservedAt: new Date('2026-05-08T12:00:00.000Z'),
    };

    const count = await service.recordBatch([
      {
        input,
        decision: {
          severity: 'borderline',
          action: 'included_flagged',
          reasonCode: 'DANGEROUS_LOW_SELL_PRICE',
          observedPrice: new Prisma.Decimal(10),
          referencePrice: new Prisma.Decimal(100),
          referenceSource: 'accepted-local-history',
          thresholdLow: new Prisma.Decimal(33),
          thresholdHigh: new Prisma.Decimal(300),
        },
      },
      {
        input,
        decision: {
          severity: 'normal',
          action: 'none',
          reasonCode: 'PRICE_WITHIN_REFERENCE_RANGE',
          observedPrice: new Prisma.Decimal(100),
          referencePrice: new Prisma.Decimal(100),
          referenceSource: 'accepted-local-history',
          thresholdLow: new Prisma.Decimal(33),
          thresholdHigh: new Prisma.Decimal(300),
        },
      },
    ]);

    expect(count).toBe(1);
    expect(prisma.marketPriceAnomaly.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          source: 'self',
          action: 'included_flagged',
          reasonCode: 'DANGEROUS_LOW_SELL_PRICE',
        }),
      ],
    });
  });
});

