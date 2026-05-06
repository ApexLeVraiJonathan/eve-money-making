import { Injectable, Logger } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { CycleRolloverService } from './cycle-rollover.service';
import {
  OpenCycleWalletRefreshError,
  OpenCycleWalletRefreshService,
} from './open-cycle-wallet-refresh.service';
import type { CycleSettlementRecorder } from './cycle-settlement-report.builder';

@Injectable()
export class CycleSettlementRunnerService {
  private readonly logger = new Logger(CycleSettlementRunnerService.name);

  constructor(
    private readonly walletRefresh: OpenCycleWalletRefreshService,
    private readonly payouts: PayoutService,
    private readonly rollovers: CycleRolloverService,
  ) {}

  async runStrictSteps(input: {
    settledCycleId: string;
    recordSettlementStep: CycleSettlementRecorder;
  }): Promise<void> {
    const { settledCycleId, recordSettlementStep } = input;

    const walletStartedAt = Date.now();
    try {
      const allocationResult =
        await this.walletRefresh.prepareStrictSettlementWalletActivity(
          settledCycleId,
        );
      recordSettlementStep(
        'wallet_import',
        'strict',
        'succeeded',
        walletStartedAt,
      );
      recordSettlementStep(
        'transaction_allocation',
        'strict',
        'succeeded',
        walletStartedAt,
        `buys=${allocationResult.buysAllocated}, sells=${allocationResult.sellsAllocated}`,
      );
      this.logger.log(
        `Allocation: buys=${allocationResult.buysAllocated}, sells=${allocationResult.sellsAllocated}`,
      );
    } catch (error) {
      if (
        error instanceof OpenCycleWalletRefreshError &&
        error.phase === 'transaction_allocation'
      ) {
        recordSettlementStep(
          'wallet_import',
          'strict',
          'succeeded',
          walletStartedAt,
        );
      }
      recordSettlementStep(
        error instanceof OpenCycleWalletRefreshError
          ? error.phase
          : 'wallet_import',
        'strict',
        'failed',
        walletStartedAt,
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

  async runRecoverableSteps(input: {
    settledCycleId: string;
    targetCycleId: string | null;
    recordSettlementStep: CycleSettlementRecorder;
  }): Promise<void> {
    const { settledCycleId, targetCycleId, recordSettlementStep } = input;

    const payoutsStartedAt = Date.now();
    try {
      this.logger.log(`Creating payouts for cycle ${settledCycleId}...`);
      const payouts =
        await this.payouts.createSettlementPayoutSnapshot(settledCycleId);
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
}
