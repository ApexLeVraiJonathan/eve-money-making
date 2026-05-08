import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@eve/prisma';
import { PrismaService } from '@api/prisma/prisma.service';
import { MarketDataHealthService } from './market-data-health.service';

describe('MarketDataHealthService', () => {
  let service: MarketDataHealthService;
  let prisma: {
    npcMarketRun: { findMany: jest.Mock; findFirst: jest.Mock };
    npcMarketOrderTradeDaily: { groupBy: jest.Mock };
    selfMarketOrderTradeDaily: { groupBy: jest.Mock };
    selfMarketSnapshotLatest: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      npcMarketRun: { findMany: jest.fn(), findFirst: jest.fn() },
      npcMarketOrderTradeDaily: { groupBy: jest.fn() },
      selfMarketOrderTradeDaily: { groupBy: jest.fn() },
      selfMarketSnapshotLatest: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataHealthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<MarketDataHealthService>(MarketDataHealthService);
  });

  it('reports healthy scan coverage when every day has aggregate data', async () => {
    prisma.npcMarketRun.findMany.mockResolvedValue([
      { startedAt: new Date('2026-05-01T01:00:00.000Z'), ok: true },
      { startedAt: new Date('2026-05-02T01:00:00.000Z'), ok: true },
    ]);
    prisma.npcMarketRun.findFirst.mockResolvedValue({
      startedAt: new Date('2026-05-02T01:00:00.000Z'),
    });
    prisma.npcMarketOrderTradeDaily.groupBy.mockResolvedValue([
      aggregate('2026-05-01', 10, '1000'),
      aggregate('2026-05-02', 12, '1100'),
    ]);
    prisma.selfMarketOrderTradeDaily.groupBy.mockResolvedValue([
      aggregate('2026-05-01', 8, '900'),
      aggregate('2026-05-02', 9, '950'),
    ]);
    prisma.selfMarketSnapshotLatest.findFirst.mockResolvedValue({
      observedAt: new Date('2026-05-02T02:00:00.000Z'),
    });

    const result = await service.getHealth({
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    });

    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'npc',
          status: 'healthy',
          expectedDays: 2,
          daysWithData: 2,
          successfulRuns: 2,
          missingDays: [],
          warnings: [],
        }),
        expect.objectContaining({
          source: 'self',
          status: 'healthy',
          expectedDays: 2,
          daysWithData: 2,
          successfulRuns: null,
          missingDays: [],
          warnings: [],
        }),
      ]),
    );
  });

  it('reports missing and unstable days as watch signals', async () => {
    prisma.npcMarketRun.findMany.mockResolvedValue([
      { startedAt: new Date('2026-05-01T01:00:00.000Z'), ok: true },
      { startedAt: new Date('2026-05-03T01:00:00.000Z'), ok: false },
    ]);
    prisma.npcMarketRun.findFirst.mockResolvedValue({
      startedAt: new Date('2026-05-03T01:00:00.000Z'),
    });
    prisma.npcMarketOrderTradeDaily.groupBy.mockResolvedValue([
      aggregate('2026-05-01', 10, '1000'),
      aggregate('2026-05-03', 10, '5000'),
    ]);
    prisma.selfMarketOrderTradeDaily.groupBy.mockResolvedValue([]);
    prisma.selfMarketSnapshotLatest.findFirst.mockResolvedValue(null);

    const result = await service.getHealth({
      startDate: '2026-05-01',
      endDate: '2026-05-03',
    });

    const npc = result.sources.find((source) => source.source === 'npc');
    const self = result.sources.find((source) => source.source === 'self');
    expect(npc).toMatchObject({
      status: 'watch',
      missingDays: ['2026-05-02'],
      failedRuns: 1,
    });
    expect(npc?.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('No daily aggregate rows'),
        expect.stringContaining('changed by more than 3x'),
      ]),
    );
    expect(self).toMatchObject({
      status: 'missing',
      daysWithData: 0,
      missingDays: ['2026-05-01', '2026-05-02', '2026-05-03'],
    });
  });
});

function aggregate(date: string, count: number, iskValue: string) {
  return {
    scanDate: new Date(`${date}T00:00:00.000Z`),
    _count: { _all: count },
    _sum: { iskValue: new Prisma.Decimal(iskValue) },
  };
}

