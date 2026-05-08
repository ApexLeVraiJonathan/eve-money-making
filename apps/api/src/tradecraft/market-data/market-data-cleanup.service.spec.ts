import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@api/prisma/prisma.service';
import { MarketDataCleanupService } from './market-data-cleanup.service';

type CleanupPrismaMock = {
  $transaction: jest.Mock;
  npcMarketStationBaseline: { findMany: jest.Mock };
  npcMarketSnapshot: { deleteMany: jest.Mock };
  npcMarketRegionTypesSnapshot: { deleteMany: jest.Mock };
  npcMarketRun: { deleteMany: jest.Mock };
  marketPriceAnomaly: { deleteMany: jest.Mock };
};

type CleanupTransactionMock = Omit<CleanupPrismaMock, '$transaction'>;

describe('MarketDataCleanupService', () => {
  const originalEnv = process.env;
  let service: MarketDataCleanupService;
  let prisma: CleanupPrismaMock;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.MARKET_CLEANUP_ENABLED;
    delete process.env.MARKET_RAW_RETENTION_DAYS;
    delete process.env.MARKET_ANOMALY_RETENTION_DAYS;

    prisma = {
      $transaction: jest.fn((callback: (tx: CleanupTransactionMock) => unknown) =>
        callback(prisma),
      ),
      npcMarketStationBaseline: { findMany: jest.fn() },
      npcMarketSnapshot: { deleteMany: jest.fn() },
      npcMarketRegionTypesSnapshot: { deleteMany: jest.fn() },
      npcMarketRun: { deleteMany: jest.fn() },
      marketPriceAnomaly: { deleteMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataCleanupService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<MarketDataCleanupService>(MarketDataCleanupService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('deletes expired raw NPC rows while preserving active baselines', async () => {
    process.env.MARKET_RAW_RETENTION_DAYS = '14';
    prisma.npcMarketStationBaseline.findMany.mockResolvedValue([
      { baselineId: 'active-baseline' },
    ]);
    prisma.npcMarketSnapshot.deleteMany.mockResolvedValue({ count: 11 });
    prisma.npcMarketRegionTypesSnapshot.deleteMany.mockResolvedValue({
      count: 2,
    });
    prisma.npcMarketRun.deleteMany.mockResolvedValue({ count: 3 });

    const result = await service.cleanupRawNpcMarketData({
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    const expectedCutoff = new Date('2026-04-24T12:00:00.000Z');
    expect(prisma.npcMarketSnapshot.deleteMany).toHaveBeenCalledWith({
      where: {
        observedAt: { lt: expectedCutoff },
        baselineId: { notIn: ['active-baseline'] },
      },
    });
    expect(prisma.npcMarketRegionTypesSnapshot.deleteMany).toHaveBeenCalledWith({
      where: {
        observedAt: { lt: expectedCutoff },
        baselineId: { notIn: ['active-baseline'] },
      },
    });
    expect(prisma.npcMarketRun.deleteMany).toHaveBeenCalledWith({
      where: {
        startedAt: { lt: expectedCutoff },
        baselineId: { notIn: ['active-baseline'] },
      },
    });
    expect(result).toMatchObject({
      ok: true,
      skipped: false,
      retentionDays: 14,
      cutoff: '2026-04-24T12:00:00.000Z',
      protectedBaselineIds: ['active-baseline'],
      deleted: {
        npcMarketSnapshots: 11,
        npcMarketRegionTypesSnapshots: 2,
        npcMarketRuns: 3,
      },
    });
  });

  it('skips cleanup when disabled', async () => {
    process.env.MARKET_CLEANUP_ENABLED = 'false';

    const result = await service.cleanupRawNpcMarketData({
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      skipped: true,
      reason: 'MARKET_CLEANUP_ENABLED is disabled',
      deleted: {
        npcMarketSnapshots: 0,
        npcMarketRegionTypesSnapshots: 0,
        npcMarketRuns: 0,
      },
    });
  });

  it('deletes anomaly records outside the anomaly retention window', async () => {
    process.env.MARKET_ANOMALY_RETENTION_DAYS = '90';
    prisma.marketPriceAnomaly.deleteMany.mockResolvedValue({ count: 7 });

    const result = await service.cleanupExpiredMarketAnomalies({
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    expect(prisma.marketPriceAnomaly.deleteMany).toHaveBeenCalledWith({
      where: { scanObservedAt: { lt: new Date('2026-02-07T12:00:00.000Z') } },
    });
    expect(result).toMatchObject({
      ok: true,
      skipped: false,
      retentionDays: 90,
      cutoff: '2026-02-07T12:00:00.000Z',
      deleted: 7,
    });
  });
});

