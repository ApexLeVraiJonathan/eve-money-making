import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { WalletService } from '@api/tradecraft/wallet/services/wallet.service';
import { AllocationService } from '@api/tradecraft/wallet/services/allocation.service';
import { SnapshotService } from './snapshot.service';

export type OpenCycleWalletRefreshResult = {
  buysAllocated: number;
  sellsAllocated: number;
  unmatchedBuys: number;
  unmatchedSells: number;
  snapshottedCycleIds: string[];
};

@Injectable()
export class OpenCycleWalletRefreshService {
  private readonly logger = new Logger(OpenCycleWalletRefreshService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
    private readonly allocation: AllocationService,
    private readonly snapshots: SnapshotService,
  ) {}

  async refresh(input?: {
    cycleId?: string;
    createSnapshots?: boolean;
  }): Promise<OpenCycleWalletRefreshResult> {
    await this.importWallets();
    const result = await this.allocateCycle(input?.cycleId);
    const snapshottedCycleIds = input?.createSnapshots
      ? await this.snapshotOpenCycles()
      : [];

    return {
      ...result,
      snapshottedCycleIds,
    };
  }

  async importWallets(): Promise<void> {
    await this.wallets.importAllLinked();
  }

  async allocateCycle(cycleId?: string): Promise<
    Omit<OpenCycleWalletRefreshResult, 'snapshottedCycleIds'>
  > {
    return await this.allocation.allocateAll(cycleId);
  }

  private async snapshotOpenCycles(): Promise<string[]> {
    try {
      const openCycles = await this.prisma.cycle.findMany({
        where: { status: 'OPEN' },
        select: { id: true },
      });
      await Promise.all(
        openCycles.map((cycle) => this.snapshots.createCycleSnapshot(cycle.id)),
      );
      this.logger.log(
        `Cycle snapshots created for ${openCycles.length} open cycles`,
      );
      return openCycles.map((cycle) => cycle.id);
    } catch (e) {
      this.logger.warn(
        `Snapshot creation failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return [];
    }
  }
}
