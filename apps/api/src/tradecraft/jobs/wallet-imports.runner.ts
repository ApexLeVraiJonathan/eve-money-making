import { Injectable, Logger } from '@nestjs/common';
import { OpenCycleWalletRefreshService } from '@api/tradecraft/cycles/services/open-cycle-wallet-refresh.service';

@Injectable()
export class WalletImportsRunner {
  private readonly logger = new Logger(WalletImportsRunner.name);

  constructor(
    private readonly walletRefresh: OpenCycleWalletRefreshService,
  ) {}

  /**
   * Steady-state Open Cycle wallet import and allocation (no jobs-enabled check).
   * Can be called manually via API or from a scheduled job. This is not Cycle Settlement.
   */
  async executeWalletImportsAndAllocation(): Promise<{
    buysAllocated: number;
    sellsAllocated: number;
  }> {
    const result = await this.walletRefresh.refresh({ createSnapshots: true });
    this.logger.log(
      `Steady-state Open Cycle wallet import and allocation completed: buys=${result.buysAllocated}, sells=${result.sellsAllocated}`,
    );

    return result;
  }
}
