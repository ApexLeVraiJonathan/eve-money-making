import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { CycleService } from './cycle.service';
import { CycleRolloverService } from './cycle-rollover.service';
import { NotificationService } from '@api/notifications/notification.service';
import { Prisma } from '@eve/prisma';
import { CycleSettlementReportBuilder } from './cycle-settlement-report.builder';
import { CycleSettlementRunnerService } from './cycle-settlement-runner.service';
import type {
  Cycle,
  CycleLifecycleResponse,
} from '@eve/shared/tradecraft-cycles' assert { 'resolution-mode': 'import' };

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

@Injectable()
export class CycleLifecycleService {
  private readonly logger = new Logger(CycleLifecycleService.name);

  constructor(
    private readonly cycles: CycleService,
    private readonly prisma: PrismaService,
    private readonly rollovers: CycleRolloverService,
    private readonly settlementRunner: CycleSettlementRunnerService,
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
    const settlementReport = new CycleSettlementReportBuilder({
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
      await this.settlementRunner.runStrictSteps({
        settledCycleId: previousCycleToSettle.id,
        recordSettlementStep: settlementReport.recordStep,
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
      settlementReport.recordStep(
        'close_previous_cycle',
        'strict',
        'succeeded',
        transitionStartedAt,
      );
      await this.settlementRunner.runRecoverableSteps({
        settledCycleId: previousCycleToSettle.id,
        targetCycleId: input.cycleId,
        recordSettlementStep: settlementReport.recordStep,
      });
    }

    const rolloverResult =
      await this.rollovers.processInventoryPurchaseIfPresent(
        cycle.id,
        previousCycleToClose?.id ?? null,
      );

    if (rolloverResult.totalRolloverCostIsk > 0) {
      this.logger.log(
        `Rollover purchase completed: ${rolloverResult.itemsRolledOver} items, ` +
          `${rolloverResult.totalRolloverCostIsk.toFixed(2)} ISK in inventory from rollover`,
      );
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
      settlementReport: settlementReport.build(),
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

    const settlementReport = new CycleSettlementReportBuilder({
      settledCycleId: openCycle.id,
      targetCycleId: null,
    });

    this.logger.log(
      `Settling Open Cycle ${openCycle.id} without opening a target Cycle`,
    );

    await this.settlementRunner.runStrictSteps({
      settledCycleId: openCycle.id,
      recordSettlementStep: settlementReport.recordStep,
    });

    const closeStartedAt = Date.now();
    let closedCycle: CycleRecord;
    try {
      closedCycle = await this.cycles.closeCycle(openCycle.id, new Date());
      settlementReport.recordStep(
        'close_previous_cycle',
        'strict',
        'succeeded',
        closeStartedAt,
      );
    } catch (error) {
      settlementReport.recordStep(
        'close_previous_cycle',
        'strict',
        'failed',
        closeStartedAt,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }

    await this.settlementRunner.runRecoverableSteps({
      settledCycleId: openCycle.id,
      targetCycleId: null,
      recordSettlementStep: settlementReport.recordStep,
    });

    return {
      cycle: this.toCycleContract(closedCycle),
      settlementReport: settlementReport.build(),
    };
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
