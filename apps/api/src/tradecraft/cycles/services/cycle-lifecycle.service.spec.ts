import { CycleLifecycleService } from './cycle-lifecycle.service';
import type { CycleSettlementReport } from '@eve/shared/tradecraft-cycles';

describe('CycleLifecycleService', () => {
  it('opens a planned cycle through the lifecycle entry point with settlement adapters', async () => {
    const settlementReport: CycleSettlementReport = {
      settledCycleId: 'previous-cycle',
      targetCycleId: 'planned-cycle',
      steps: [],
      recoverableFailures: [],
    };
    const cycleService = {
      openPlannedCycle: jest.fn().mockResolvedValue({
        cycle: {
          id: 'planned-cycle',
          name: 'Next Cycle',
          status: 'OPEN',
          startedAt: new Date('2026-05-05T12:00:00.000Z'),
          closedAt: null,
          initialCapitalIsk: '100.00',
          initialInjectionIsk: null,
          createdAt: new Date('2026-05-04T12:00:00.000Z'),
          updatedAt: new Date('2026-05-05T12:00:00.000Z'),
        },
        settlementReport,
      }),
    };
    const wallet = { importAllLinked: jest.fn() };
    const allocation = { allocateAll: jest.fn() };
    const service = new CycleLifecycleService(
      cycleService as never,
      wallet as never,
      allocation as never,
    );

    const result = await service.openPlannedCycle({
      cycleId: 'planned-cycle',
      startedAt: new Date('2026-05-05T12:00:00.000Z'),
    });

    expect(cycleService.openPlannedCycle).toHaveBeenCalledWith(
      {
        cycleId: 'planned-cycle',
        startedAt: new Date('2026-05-05T12:00:00.000Z'),
      },
      { walletService: wallet, allocationService: allocation },
    );
    expect(result).toEqual({
      cycle: {
        id: 'planned-cycle',
        name: 'Next Cycle',
        status: 'OPEN',
        startedAt: '2026-05-05T12:00:00.000Z',
        closedAt: null,
        initialCapitalIsk: '100.00',
        initialInjectionIsk: null,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-05T12:00:00.000Z',
      },
      settlementReport,
    });
  });

  it('settles the open cycle through the lifecycle entry point with settlement adapters', async () => {
    const settlementReport: CycleSettlementReport = {
      settledCycleId: 'open-cycle',
      targetCycleId: null,
      steps: [
        {
          name: 'cycle_rollover',
          kind: 'recoverable',
          status: 'skipped',
          message:
            'No target Cycle; Rollover Intent becomes payout/admin follow-up',
        },
      ],
      recoverableFailures: [],
    };
    const cycleService = {
      settleOpenCycle: jest.fn().mockResolvedValue({
        cycle: {
          id: 'open-cycle',
          name: 'Current Cycle',
          status: 'COMPLETED',
          startedAt: new Date('2026-05-01T12:00:00.000Z'),
          closedAt: new Date('2026-05-05T12:00:00.000Z'),
          initialCapitalIsk: '100.00',
          initialInjectionIsk: null,
          createdAt: new Date('2026-05-01T12:00:00.000Z'),
          updatedAt: new Date('2026-05-05T12:00:00.000Z'),
        },
        settlementReport,
      }),
    };
    const wallet = { importAllLinked: jest.fn() };
    const allocation = { allocateAll: jest.fn() };
    const service = new CycleLifecycleService(
      cycleService as never,
      wallet as never,
      allocation as never,
    );

    const result = await service.settleOpenCycle({ cycleId: 'open-cycle' });

    expect(cycleService.settleOpenCycle).toHaveBeenCalledWith(
      { cycleId: 'open-cycle' },
      { walletService: wallet, allocationService: allocation },
    );
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
      settlementReport,
    });
  });
});
