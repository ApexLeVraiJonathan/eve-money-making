import { fetchStationOrders } from '@api/esi/market-helpers';
import { CycleRolloverService } from './cycle-rollover.service';

jest.mock('@api/esi/market-helpers', () => ({
  fetchStationOrders: jest.fn(),
}));

const mockedFetchStationOrders = jest.mocked(fetchStationOrders);

function createService(overrides?: {
  prisma?: Record<string, unknown>;
  esiChars?: Record<string, unknown>;
  characterService?: Record<string, unknown>;
  participations?: Record<string, unknown>;
}) {
  const prisma = {
    autoRolloverSettings: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    cycle: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    cycleLine: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    cycleParticipation: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    sellAllocation: {
      create: jest.fn(),
    },
    buyAllocation: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    ...overrides?.prisma,
  };
  const esiChars = {
    getOrders: jest.fn().mockResolvedValue([]),
    ...overrides?.esiChars,
  };
  const characterService = {
    getTrackedSellerIds: jest.fn().mockResolvedValue([]),
    ...overrides?.characterService,
  };
  const participations = {
    createParticipation: jest.fn(),
    ...overrides?.participations,
  };
  const participationCaps = {
    defaults: jest.fn().mockReturnValue({
      principalCapIsk: 10_000_000_000,
      maximumCapIsk: 20_000_000_000,
    }),
    getUserTradecraftCaps: jest.fn().mockResolvedValue({
      principalCapIsk: 10_000_000_000,
      maximumCapIsk: 20_000_000_000,
    }),
  };

  const service = new CycleRolloverService(
    prisma as never,
    esiChars as never,
    {} as never,
    characterService as never,
    participations as never,
    participationCaps as never,
  );

  return {
    service,
    prisma,
    esiChars,
    characterService,
    participations,
    participationCaps,
  };
}

describe('CycleRolloverService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds rollover line candidates from remaining previous Cycle inventory', async () => {
    const { service, prisma } = createService({
      prisma: {
        cycleLine: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'line-1',
              typeId: 34,
              destinationStationId: 60003760,
              unitsBought: 10,
              unitsSold: 4,
              buyCostIsk: '120.00',
              currentSellPriceIsk: '15.50',
            },
            {
              id: 'line-2',
              typeId: 35,
              destinationStationId: 60003760,
              unitsBought: 3,
              unitsSold: 3,
              buyCostIsk: '30.00',
              currentSellPriceIsk: null,
            },
          ]),
        },
      },
    });

    await expect(
      service.buildRolloverLineCandidates('cycle-1'),
    ).resolves.toEqual([
      {
        typeId: 34,
        destinationStationId: 60003760,
        plannedUnits: 6,
        currentSellPriceIsk: 15.5,
        rolloverFromLineId: 'line-1',
        buyCostIsk: 12,
      },
    ]);
    expect(prisma.cycleLine.findMany).toHaveBeenCalledWith({
      where: { cycleId: 'cycle-1' },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        unitsBought: true,
        unitsSold: true,
        buyCostIsk: true,
        currentSellPriceIsk: true,
      },
    });
  });

  it('builds initial rollover line candidates from tracked ESI sell orders', async () => {
    const { service, characterService, esiChars } = createService({
      characterService: {
        getTrackedSellerIds: jest.fn().mockResolvedValue(['char-1', 'char-2']),
      },
      esiChars: {
        getOrders: jest.fn().mockImplementation((characterId: string) => {
          if (characterId === 'char-2') {
            return Promise.resolve([
              {
                is_buy_order: false,
                location_id: 60003760,
                type_id: 34,
                volume_remain: 4,
                price: 9,
              },
            ]);
          }
          return Promise.resolve([
            {
              is_buy_order: false,
              location_id: 60003760,
              type_id: 34,
              volume_remain: 6,
              price: 10,
            },
            {
              is_buy_order: true,
              location_id: 60003760,
              type_id: 35,
              volume_remain: 99,
              price: 1,
            },
          ]);
        }),
      },
    });

    await expect(service.buildRolloverLineCandidates(null)).resolves.toEqual([
      {
        typeId: 34,
        destinationStationId: 60003760,
        plannedUnits: 10,
        currentSellPriceIsk: 9,
        rolloverFromLineId: null,
        buyCostIsk: 0,
      },
    ]);
    expect(characterService.getTrackedSellerIds).toHaveBeenCalledTimes(1);
    expect(esiChars.getOrders).toHaveBeenCalledTimes(2);
  });

  it('resolves rollover line buy cost from prior cost basis, Jita fallback, or zero', () => {
    const { service } = createService();
    const jitaPrices = new Map([[35, 7]]);

    expect(
      service.resolveRolloverLineBuyCost(
        {
          typeId: 34,
          destinationStationId: 60003760,
          plannedUnits: 6,
          currentSellPriceIsk: null,
          rolloverFromLineId: 'line-1',
          buyCostIsk: 12,
        },
        jitaPrices,
      ),
    ).toBe(72);
    expect(
      service.resolveRolloverLineBuyCost(
        {
          typeId: 35,
          destinationStationId: 60003760,
          plannedUnits: 3,
          currentSellPriceIsk: null,
          rolloverFromLineId: null,
          buyCostIsk: 0,
        },
        jitaPrices,
      ),
    ).toBe(21);
    expect(
      service.resolveRolloverLineBuyCost(
        {
          typeId: 36,
          destinationStationId: 60003760,
          plannedUnits: 3,
          currentSellPriceIsk: null,
          rolloverFromLineId: null,
          buyCostIsk: 0,
        },
        jitaPrices,
      ),
    ).toBe(0);
  });

  it('fetches unique Jita fallback prices only for candidates without buy cost', async () => {
    const { service } = createService();
    mockedFetchStationOrders.mockImplementation((_esi, input) =>
      Promise.resolve([{ price: input.typeId === 35 ? 8 : 11 }]),
    );

    const prices = await service.fetchJitaPricesForRolloverLines([
      {
        typeId: 34,
        destinationStationId: 60003760,
        plannedUnits: 1,
        currentSellPriceIsk: null,
        rolloverFromLineId: 'line-1',
        buyCostIsk: 12,
      },
      {
        typeId: 35,
        destinationStationId: 60003760,
        plannedUnits: 2,
        currentSellPriceIsk: null,
        rolloverFromLineId: null,
        buyCostIsk: 0,
      },
      {
        typeId: 35,
        destinationStationId: 60003760,
        plannedUnits: 3,
        currentSellPriceIsk: null,
        rolloverFromLineId: null,
        buyCostIsk: 0,
      },
    ]);

    expect(prices).toEqual(new Map([[35, 8]]));
    expect(mockedFetchStationOrders).toHaveBeenCalledTimes(1);
    expect(mockedFetchStationOrders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        regionId: 10000002,
        stationId: 60003760,
        typeId: 35,
        side: 'sell',
      }),
    );
  });

  it('processes inventory buyback as synthetic sell allocations', async () => {
    const { service, prisma } = createService({
      prisma: {
        cycleLine: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'line-1',
              typeId: 34,
              destinationStationId: 60003760,
              unitsBought: 10,
              unitsSold: 4,
              buyCostIsk: '120.00',
            },
            {
              id: 'line-2',
              typeId: 35,
              destinationStationId: 60003760,
              unitsBought: 5,
              unitsSold: 1,
              buyCostIsk: '0.00',
            },
          ]),
          update: jest.fn(),
        },
        sellAllocation: {
          create: jest.fn(),
        },
        buyAllocation: {
          create: jest.fn(),
        },
      },
    });

    await expect(service.processInventoryBuyback('cycle-1')).resolves.toEqual({
      itemsBoughtBack: 1,
      totalBuybackIsk: 72,
    });
    expect(prisma.sellAllocation.create).toHaveBeenCalledWith({
      data: {
        lineId: 'line-1',
        walletCharacterId: null,
        walletTransactionId: null,
        isRollover: true,
        quantity: 6,
        unitPrice: 12,
        revenueIsk: 72,
        taxIsk: 0,
      },
    });
    expect(prisma.cycleLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: {
        unitsSold: { increment: 6 },
        salesGrossIsk: { increment: 72 },
        salesNetIsk: { increment: 72 },
      },
    });
    expect(prisma.sellAllocation.create).toHaveBeenCalledTimes(1);
  });

  it('processes inventory purchase as synthetic buy allocations', async () => {
    const { service, prisma } = createService({
      prisma: {
        cycleLine: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'new-line-1',
              typeId: 34,
              destinationStationId: 60003760,
              unitsBought: 6,
              rolloverFromLineId: 'old-line-1',
            },
          ]),
          findUnique: jest.fn().mockResolvedValue({
            buyCostIsk: '72.00',
            unitsBought: 6,
          }),
          update: jest.fn(),
        },
        sellAllocation: {
          create: jest.fn(),
        },
        buyAllocation: {
          create: jest.fn(),
        },
      },
    });

    await expect(
      service.processInventoryPurchase('new-cycle', 'old-cycle'),
    ).resolves.toEqual({
      itemsRolledOver: 1,
      totalRolloverCostIsk: 72,
    });
    expect(prisma.cycleLine.findMany).toHaveBeenCalledWith({
      where: {
        cycleId: 'new-cycle',
        isRollover: true,
        rolloverFromCycleId: 'old-cycle',
      },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        unitsBought: true,
        rolloverFromLineId: true,
      },
    });
    expect(prisma.buyAllocation.create).toHaveBeenCalledWith({
      data: {
        lineId: 'new-line-1',
        walletCharacterId: null,
        walletTransactionId: null,
        isRollover: true,
        quantity: 6,
        unitPrice: 12,
      },
    });
    expect(prisma.cycleLine.update).toHaveBeenCalledWith({
      where: { id: 'new-line-1' },
      data: { buyCostIsk: 72 },
    });
  });

  it('seeds planned Cycle rollovers from auto-rollover settings and active JingleYield participations', async () => {
    const createParticipation = jest.fn().mockResolvedValue({ id: 'auto-1' });
    const cycleParticipationCreate = jest.fn();
    const { service, prisma, participations } = createService({
      participations: {
        createParticipation,
      },
      prisma: {
        autoRolloverSettings: {
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 'auto-user',
              defaultRolloverType: 'FULL_PAYOUT',
            },
          ]),
        },
        cycle: {
          findFirst: jest.fn().mockResolvedValue({ id: 'open-cycle' }),
        },
        cycleParticipation: {
          create: cycleParticipationCreate,
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'jy-source',
              userId: 'jy-user',
              characterName: 'Jingle Pilot',
              amountIsk: '200.00',
              userPrincipalIsk: '0.00',
            },
          ]),
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      },
    });

    await expect(
      service.seedPlannedCycleRollovers('planned-cycle'),
    ).resolves.toEqual({
      autoRollover: {
        created: 1,
        skippedExisting: 0,
        skippedIneligible: 0,
        skippedUnsupported: 0,
      },
      jingleYield: { created: 1, skippedExisting: 0 },
    });
    expect(participations.createParticipation).toHaveBeenCalledWith({
      cycleId: 'planned-cycle',
      userId: 'auto-user',
      amountIsk: '1.00',
      rollover: { type: 'FULL_PAYOUT' },
    });
    expect(prisma.cycleParticipation.findMany).toHaveBeenCalledWith({
      where: {
        cycleId: 'open-cycle',
        userId: { not: null },
        jingleYieldProgramId: { not: null },
        jingleYieldProgram: {
          status: 'ACTIVE',
        },
        status: { in: ['OPTED_IN', 'AWAITING_PAYOUT'] },
      },
      select: {
        id: true,
        userId: true,
        characterName: true,
        amountIsk: true,
        userPrincipalIsk: true,
      },
    });
    expect(cycleParticipationCreate).toHaveBeenCalledWith({
      data: {
        cycleId: 'planned-cycle',
        userId: 'jy-user',
        characterName: 'Jingle Pilot',
        amountIsk: '200.00',
        userPrincipalIsk: '0.00',
        memo: 'ROLLOVER-planned--jy-sourc-INITIAL',
        status: 'AWAITING_INVESTMENT',
        rolloverType: 'INITIAL_ONLY',
        rolloverRequestedAmountIsk: '200.00',
        rolloverFromParticipationId: 'jy-source',
      },
    });
    expect(createParticipation).toHaveBeenCalledTimes(1);
  });

  it('processes participation Rollover Intent from a closed Cycle into the target Cycle', async () => {
    const cycleParticipationUpdate = jest.fn();
    const { service, prisma } = createService({
      prisma: {
        autoRolloverSettings: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        cycle: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'target-cycle',
            status: 'OPEN',
          }),
        },
        cycleParticipation: {
          create: jest.fn(),
          findMany: jest
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
              {
                id: 'rollover-participation',
                userId: 'user-1',
                characterName: 'Pilot',
                amountIsk: '100.00',
                userPrincipalIsk: '100.00',
                rolloverType: 'INITIAL_ONLY',
                rolloverRequestedAmountIsk: '100.00',
                rolloverFromParticipationId: 'source-participation',
                jingleYieldProgram: null,
                rolloverFromParticipation: {
                  id: 'source-participation',
                  cycleId: 'closed-cycle',
                  amountIsk: '100.00',
                  userPrincipalIsk: '100.00',
                  rolloverDeductedIsk: null,
                  jingleYieldProgram: null,
                },
              },
            ]),
          findFirst: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({
            payoutAmountIsk: '125.00',
            amountIsk: '100.00',
            status: 'AWAITING_PAYOUT',
            payoutPaidAt: null,
          }),
          update: cycleParticipationUpdate,
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({
            tradecraftMaximumCapIsk: null,
          }),
        },
      },
    });

    await expect(
      service.processParticipationRollovers('closed-cycle', 'target-cycle'),
    ).resolves.toEqual({
      processed: 1,
      rolledOver: '100.00',
      paidOut: '25.00',
    });
    expect(prisma.cycleParticipation.findMany).toHaveBeenLastCalledWith({
      where: {
        cycleId: 'target-cycle',
        rolloverType: { not: null },
        rolloverFromParticipationId: { not: null },
      },
      include: {
        rolloverFromParticipation: {
          include: {
            jingleYieldProgram: true,
          },
        },
        jingleYieldProgram: true,
      },
    });
    expect(cycleParticipationUpdate).toHaveBeenCalledWith({
      where: { id: 'rollover-participation' },
      data: expect.objectContaining({
        amountIsk: '100.00',
        status: 'OPTED_IN',
      }),
    });
    expect(cycleParticipationUpdate).toHaveBeenCalledWith({
      where: { id: 'source-participation' },
      data: expect.objectContaining({
        payoutAmountIsk: '25.00',
        rolloverDeductedIsk: '100.00',
        status: 'AWAITING_PAYOUT',
      }),
    });
  });

  it('requires the Cycle Settlement payout snapshot before processing Rollover Intent', async () => {
    const { service } = createService({
      prisma: {
        autoRolloverSettings: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        cycle: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'target-cycle',
            status: 'OPEN',
          }),
        },
        cycleParticipation: {
          create: jest.fn(),
          findMany: jest
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
              {
                id: 'rollover-participation',
                userId: 'user-1',
                characterName: 'Pilot',
                amountIsk: '100.00',
                userPrincipalIsk: '100.00',
                rolloverType: 'INITIAL_ONLY',
                rolloverRequestedAmountIsk: '100.00',
                rolloverFromParticipationId: 'source-participation',
                jingleYieldProgram: null,
                rolloverFromParticipation: {
                  id: 'source-participation',
                  cycleId: 'closed-cycle',
                  amountIsk: '100.00',
                  userPrincipalIsk: '100.00',
                  rolloverDeductedIsk: null,
                  jingleYieldProgram: null,
                },
              },
            ]),
          findFirst: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({
            payoutAmountIsk: null,
            amountIsk: '100.00',
            status: 'OPTED_IN',
            payoutPaidAt: null,
          }),
          update: jest.fn(),
        },
      },
    });

    await expect(
      service.processParticipationRollovers('closed-cycle', 'target-cycle'),
    ).rejects.toThrow(
      'Missing authoritative payout snapshot for participation source-participation',
    );
  });
});
