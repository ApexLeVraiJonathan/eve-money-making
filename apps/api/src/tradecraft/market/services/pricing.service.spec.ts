import { PricingService } from './pricing.service';
import { fetchStationOrders } from '@api/esi/market-helpers';

jest.mock('@api/esi/market-helpers', () => ({
  fetchStationOrders: jest.fn(),
}));

const fetchStationOrdersMock = fetchStationOrders as jest.MockedFunction<
  typeof fetchStationOrders
>;

function isoDaysAgo(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

describe('PricingService.undercutCheck', () => {
  const stationId = 60003760;
  const regionId = 10000002;
  const typeId = 34;

  const makeSvc = (opts?: {
    orders?: Array<{
      order_id: number;
      type_id: number;
      is_buy_order: boolean;
      duration?: number;
      price: number;
      volume_remain: number;
      volume_total: number;
      location_id: number;
      issued?: string;
    }>;
    dailyUnitsSold?: number;
    stationSells?: Array<{ price: number; volume: number }>;
  }) => {
    const esi = {
      withMaxConcurrency: async <T>(_max: number, fn: () => Promise<T>) =>
        await fn(),
    };

    const esiChars = {
      getOrders: async (_characterId: number) => opts?.orders ?? [],
    };

    const gameData = {
      getStationsWithRegions: async (_stationIds: number[]) =>
        new Map<number, { name: string; regionId: number }>([
          [stationId, { name: 'Test Station', regionId }],
        ]),
      getTypeNames: async (_typeIds: number[]) =>
        new Map<number, string>([[typeId, 'Tritanium']]),
    };

    const characterService = {
      getCharacterName: async (_id: number) => 'Test Character',
      getSellerCharacters: async () => [{ id: 123, name: 'Test Character' }],
    };

    const marketData = {
      getTrackedStationIds: async () => [stationId],
      getLatestMarketTradesForPairs: async () =>
        new Map<string, { amount: number }>([
          [`${stationId}:${typeId}`, { amount: opts?.dailyUnitsSold ?? 0 }],
        ]),
    };

    const cycleLineService = {
      getCycleLinesForCycle: async () => [],
    };

    const cycleService = {
      getOpenCycleIdForDate: async () => 'cycle',
    };

    // Not used by undercutCheck in these tests
    const prisma = {};
    const feeService = {};

    // Mock competitor sells
    fetchStationOrdersMock.mockImplementation(
      async () => opts?.stationSells ?? [],
    );

    return new PricingService(
      prisma as any,
      esi as any,
      esiChars as any,
      feeService as any,
      gameData as any,
      characterService as any,
      marketData as any,
      cycleLineService as any,
      cycleService as any,
    );
  };

  beforeEach(() => {
    fetchStationOrdersMock.mockReset();
  });

  it('includes expiring-soon orders for refresh even if not undercut', async () => {
    const svc = makeSvc({
      orders: [
        {
          order_id: 1,
          type_id: typeId,
          is_buy_order: false,
          price: 110,
          volume_remain: 10,
          volume_total: 10,
          location_id: stationId,
          issued: isoDaysAgo(89),
          duration: 90,
        },
      ],
      stationSells: [], // not undercut
    });

    const res = await svc.undercutCheck({
      characterIds: [123],
      stationIds: [stationId],
      groupingMode: 'perOrder',
      expiryRefreshDays: 2,
    });

    expect(res).toHaveLength(1);
    expect(res[0]?.updates).toHaveLength(1);
    const u = res[0].updates[0];

    expect(u.orderId).toBe(1);
    expect(u.reasons).toEqual(['expiry']);
    expect(u.isExpiringSoon).toBe(true);
    expect(typeof u.expiresInHours).toBe('number');
    expect(u.expiresInHours!).toBeGreaterThan(0);
    expect(u.expiresInHours!).toBeLessThanOrEqual(48);
    expect(u.suggestedNewPriceTicked).toBe(109);
  });

  it('for global mode, prioritizes lowest-remaining order and ladders a second when daily volume exceeds it', async () => {
    const svc = makeSvc({
      orders: [
        {
          order_id: 10,
          type_id: typeId,
          is_buy_order: false,
          price: 110,
          volume_remain: 5,
          volume_total: 100,
          location_id: stationId,
          issued: isoDaysAgo(1),
          duration: 90,
        },
        {
          order_id: 11,
          type_id: typeId,
          is_buy_order: false,
          price: 111,
          volume_remain: 100,
          volume_total: 100,
          location_id: stationId,
          issued: isoDaysAgo(1),
          duration: 90,
        },
      ],
      dailyUnitsSold: 10, // > 5 triggers ladder second
      stationSells: [{ price: 100, volume: 50 }],
    });

    const res = await svc.undercutCheck({
      characterIds: [123],
      stationIds: [stationId],
      groupingMode: 'global',
      minUndercutUnits: 1,
      minUndercutVolumeRatio: 0.15,
      expiryRefreshDays: 0, // keep this test focused on undercut+ladder
    });

    expect(res).toHaveLength(1);
    expect(res[0].updates).toHaveLength(2);

    const [u1, u2] = res[0].updates;
    expect(u1.orderId).toBe(10); // lowest remaining first
    expect(u1.suggestedNewPriceTicked).toBe(98); // 2 ticks undercut
    expect(u1.reasons).toEqual(expect.arrayContaining(['undercut', 'ladder']));

    expect(u2.orderId).toBe(11);
    expect(u2.suggestedNewPriceTicked).toBe(99); // 1 tick undercut
    expect(u2.reasons).toEqual(['ladder']);
  });

  it('for global mode, does not ladder a second order when daily volume does not exceed lowest-remaining order', async () => {
    const svc = makeSvc({
      orders: [
        {
          order_id: 20,
          type_id: typeId,
          is_buy_order: false,
          price: 110,
          volume_remain: 20,
          volume_total: 100,
          location_id: stationId,
          issued: isoDaysAgo(1),
          duration: 90,
        },
        {
          order_id: 21,
          type_id: typeId,
          is_buy_order: false,
          price: 111,
          volume_remain: 100,
          volume_total: 100,
          location_id: stationId,
          issued: isoDaysAgo(1),
          duration: 90,
        },
      ],
      dailyUnitsSold: 10, // <= 20 => no ladder
      stationSells: [{ price: 100, volume: 50 }],
    });

    const res = await svc.undercutCheck({
      characterIds: [123],
      stationIds: [stationId],
      groupingMode: 'global',
      minUndercutUnits: 1,
      minUndercutVolumeRatio: 0.15,
      expiryRefreshDays: 0,
    });

    expect(res).toHaveLength(1);
    expect(res[0].updates).toHaveLength(1);
    const u = res[0].updates[0];
    expect(u.orderId).toBe(20);
    expect(u.suggestedNewPriceTicked).toBe(99); // 1 tick undercut (no ladder)
    expect(u.reasons).toEqual(['undercut']);
  });
});
