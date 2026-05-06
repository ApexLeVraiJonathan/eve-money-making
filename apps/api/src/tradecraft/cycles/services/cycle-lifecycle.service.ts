import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { CycleService } from './cycle.service';
import { PayoutService } from './payout.service';
import { CycleRolloverService } from './cycle-rollover.service';
import { WalletService } from '@api/tradecraft/wallet/services/wallet.service';
import { AllocationService } from '@api/tradecraft/wallet/services/allocation.service';
import { NotificationService } from '@api/notifications/notification.service';
import { Prisma } from '@eve/prisma';
import type {
  Cycle,
  CycleLifecycleResponse,
  CycleSettlementReport,
  CycleSettlementStepKind,
  CycleSettlementStepName,
  CycleSettlementStepReport,
} from '@eve/shared/tradecraft-cycles' assert { 'resolution-mode': 'import' };

type AllocationResult = {
  buysAllocated: number;
  sellsAllocated: number;
  unmatchedBuys: number;
  unmatchedSells: number;
};

type CycleRecord = {
  id: string;
  name: string | null;
  status: Cycle['status'];
  startedAt: Date;
  closedAt: Date | null;
  initialCapitalIsk: unknown;
  initialInjectionIsk: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type CycleSettlementRecorder = (
  name: CycleSettlementStepName,
  kind: CycleSettlementStepKind,
  status: CycleSettlementStepReport['status'],
  startedAt: number,
  message?: string,
) => void;

@Injectable()
export class CycleLifecycleService {
  private readonly logger = new Logger(CycleLifecycleService.name);

  constructor(
    private readonly cycles: CycleService,
    private readonly wallet: WalletService,
    private readonly allocation: AllocationService,
    private readonly prisma: PrismaService,
    private readonly payouts: PayoutService,
    private readonly rollovers: CycleRolloverService,
    private readonly notifications: NotificationService,
  ) {}

  async openPlannedCycle(input: {
    cycleId: string;
    startedAt?: Date;
  }): Promise<CycleLifecycleResponse> {
    const now = new Date();
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: input.cycleId },
    });
    if (!cycle) throw new Error('Cycle not found');

    const previousCycleToClose = await this.cycles.getCurrentOpenCycle();
    const previousCycleToSettle =
      previousCycleToClose && previousCycleToClose.id !== cycle.id
        ? previousCycleToClose
        : null;
    const shouldSettlePreviousCycle = previousCycleToSettle != null;
    const { recordSettlementStep, buildSettlementReport } =
      this.createSettlementReportBuilder({
        settledCycleId: previousCycleToSettle?.id ?? null,
        targetCycleId: cycle.id,
      });

    const rolloverLinesTemp = await this.rollovers.buildRolloverLineCandidates(
      previousCycleToSettle?.id ?? null,
    );
    const jitaPriceMap =
      await this.rollovers.fetchJitaPricesForRolloverLines(rolloverLinesTemp);

    // Strict Settlement Steps run before the open transition; failures here must
    // stop us from closing the previous Cycle or opening the target Cycle.
    if (shouldSettlePreviousCycle) {
      this.logger.log(
        `Auto-closing previous cycle ${previousCycleToSettle.id}`,
      );
      await this.runStrictSettlementSteps({
        settledCycleId: previousCycleToSettle.id,
        recordSettlementStep,
      });
    }

    const transitionStartedAt = Date.now();
    const openedCycle = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.cycleParticipation.deleteMany({
          where: {
            cycleId: input.cycleId,
            status: { in: ['AWAITING_INVESTMENT', 'REFUNDED'] },
            rolloverType: null,
            jingleYieldProgramId: null,
            rootForJingleYieldProgram: null,
          },
        });

        const open = await this.cycles.getCurrentOpenCycle();
        if (open && open.id !== cycle.id) {
          this.logger.log(`Closing cycle ${open.id} (already processed above)`);
          await this.cycles.closeCycleInTransaction(tx, open.id, now);
        }

        const startedAt =
          input.startedAt ?? (cycle.startedAt > now ? now : cycle.startedAt);
        if (startedAt.getTime() !== cycle.startedAt.getTime()) {
          await tx.cycle.update({
            where: { id: cycle.id },
            data: { startedAt },
          });
        }

        const validatedParticipations = await tx.cycleParticipation.aggregate({
          where: {
            cycleId: cycle.id,
            status: 'OPTED_IN',
            validatedAt: { not: null },
          },
          _sum: { amountIsk: true },
        });
        const participationTotal = validatedParticipations._sum.amountIsk
          ? Number(validatedParticipations._sum.amountIsk)
          : 0;
        const inj = cycle.initialInjectionIsk
          ? Number(cycle.initialInjectionIsk)
          : 0;
        const initialCapital = participationTotal + inj;
        await tx.cycle.update({
          where: { id: cycle.id },
          data: {
            status: 'OPEN',
            initialCapitalIsk: initialCapital.toFixed(2),
          },
        });

        if (rolloverLinesTemp.length) {
          await tx.cycleLine.createMany({
            data: rolloverLinesTemp.map((line) => ({
              cycleId: cycle.id,
              typeId: line.typeId,
              destinationStationId: line.destinationStationId,
              plannedUnits: line.plannedUnits,
              unitsBought: line.plannedUnits,
              listedUnits: line.plannedUnits,
              buyCostIsk: this.rollovers
                .resolveRolloverLineBuyCost(line, jitaPriceMap)
                .toFixed(2),
              currentSellPriceIsk: line.currentSellPriceIsk
                ? line.currentSellPriceIsk.toFixed(2)
                : null,
              isRollover: true,
              rolloverFromCycleId: previousCycleToSettle?.id ?? null,
              rolloverFromLineId: line.rolloverFromLineId,
            })),
          });
          this.logger.log(
            `Created ${rolloverLinesTemp.length} rollover cycle lines for cycle ${cycle.id}`,
          );
        }

        return await tx.cycle.findUnique({ where: { id: cycle.id } });
      },
    );
    if (!openedCycle) throw new Error('Opened cycle not found');

    if (shouldSettlePreviousCycle) {
      recordSettlementStep(
        'close_previous_cycle',
        'strict',
        'succeeded',
        transitionStartedAt,
      );
      await this.runRecoverableSettlementSteps({
        settledCycleId: previousCycleToSettle.id,
        targetCycleId: input.cycleId,
        recordSettlementStep,
      });
    }

    const rolloverLineCount = await this.prisma.cycleLine.count({
      where: { cycleId: cycle.id, isRollover: true },
    });

    if (rolloverLineCount > 0) {
      const rolloverResult = await this.rollovers.processInventoryPurchase(
        cycle.id,
        previousCycleToClose?.id ?? null,
      );

      if (rolloverResult.totalRolloverCostIsk > 0) {
        this.logger.log(
          `Rollover purchase completed: ${rolloverResult.itemsRolledOver} items, ` +
            `${rolloverResult.totalRolloverCostIsk.toFixed(2)} ISK in inventory from rollover`,
        );
      }
    }

    void this.notifications
      .notifyCycleStarted(openedCycle.id)
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to send cycle started notifications: ${String(err)}`,
        ),
      );

    return {
      cycle: this.toCycleContract(openedCycle),
      settlementReport: buildSettlementReport(),
    };
  }

  async settleOpenCycle(input: {
    cycleId: string;
  }): Promise<CycleLifecycleResponse> {
    const openCycle = await this.cycles.getCurrentOpenCycle();
    if (!openCycle) {
      throw new BadRequestException('No Open Cycle to settle');
    }
    if (openCycle.id !== input.cycleId) {
      throw new BadRequestException(
        'Only the current Open Cycle can be settled',
      );
    }

    const { recordSettlementStep, buildSettlementReport } =
      this.createSettlementReportBuilder({
        settledCycleId: openCycle.id,
        targetCycleId: null,
      });

    this.logger.log(
      `Settling Open Cycle ${openCycle.id} without opening a target Cycle`,
    );

    await this.runStrictSettlementSteps({
      settledCycleId: openCycle.id,
      recordSettlementStep,
    });

    const closeStartedAt = Date.now();
    let closedCycle: CycleRecord;
    try {
      closedCycle = await this.cycles.closeCycle(openCycle.id, new Date());
      recordSettlementStep(
        'close_previous_cycle',
        'strict',
        'succeeded',
        closeStartedAt,
      );
    } catch (error) {
      recordSettlementStep(
        'close_previous_cycle',
        'strict',
        'failed',
        closeStartedAt,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }

    await this.runRecoverableSettlementSteps({
      settledCycleId: openCycle.id,
      targetCycleId: null,
      recordSettlementStep,
    });

    return {
      cycle: this.toCycleContract(closedCycle),
      settlementReport: buildSettlementReport(),
    };
  }

  private createSettlementReportBuilder(input: {
    settledCycleId: string | null;
    targetCycleId: string | null;
  }): {
    recordSettlementStep: CycleSettlementRecorder;
    buildSettlementReport: () => CycleSettlementReport;
  } {
    const settlementSteps: CycleSettlementStepReport[] = [];
    const recordSettlementStep: CycleSettlementRecorder = (
      name,
      kind,
      status,
      startedAt,
      message,
    ) => {
      settlementSteps.push({
        name,
        kind,
        status,
        durationMs: Date.now() - startedAt,
        ...(message ? { message } : {}),
      });
    };

    return {
      recordSettlementStep,
      buildSettlementReport: () => ({
        settledCycleId: input.settledCycleId,
        targetCycleId: input.targetCycleId,
        steps: settlementSteps,
        recoverableFailures: settlementSteps.filter(
          (step) => step.kind === 'recoverable' && step.status === 'failed',
        ),
      }),
    };
  }

  private async runStrictSettlementSteps(input: {
    settledCycleId: string;
    recordSettlementStep: CycleSettlementRecorder;
  }): Promise<void> {
    const { settledCycleId, recordSettlementStep } = input;

    const importStartedAt = Date.now();
    try {
      await this.wallet.importAllLinked();
      recordSettlementStep(
        'wallet_import',
        'strict',
        'succeeded',
        importStartedAt,
      );
    } catch (error) {
      recordSettlementStep(
        'wallet_import',
        'strict',
        'failed',
        importStartedAt,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }

    const allocationStartedAt = Date.now();
    try {
      const allocationResult: AllocationResult =
        await this.allocation.allocateAll(settledCycleId);
      recordSettlementStep(
        'transaction_allocation',
        'strict',
        'succeeded',
        allocationStartedAt,
        `buys=${allocationResult.buysAllocated}, sells=${allocationResult.sellsAllocated}`,
      );
      this.logger.log(
        `Allocation: buys=${allocationResult.buysAllocated}, sells=${allocationResult.sellsAllocated}`,
      );
    } catch (error) {
      recordSettlementStep(
        'transaction_allocation',
        'strict',
        'failed',
        allocationStartedAt,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }

    const buybackStartedAt = Date.now();
    try {
      const buybackResult =
        await this.rollovers.processInventoryBuyback(settledCycleId);
      recordSettlementStep(
        'rollover_buyback',
        'strict',
        'succeeded',
        buybackStartedAt,
        `${buybackResult.itemsBoughtBack} items, ${buybackResult.totalBuybackIsk.toFixed(2)} ISK`,
      );
      this.logger.log(
        `Buyback: ${buybackResult.itemsBoughtBack} items, ${buybackResult.totalBuybackIsk.toFixed(2)} ISK`,
      );
    } catch (error) {
      recordSettlementStep(
        'rollover_buyback',
        'strict',
        'failed',
        buybackStartedAt,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private async runRecoverableSettlementSteps(input: {
    settledCycleId: string;
    targetCycleId: string | null;
    recordSettlementStep: CycleSettlementRecorder;
  }): Promise<void> {
    const { settledCycleId, targetCycleId, recordSettlementStep } = input;

    const payoutsStartedAt = Date.now();
    try {
      this.logger.log(`Creating payouts for cycle ${settledCycleId}...`);
      const payouts = await this.payouts.createPayouts(settledCycleId);
      this.logger.log(
        `Created ${payouts.length} payouts for cycle ${settledCycleId}`,
      );
      recordSettlementStep(
        'payout_creation',
        'recoverable',
        'succeeded',
        payoutsStartedAt,
        `created=${payouts.length}`,
      );
    } catch (error) {
      this.logger.warn(
        `Payout creation failed for cycle ${settledCycleId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      recordSettlementStep(
        'payout_creation',
        'recoverable',
        'failed',
        payoutsStartedAt,
        error instanceof Error ? error.message : String(error),
      );
    }

    const rolloverStartedAt = Date.now();
    if (!targetCycleId) {
      recordSettlementStep(
        'cycle_rollover',
        'recoverable',
        'skipped',
        rolloverStartedAt,
        'No target Cycle; Rollover Intent becomes payout/admin follow-up',
      );
      return;
    }

    try {
      this.logger.log(`Processing rollovers for cycle ${settledCycleId}...`);
      const rolloverResult = await this.rollovers.processParticipationRollovers(
        settledCycleId,
        targetCycleId,
      );
      if (rolloverResult.processed > 0) {
        this.logger.log(
          `Processed ${rolloverResult.processed} rollovers: ${rolloverResult.rolledOver} ISK rolled over, ${rolloverResult.paidOut} ISK paid out`,
        );
      }
      recordSettlementStep(
        'cycle_rollover',
        'recoverable',
        'succeeded',
        rolloverStartedAt,
        `processed=${rolloverResult.processed}, rolledOver=${rolloverResult.rolledOver}, paidOut=${rolloverResult.paidOut}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to process rollovers for cycle ${settledCycleId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      recordSettlementStep(
        'cycle_rollover',
        'recoverable',
        'failed',
        rolloverStartedAt,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private toCycleContract(cycle: CycleRecord): Cycle {
    return {
      id: cycle.id,
      name: cycle.name,
      status: cycle.status,
      startedAt: cycle.startedAt.toISOString(),
      closedAt: cycle.closedAt?.toISOString() ?? null,
      initialCapitalIsk: this.toNullableContractString(cycle.initialCapitalIsk),
      initialInjectionIsk: this.toNullableContractString(
        cycle.initialInjectionIsk,
      ),
      createdAt: cycle.createdAt.toISOString(),
      updatedAt: cycle.updatedAt.toISOString(),
    };
  }

  private toNullableContractString(value: unknown): string | null {
    if (value == null) return null;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint' ||
      typeof value === 'boolean' ||
      typeof value === 'symbol'
    ) {
      return value.toString();
    }

    if (typeof value === 'object') {
      return (value as { toString: () => string }).toString();
    }

    throw new Error('Cycle numeric value cannot be converted to a contract');
  }
}
