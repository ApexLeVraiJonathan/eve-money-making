import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@api/prisma/prisma.service';
import { NpcMarketComparisonService } from './npc-market-comparison.service';

describe('NpcMarketComparisonService', () => {
  let service: NpcMarketComparisonService;
  let prisma: {
    stationId: { findUnique: jest.Mock };
    npcMarketOrderTradeDaily: { findMany: jest.Mock };
    marketOrderTradeDaily: { findMany: jest.Mock };
    npcMarketRun: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      stationId: { findUnique: jest.fn() },
      npcMarketOrderTradeDaily: { findMany: jest.fn() },
      marketOrderTradeDaily: { findMany: jest.fn() },
      npcMarketRun: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NpcMarketComparisonService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<NpcMarketComparisonService>(
      NpcMarketComparisonService,
    );
  });

  it('returns coverage summary and top mismatches by absolute ISK diff', async () => {
    prisma.stationId.findUnique.mockResolvedValue({
      id: 60004588,
      name: 'Rens VI - Moon 8 - Brutor Tribe Treasury',
    });
    prisma.npcMarketOrderTradeDaily.findMany.mockResolvedValue([
      {
        scanDate: new Date('2026-05-01T00:00:00.000Z'),
        stationId: 60004588,
        typeId: 34,
        isBuyOrder: false,
        hasGone: false,
        amount: 100n,
        orderNum: 2n,
        iskValue: '2000',
        high: '21',
        low: '19',
        avg: '20',
      },
      {
        scanDate: new Date('2026-05-01T00:00:00.000Z'),
        stationId: 60004588,
        typeId: 35,
        isBuyOrder: false,
        hasGone: false,
        amount: 5n,
        orderNum: 1n,
        iskValue: '500',
        high: '100',
        low: '100',
        avg: '100',
      },
    ]);
    prisma.marketOrderTradeDaily.findMany.mockResolvedValue([
      {
        scanDate: new Date('2026-05-01T00:00:00.000Z'),
        locationId: 60004588,
        typeId: 34,
        isBuyOrder: false,
        hasGone: false,
        amount: 90,
        orderNum: 1,
        iskValue: '1800',
        high: '20',
        low: '20',
        avg: '20',
      },
    ]);
    prisma.npcMarketRun.findMany.mockResolvedValue([
      { startedAt: new Date('2026-05-01T01:00:00.000Z') },
      { startedAt: new Date('2026-05-01T02:00:00.000Z') },
    ]);

    const result = await service.compareAdam4Eve(
      {
        startDate: '2026-05-01',
        endDate: '2026-05-01',
        side: 'SELL',
        limit: 10,
      },
      60004588,
    );

    expect(result.summary).toEqual({
      npcRows: 2,
      adamRows: 1,
      unionKeys: 2,
      missingNpc: 0,
      missingAdam: 1,
    });
    expect(result.coverage.successfulNpcRunsByDay).toEqual({
      '2026-05-01': 2,
    });
    expect(result.diffs[0]).toMatchObject({
      scanDate: '2026-05-01',
      typeId: 34,
      diff: {
        amount: '10',
        orderNum: '1',
        iskValue: '200',
        absIskValue: '200',
      },
    });
    expect(result.diffs[1]).toMatchObject({
      typeId: 35,
      adam4eve: null,
      diff: {
        amount: null,
        orderNum: null,
        iskValue: null,
        absIskValue: null,
      },
    });
  });
});

