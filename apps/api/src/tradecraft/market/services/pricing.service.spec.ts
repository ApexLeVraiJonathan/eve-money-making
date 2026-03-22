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
    cycleLines?: Array<{
      id: string;
      destinationStationId: number;
      typeId: number;
      unitsBought: number;
      buyCostIsk: string;
    }>;
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
      getCycleLinesForCycle: async () => opts?.cycleLines ?? [],
    };

    const cycleService = {
      getOpenCycleIdForDate: async () => 'cycle',
      getCurrentOpenCycle: async () => ({ id: 'cycle' }),
    };
    const notifications = {
      sendSystemAlertDm: async () => undefined,
    };

    // Not used by undercutCheck in these tests
    const prisma = {
      scriptConfirmBatch: {
        findUnique: async () => null,
        create: async () => undefined,
      },
      $transaction: async (_fn: any) => [],
    };
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
      notifications as any,
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

  it('script undercut check includes deterministic uiTarget ranking metadata', async () => {
    const svc = makeSvc({
      orders: [
        {
          order_id: 30,
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
          order_id: 31,
          type_id: typeId,
          is_buy_order: false,
          price: 111,
          volume_remain: 20,
          volume_total: 100,
          location_id: stationId,
          issued: isoDaysAgo(1),
          duration: 90,
        },
      ],
      stationSells: [{ price: 100, volume: 50 }],
    });

    const res = await svc.undercutCheckScript({
      characterIds: [123],
      stationIds: [stationId],
      groupingMode: 'perOrder',
      filterMaxChars: 37,
      normalizeFilterText: true,
      filterForceLowercase: true,
      filterStripQuotes: false,
    });

    expect(res).toHaveLength(1);
    expect(res[0].updates).toHaveLength(2);
    const first = res[0].updates.find((u) => u.orderId === 30);
    const second = res[0].updates.find((u) => u.orderId === 31);
    expect(first?.uiTarget?.rowRank).toBe(1);
    expect(second?.uiTarget?.rowRank).toBe(2);
    expect(first?.uiTarget?.matchingOwnOrders).toHaveLength(2);
    expect(first?.lineId).toBeUndefined();
  });

  it('script undercut check includes lineId when cycle line mapping is available', async () => {
    const svc = makeSvc({
      orders: [
        {
          order_id: 30,
          type_id: typeId,
          is_buy_order: false,
          price: 110,
          volume_remain: 5,
          volume_total: 100,
          location_id: stationId,
          issued: isoDaysAgo(1),
          duration: 90,
        },
      ],
      stationSells: [{ price: 100, volume: 50 }],
      cycleLines: [
        {
          id: 'line-1',
          destinationStationId: stationId,
          typeId,
          unitsBought: 10,
          buyCostIsk: '100.00',
        },
      ],
    });

    const res = await svc.undercutCheckScript({
      characterIds: [123],
      stationIds: [stationId],
      cycleId: '123e4567-e89b-12d3-a456-426614174000',
      groupingMode: 'perOrder',
    });

    expect(res).toHaveLength(1);
    expect(res[0].updates).toHaveLength(1);
    expect(res[0].updates[0].lineId).toBe('line-1');
  });
});

describe('PricingService.confirmBatchScript', () => {
  it('returns cached response on idempotent retry', async () => {
    let stored:
      | { payloadHash: string; responseJson: any; idempotencyKey: string }
      | undefined;
    const updatesApplied: string[] = [];

    const prisma = {
      scriptConfirmBatch: {
        findUnique: async ({ where }: any) => {
          if (!stored || stored.idempotencyKey !== where.idempotencyKey)
            return null;
          return {
            payloadHash: stored.payloadHash,
            responseJson: stored.responseJson,
          };
        },
        create: async ({ data }: any) => {
          stored = {
            idempotencyKey: data.idempotencyKey,
            payloadHash: data.payloadHash,
            responseJson: data.responseJson,
          };
          return stored;
        },
      },
      $transaction: async (fn: any) =>
        await fn({
          cycleLine: {
            update: async ({ where }: any) => {
              updatesApplied.push(where.id);
              return {};
            },
          },
        }),
    };

    const svc = new PricingService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { sendSystemAlertDm: async () => undefined } as any,
    );

    const body = {
      idempotencyKey: 'idem-1',
      updates: [
        {
          lineId: 'line-a',
          mode: 'reprice' as const,
          quantity: 12,
          newUnitPrice: 12345,
        },
      ],
    };

    const first = await svc.confirmBatchScript(body);
    const second = await svc.confirmBatchScript(body);

    expect(first.cached).toBeUndefined();
    expect(second.cached).toBe(true);
    expect(updatesApplied).toEqual(['line-a']);
  });
});
