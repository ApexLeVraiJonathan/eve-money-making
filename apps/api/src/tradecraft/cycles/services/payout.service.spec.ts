import { PayoutService } from './payout.service';

function createService(overrides?: {
  prisma?: Record<string, unknown>;
  profitService?: Record<string, unknown>;
  jingleYield?: Record<string, unknown>;
}) {
  const prisma = {
    cycleParticipation: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    ...overrides?.prisma,
  };
  const profitService = {
    computeCycleProfit: jest.fn().mockResolvedValue({
      cycleProfitCash: '0.00',
    }),
    ...overrides?.profitService,
  };
  const notifications = {
    notifyCycleResults: jest.fn().mockResolvedValue(undefined),
  };
  const jingleYield = {
    applyCyclePayouts: jest.fn().mockResolvedValue(undefined),
    ...overrides?.jingleYield,
  };

  const service = new PayoutService(
    prisma as never,
    profitService as never,
    notifications as never,
    jingleYield as never,
  );

  return { service, prisma, profitService, notifications, jingleYield };
}

describe('PayoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes payouts, applies JingleYield accumulation, and returns payout records', async () => {
    const { service, prisma, profitService, jingleYield } = createService({
      prisma: {
        cycleParticipation: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'participation-1',
              userId: 'user-1',
              characterName: 'Alpha Trader',
              amountIsk: '100.00',
            },
            {
              id: 'participation-2',
              userId: 'user-2',
              characterName: 'Beta Trader',
              amountIsk: '300.00',
            },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
      },
      profitService: {
        computeCycleProfit: jest.fn().mockResolvedValue({
          cycleProfitCash: '80.00',
        }),
      },
    });

    await expect(service.createPayouts('cycle-1', 0.5)).resolves.toEqual([
      { participationId: 'participation-1', payoutIsk: '110.00' },
      { participationId: 'participation-2', payoutIsk: '330.00' },
    ]);

    expect(prisma.cycleParticipation.findMany).toHaveBeenCalledWith({
      where: {
        cycleId: 'cycle-1',
        status: 'OPTED_IN',
        validatedAt: { not: null },
      },
    });
    expect(profitService.computeCycleProfit).toHaveBeenCalledWith('cycle-1');
    expect(jingleYield.applyCyclePayouts).toHaveBeenCalledWith('cycle-1', [
      {
        participationId: 'participation-1',
        userId: 'user-1',
        characterName: 'Alpha Trader',
        investmentIsk: '100.00',
        profitShareIsk: '10.00',
        totalPayoutIsk: '110.00',
      },
      {
        participationId: 'participation-2',
        userId: 'user-2',
        characterName: 'Beta Trader',
        investmentIsk: '300.00',
        profitShareIsk: '30.00',
        totalPayoutIsk: '330.00',
      },
    ]);
    expect(prisma.cycleParticipation.update).toHaveBeenCalledTimes(2);
    expect(prisma.cycleParticipation.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'participation-1' },
      data: {
        payoutAmountIsk: '110.00',
        status: 'AWAITING_PAYOUT',
      },
    });
    expect(prisma.cycleParticipation.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'participation-2' },
      data: {
        payoutAmountIsk: '330.00',
        status: 'AWAITING_PAYOUT',
      },
    });
  });
});
