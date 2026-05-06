import { Injectable } from '@nestjs/common';
import { CycleService } from './cycle.service';
import { WalletService } from '@api/tradecraft/wallet/services/wallet.service';
import { AllocationService } from '@api/tradecraft/wallet/services/allocation.service';
import type {
  Cycle,
  CycleLifecycleResponse,
} from '@eve/shared/tradecraft-cycles';

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
  constructor(
    private readonly cycles: CycleService,
    private readonly wallet: WalletService,
    private readonly allocation: AllocationService,
  ) {}

  async openPlannedCycle(input: {
    cycleId: string;
    startedAt?: Date;
  }): Promise<CycleLifecycleResponse> {
    const result = await this.cycles.openPlannedCycle(input, {
      walletService: this.wallet,
      allocationService: this.allocation,
    });

    return {
      cycle: this.toCycleContract(result.cycle),
      settlementReport: result.settlementReport,
    };
  }

  async settleOpenCycle(input: {
    cycleId: string;
  }): Promise<CycleLifecycleResponse> {
    const result = await this.cycles.settleOpenCycle(input, {
      walletService: this.wallet,
      allocationService: this.allocation,
    });

    return {
      cycle: this.toCycleContract(result.cycle),
      settlementReport: result.settlementReport,
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
