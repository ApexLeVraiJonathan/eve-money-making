import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@api/prisma/prisma.service';
import { NpcMarketAggregatesService } from './npc-market-aggregates.service';
import { NpcMarketComparisonService } from './npc-market-comparison.service';
import { NpcMarketQueryService } from './npc-market-query.service';

describe('NpcMarketQueryService', () => {
  let service: NpcMarketQueryService;
  let prisma: {
    npcMarketStationBaseline: { findUnique: jest.Mock };
    npcMarketSnapshot: { findMany: jest.Mock };
    typeId: { findMany: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      npcMarketStationBaseline: { findUnique: jest.fn() },
      npcMarketSnapshot: { findMany: jest.fn() },
      typeId: { findMany: jest.fn(), findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NpcMarketQueryService,
        {
          provide: NpcMarketAggregatesService,
          useValue: { getDailyAggregates: jest.fn() },
        },
        {
          provide: NpcMarketComparisonService,
          useValue: { compareAdam4Eve: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<NpcMarketQueryService>(NpcMarketQueryService);
  });

  it('returns an empty latest snapshot when no valid station resolves', async () => {
    const result = await service.getSnapshotLatest({
      stationId: 'not-a-number',
    });

    expect(result).toEqual({
      stationId: null,
      baselineId: null,
      observedAt: null,
      totalOrders: 0,
      matchedOrders: 0,
      filteredOrders: 0,
      typeNames: {},
      orders: [],
    });
    expect(prisma.npcMarketStationBaseline.findUnique).not.toHaveBeenCalled();
  });

  it('groups latest snapshot rows by type and side', async () => {
    prisma.npcMarketStationBaseline.findUnique.mockResolvedValue({
      baselineId: 'baseline-1',
      observedAt: new Date('2026-01-02T03:04:05.000Z'),
    });
    prisma.npcMarketSnapshot.findMany.mockResolvedValue([
      {
        typeId: 34,
        isBuyOrder: false,
        orderCount: 3,
        bestPrice: 10,
      },
      {
        typeId: 34,
        isBuyOrder: true,
        orderCount: 2,
        bestPrice: 9,
      },
      {
        typeId: 35,
        isBuyOrder: false,
        orderCount: 0,
        bestPrice: 12,
      },
    ]);
    prisma.typeId.findMany.mockResolvedValue([{ id: 34, name: 'Tritanium' }]);

    const result = await service.getSnapshotLatestTypes({
      stationId: '60003760',
      side: 'ALL',
      limitTypes: 10,
    });

    expect(result).toEqual({
      stationId: 60003760,
      baselineId: 'baseline-1',
      observedAt: '2026-01-02T03:04:05.000Z',
      side: 'ALL',
      types: [
        {
          typeId: 34,
          typeName: 'Tritanium',
          sellCount: 3,
          buyCount: 2,
          bestSell: 10,
          bestBuy: 9,
        },
      ],
    });
  });
});
