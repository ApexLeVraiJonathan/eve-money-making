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

export type WalletRealitySyncMode = 'steady-state' | 'settlement-prelude';

export type WalletRealitySyncInput = {
  mode: WalletRealitySyncMode;
  cycleId?: string;
  createSnapshots?: boolean;
};

export class OpenCycleWalletRefreshError extends Error {
  constructor(
    readonly phase: 'wallet_import' | 'transaction_allocation',
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'OpenCycleWalletRefreshError';
  }
}

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
    return await this.syncWalletReality({
      mode: 'steady-state',
      cycleId: input?.cycleId,
      createSnapshots: input?.createSnapshots,
    });
  }

  async prepareStrictSettlementWalletActivity(
    cycleId: string,
  ): Promise<Omit<OpenCycleWalletRefreshResult, 'snapshottedCycleIds'>> {
    const result = await this.syncWalletReality({
      mode: 'settlement-prelude',
      cycleId,
    });
    return {
      buysAllocated: result.buysAllocated,
      sellsAllocated: result.sellsAllocated,
      unmatchedBuys: result.unmatchedBuys,
      unmatchedSells: result.unmatchedSells,
    };
  }

  async syncWalletReality(
    input: WalletRealitySyncInput,
  ): Promise<OpenCycleWalletRefreshResult> {
    try {
      await this.importWallets();
    } catch (error) {
      if (input.mode === 'steady-state') throw error;
      throw new OpenCycleWalletRefreshError('wallet_import', error);
    }

    let result: Omit<OpenCycleWalletRefreshResult, 'snapshottedCycleIds'>;
    try {
      result = await this.allocateCycle(input.cycleId);
    } catch (error) {
      if (input.mode === 'steady-state') throw error;
      throw new OpenCycleWalletRefreshError('transaction_allocation', error);
    }

    const snapshottedCycleIds = input.createSnapshots
      ? await this.snapshotOpenCycles()
      : [];

    return {
      ...result,
      snapshottedCycleIds,
    };
  }

  private async importWallets(): Promise<void> {
    await this.wallets.importAllLinked();
  }

  private async allocateCycle(
    cycleId?: string,
  ): Promise<Omit<OpenCycleWalletRefreshResult, 'snapshottedCycleIds'>> {
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
