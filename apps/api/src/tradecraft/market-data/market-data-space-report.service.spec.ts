import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@api/prisma/prisma.service';
import { MarketDataSpaceReportService } from './market-data-space-report.service';

describe('MarketDataSpaceReportService', () => {
  let service: MarketDataSpaceReportService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataSpaceReportService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<MarketDataSpaceReportService>(
      MarketDataSpaceReportService,
    );
  });

  it('returns table sizes, row estimates, and timestamp ranges', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          tableName: 'npc_market_snapshots',
          rowCountEstimate: 123n,
          tableBytes: 1000n,
          indexBytes: 250n,
          totalBytes: 1250n,
        },
        {
          tableName: 'market_order_trades_daily',
          rowCountEstimate: 20n,
          tableBytes: 500n,
          indexBytes: 100n,
          totalBytes: 600n,
        },
      ])
      .mockResolvedValueOnce([
        {
          oldestRecordAt: new Date('2026-01-01T00:00:00.000Z'),
          newestRecordAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          oldestRecordAt: new Date('2026-01-03T00:00:00.000Z'),
          newestRecordAt: new Date('2026-01-04T00:00:00.000Z'),
        },
      ]);

    const result = await service.getReport();

    expect(result.totals).toMatchObject({
      tableBytes: '1500',
      indexBytes: '350',
      totalBytes: '1850',
      existingTableCount: 2,
    });
    expect(result.tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: 'npc_market_snapshots',
          exists: true,
          rowCountEstimate: '123',
          rowCountIsEstimate: true,
          tableBytes: '1000',
          indexBytes: '250',
          totalBytes: '1250',
          oldestRecordAt: '2026-01-01T00:00:00.000Z',
          newestRecordAt: '2026-01-02T00:00:00.000Z',
        }),
        expect.objectContaining({
          tableName: 'market_order_trades_daily',
          exists: true,
          retentionPolicy: 'indefinite',
          oldestRecordAt: '2026-01-03T00:00:00.000Z',
          newestRecordAt: '2026-01-04T00:00:00.000Z',
        }),
        expect.objectContaining({
          tableName: 'market_price_anomalies',
          exists: false,
          rowCountEstimate: null,
          tableBytes: null,
        }),
      ]),
    );
  });
});

