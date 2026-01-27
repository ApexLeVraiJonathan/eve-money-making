import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { WalletService } from '@api/tradecraft/wallet/services/wallet.service';
import { AllocationService } from '@api/tradecraft/wallet/services/allocation.service';
import { SnapshotService } from '@api/tradecraft/cycles/services/snapshot.service';

@Injectable()
export class WalletImportsRunner {
  private readonly logger = new Logger(WalletImportsRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
    private readonly allocation: AllocationService,
    private readonly snapshotService: SnapshotService,
  ) {}

  /**
   * Core wallet import and allocation logic (no jobs-enabled check).
   * Can be called manually via API or from scheduled job.
   */
  async executeWalletImportsAndAllocation(): Promise<{
    buysAllocated: number;
    sellsAllocated: number;
  }> {
    await this.wallets.importAllLinked();
    const result = await this.allocation.allocateAll();
    this.logger.log(
      `Wallets import and allocation completed: buys=${result.buysAllocated}, sells=${result.sellsAllocated}`,
    );

    await this.snapshotOpenCycles();

    return result;
  }

  private async snapshotOpenCycles(): Promise<void> {
    try {
      const openCycles = await this.prisma.cycle.findMany({
        where: { status: 'OPEN' },
        select: { id: true },
      });
      for (const c of openCycles) {
        await this.snapshotService.createCycleSnapshot(c.id);
      }
      this.logger.log(
        `Cycle snapshots created for ${openCycles.length} open cycles`,
      );
    } catch (e) {
      this.logger.warn(
        `Snapshot creation failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
