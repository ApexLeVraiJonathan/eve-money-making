import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@api/prisma/prisma.service';
import { SelfMarketQueryService } from './self-market-query.service';

describe('SelfMarketQueryService', () => {
  let service: SelfMarketQueryService;
  let prisma: {
    selfMarketSnapshotLatest: { findUnique: jest.Mock };
    selfMarketOrderTradeDaily: { findMany: jest.Mock };
    typeId: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      selfMarketSnapshotLatest: { findUnique: jest.fn() },
      selfMarketOrderTradeDaily: { findMany: jest.fn() },
      typeId: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SelfMarketQueryService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<SelfMarketQueryService>(SelfMarketQueryService);
  });

  it('filters latest structure snapshots by type, side, and limit', async () => {
    prisma.selfMarketSnapshotLatest.findUnique.mockResolvedValue({
      observedAt: new Date('2026-01-02T03:04:05.000Z'),
      orders: [
        { type_id: 34, is_buy_order: false, order_id: 1 },
        { type_id: 34, is_buy_order: true, order_id: 2 },
        { type_id: 35, is_buy_order: false, order_id: 3 },
      ],
    });
    prisma.typeId.findMany.mockResolvedValue([{ id: 34, name: 'Tritanium' }]);

    const result = await service.getSnapshotLatest({
      structureId: '1045667241057',
      typeId: 34,
      side: 'SELL',
      limit: 1,
    });

    expect(result).toEqual({
      structureId: '1045667241057',
      observedAt: '2026-01-02T03:04:05.000Z',
      totalOrders: 3,
      matchedOrders: 1,
      filteredOrders: 1,
      typeTotalOrders: 1,
      typeNames: { '34': 'Tritanium' },
      orders: [{ type_id: 34, is_buy_order: false, order_id: 1 }],
    });
  });

  it('preserves literal false hasGone query parsing for daily aggregates', async () => {
    prisma.selfMarketOrderTradeDaily.findMany.mockResolvedValue([
      {
        scanDate: new Date('2026-01-02T00:00:00.000Z'),
        locationId: 1045667241057n,
        typeId: 34,
        isBuyOrder: false,
        hasGone: false,
        amount: 5n,
        high: 12,
        low: 10,
        avg: 11,
        orderNum: 2n,
        iskValue: 55,
      },
    ]);
    prisma.typeId.findMany.mockResolvedValue([{ id: 34, name: 'Tritanium' }]);

    const result = await service.getDailyAggregates({
      query: {
        structureId: '1045667241057',
        date: '2026-01-02',
        hasGone: true,
        side: 'SELL',
      },
      rawHasGone: 'false',
    });

    const expectedWhere: unknown = expect.objectContaining({ hasGone: false });
    const expectedQuery: unknown = expect.objectContaining({
      where: expectedWhere,
    });
    expect(prisma.selfMarketOrderTradeDaily.findMany).toHaveBeenCalledWith(
      expectedQuery,
    );
    expect(result).toMatchObject({
      structureId: '1045667241057',
      date: '2026-01-02',
      hasGone: false,
      side: 'SELL',
      typeNames: { '34': 'Tritanium' },
    });
  });
});
