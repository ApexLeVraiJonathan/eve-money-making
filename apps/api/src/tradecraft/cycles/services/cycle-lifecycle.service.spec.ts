import { CycleLifecycleService } from './cycle-lifecycle.service';
import { CycleSettlementRunnerService } from './cycle-settlement-runner.service';

const openCycle = {
  id: 'open-cycle',
  name: 'Current Cycle',
  status: 'OPEN',
  startedAt: new Date('2026-05-01T12:00:00.000Z'),
  closedAt: null,
  initialCapitalIsk: '100.00',
  initialInjectionIsk: null,
  createdAt: new Date('2026-05-01T12:00:00.000Z'),
  updatedAt: new Date('2026-05-05T12:00:00.000Z'),
} as const;

const closedCycle = {
  ...openCycle,
  status: 'COMPLETED',
  closedAt: new Date('2026-05-05T12:00:00.000Z'),
  updatedAt: new Date('2026-05-05T12:00:00.000Z'),
} as const;

const plannedCycle = {
  id: 'planned-cycle',
  name: 'Next Cycle',
  status: 'PLANNED',
  startedAt: new Date('2026-05-10T12:00:00.000Z'),
  closedAt: null,
  initialCapitalIsk: null,
  initialInjectionIsk: '50.00',
  createdAt: new Date('2026-05-05T12:00:00.000Z'),
  updatedAt: new Date('2026-05-05T12:00:00.000Z'),
} as const;

const openedCycle = {
  ...plannedCycle,
  status: 'OPEN',
  startedAt: new Date('2026-05-05T12:00:00.000Z'),
  initialCapitalIsk: '250.00',
  updatedAt: new Date('2026-05-05T12:00:00.000Z'),
} as const;

function createService(overrides?: {
  cycles?: Record<string, unknown>;
  walletRefresh?: Record<string, unknown>;
  prisma?: Record<string, unknown>;
  payouts?: Record<string, unknown>;
  rollovers?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
}) {
  const cycles = {
    getCurrentOpenCycle: jest.fn().mockResolvedValue(openCycle),
    closeCycle: jest.fn().mockResolvedValue(closedCycle),
    closeCycleInTransaction: jest.fn().mockResolvedValue(closedCycle),
    ...overrides?.cycles,
  };
  const walletRefresh = {
    prepareStrictSettlementWalletActivity: jest.fn().mockResolvedValue({
      buysAllocated: 3,
      sellsAllocated: 4,
      unmatchedBuys: 0,
      unmatchedSells: 0,
    }),
    ...overrides?.walletRefresh,
  };
  const payouts = {
    createSettlementPayoutSnapshot: jest
      .fn()
      .mockResolvedValue([{ id: 'payout-1' }]),
    ...overrides?.payouts,
  };
  const rollovers = {
    buildRolloverLineCandidates: jest.fn().mockResolvedValue([]),
    fetchJitaPricesForRolloverLines: jest.fn().mockResolvedValue(new Map()),
    resolveRolloverLineBuyCost: jest.fn().mockReturnValue(0),
    processInventoryBuyback: jest.fn().mockResolvedValue({
      itemsBoughtBack: 2,
      totalBuybackIsk: 123.45,
    }),
    processInventoryPurchase: jest.fn().mockResolvedValue({
      itemsRolledOver: 1,
      totalRolloverCostIsk: 50,
    }),
    processInventoryPurchaseIfPresent: jest.fn().mockResolvedValue({
      itemsRolledOver: 0,
      totalRolloverCostIsk: 0,
    }),
    processParticipationRollovers: jest.fn().mockResolvedValue({
      processed: 1,
      rolledOver: 200,
      paidOut: 50,
    }),
    ...overrides?.rollovers,
  };
  const tx = {
    committedPackage: {
      updateMany: jest.fn(),
    },
    cycle: {
      update: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(openedCycle),
    },
    cycleLine: {
      createMany: jest.fn(),
    },
    cycleParticipation: {
      deleteMany: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amountIsk: '200.00' },
      }),
    },
  };
  const prisma = {
    cycle: {
      findUnique: jest.fn().mockResolvedValue(plannedCycle),
    },
    cycleLine: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(
      async (callback: (transactionClient: typeof tx) => unknown) =>
        await callback(tx),
    ),
    ...overrides?.prisma,
  };
  const notifications = {
    notifyCycleStarted: jest.fn().mockResolvedValue(undefined),
    ...overrides?.notifications,
  };

  const settlementRunner = new CycleSettlementRunnerService(
    walletRefresh as never,
    payouts as never,
    rollovers as never,
  );
  const service = new CycleLifecycleService(
    cycles as never,
    prisma as never,
    rollovers as never,
    settlementRunner,
    notifications as never,
  );

  return {
    service,
    cycles,
    walletRefresh,
    prisma,
    tx,
    payouts,
    rollovers,
  };
}

describe('CycleLifecycleService', () => {
  it('settles the Open Cycle through strict steps before recoverable follow-up', async () => {
    const { service } = createService();

    const result = await service.settleOpenCycle({ cycleId: 'open-cycle' });

    expect(result.settlementReport.settledCycleId).toBe('open-cycle');
    expect(result.settlementReport.targetCycleId).toBeNull();
    expect(result.settlementReport.steps.map((step) => step.name)).toEqual([
      'wallet_import',
      'transaction_allocation',
      'rollover_buyback',
      'close_previous_cycle',
      'payout_creation',
      'cycle_rollover',
    ]);
    expect(result.settlementReport.steps).toEqual([
      expect.objectContaining({ name: 'wallet_import', status: 'succeeded' }),
      expect.objectContaining({
        name: 'transaction_allocation',
        status: 'succeeded',
        message: 'buys=3, sells=4',
      }),
      expect.objectContaining({
        name: 'rollover_buyback',
        status: 'succeeded',
        message: '2 items, 123.45 ISK',
      }),
      expect.objectContaining({
        name: 'close_previous_cycle',
        status: 'succeeded',
      }),
      expect.objectContaining({
        name: 'payout_creation',
        status: 'succeeded',
        message: 'created=1',
      }),
      expect.objectContaining({
        name: 'cycle_rollover',
        status: 'skipped',
        message:
          'No target Cycle; Rollover Intent becomes payout/admin follow-up',
      }),
    ]);
    expect(result.settlementReport.recoverableFailures).toEqual([]);
    expect(result).toEqual({
      cycle: {
        id: 'open-cycle',
        name: 'Current Cycle',
        status: 'COMPLETED',
        startedAt: '2026-05-01T12:00:00.000Z',
        closedAt: '2026-05-05T12:00:00.000Z',
        initialCapitalIsk: '100.00',
        initialInjectionIsk: null,
        createdAt: '2026-05-01T12:00:00.000Z',
        updatedAt: '2026-05-05T12:00:00.000Z',
      },
      settlementReport: result.settlementReport,
    });
  });

  it('opens a planned Cycle through the Cycle Lifecycle Entry Point', async () => {
    const { service } = createService();

    const result = await service.openPlannedCycle({ cycleId: 'planned-cycle' });

    expect(result.cycle).toEqual({
      id: 'planned-cycle',
      name: 'Next Cycle',
      status: 'OPEN',
      startedAt: '2026-05-05T12:00:00.000Z',
      closedAt: null,
      initialCapitalIsk: '250.00',
      initialInjectionIsk: '50.00',
      createdAt: '2026-05-05T12:00:00.000Z',
      updatedAt: '2026-05-05T12:00:00.000Z',
    });
    expect(result.settlementReport.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'close_previous_cycle',
          status: 'succeeded',
        }),
        expect.objectContaining({
          name: 'cycle_rollover',
          status: 'succeeded',
          message: 'processed=1, rolledOver=200, paidOut=50',
        }),
      ]),
    );
  });

  it('opens a planned Cycle without settlement steps when there is no previous Open Cycle', async () => {
    const { service, walletRefresh, payouts, rollovers } = createService({
      cycles: {
        getCurrentOpenCycle: jest.fn().mockResolvedValue(null),
      },
    });

    const result = await service.openPlannedCycle({ cycleId: 'planned-cycle' });

    expect(result.cycle.status).toBe('OPEN');
    expect(result.settlementReport).toEqual({
      settledCycleId: null,
      targetCycleId: 'planned-cycle',
      steps: [],
      recoverableFailures: [],
    });
    expect(
      walletRefresh.prepareStrictSettlementWalletActivity,
    ).not.toHaveBeenCalled();
    expect(rollovers.processInventoryBuyback).not.toHaveBeenCalled();
    expect(payouts.createSettlementPayoutSnapshot).not.toHaveBeenCalled();
    expect(rollovers.processParticipationRollovers).not.toHaveBeenCalled();
  });

  it('records recoverable rollover failures without blocking the target Cycle opening', async () => {
    const { service } = createService({
      rollovers: {
        processParticipationRollovers: jest
          .fn()
          .mockRejectedValue(new Error('rollover failed')),
      },
    });

    const result = await service.openPlannedCycle({ cycleId: 'planned-cycle' });

    expect(result.cycle.status).toBe('OPEN');
    expect(result.settlementReport.recoverableFailures).toEqual([
      expect.objectContaining({
        name: 'cycle_rollover',
        kind: 'recoverable',
        status: 'failed',
        message: 'rollover failed',
      }),
    ]);
    expect(result.settlementReport.steps).toContainEqual(
      expect.objectContaining({
        name: 'payout_creation',
        status: 'succeeded',
        message: 'created=1',
      }),
    );
  });

  it('records inventory purchase when rollover lines exist after opening', async () => {
    const { service, rollovers } = createService({
      prisma: {
        cycleLine: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(1),
        },
      },
    });

    await service.openPlannedCycle({ cycleId: 'planned-cycle' });

    expect(rollovers.processInventoryPurchaseIfPresent).toHaveBeenCalledWith(
      'planned-cycle',
      'open-cycle',
    );
  });

  it('records recoverable payout failures without blocking the No Open Cycle Period', async () => {
    const { service } = createService({
      payouts: {
        createSettlementPayoutSnapshot: jest
          .fn()
          .mockRejectedValue(new Error('payout failed')),
      },
    });

    const result = await service.settleOpenCycle({ cycleId: 'open-cycle' });

    expect(result.cycle.status).toBe('COMPLETED');
    expect(result.settlementReport.recoverableFailures).toEqual([
      expect.objectContaining({
        name: 'payout_creation',
        kind: 'recoverable',
        status: 'failed',
        message: 'payout failed',
      }),
    ]);
    expect(result.settlementReport.steps).toContainEqual(
      expect.objectContaining({
        name: 'cycle_rollover',
        status: 'skipped',
      }),
    );
  });

  it('stops before closing when a Strict Settlement Step fails', async () => {
    const { service, cycles, walletRefresh, rollovers } = createService({
      walletRefresh: {
        prepareStrictSettlementWalletActivity: jest
          .fn()
          .mockRejectedValue(new Error('wallet failed')),
      },
    });

    await expect(
      service.settleOpenCycle({ cycleId: 'open-cycle' }),
    ).rejects.toThrow('wallet failed');

    expect(
      walletRefresh.prepareStrictSettlementWalletActivity,
    ).toHaveBeenCalledTimes(1);
    expect(rollovers.processInventoryBuyback).not.toHaveBeenCalled();
    expect(cycles.closeCycle).not.toHaveBeenCalled();
  });

  it('stops before opening a planned Cycle when a Strict Settlement Step fails', async () => {
    const { service, cycles, walletRefresh, prisma } = createService({
      walletRefresh: {
        prepareStrictSettlementWalletActivity: jest
          .fn()
          .mockRejectedValue(new Error('wallet failed')),
      },
    });

    await expect(
      service.openPlannedCycle({ cycleId: 'planned-cycle' }),
    ).rejects.toThrow('wallet failed');

    expect(
      walletRefresh.prepareStrictSettlementWalletActivity,
    ).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(cycles.closeCycleInTransaction).not.toHaveBeenCalled();
  });
});
