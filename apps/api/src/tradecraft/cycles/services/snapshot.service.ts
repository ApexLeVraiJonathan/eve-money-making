import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { EsiCharactersService } from '@api/esi/esi-characters.service';
import { CharacterService } from '@api/characters/services/character.service';
import { ProfitService } from './profit.service';

/**
 * SnapshotService handles cycle state snapshots.
 * Responsibilities: Creating and retrieving cycle snapshots.
 */
@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly esiChars: EsiCharactersService,
    private readonly characterService: CharacterService,
    @Inject(forwardRef(() => ProfitService))
    private readonly profitService: ProfitService,
  ) {}

  /**
   * Create a cycle snapshot with profit calculation.
   *
   * Snapshot captures:
   * - Cash position (total capital - inventory)
   * - Inventory value (unsold items at WAC)
   * - Cycle profit (from completed sales)
   *
   * Accounting model:
   * - Total Capital = Initial Capital + Net Profit
   * - Inventory = Σ[(unitsBought - unitsSold) × WAC]
   * - Cash = Total Capital - Inventory
   *
   * @param cycleId - Cycle to snapshot
   * @returns Snapshot data
   */
  async createCycleSnapshot(cycleId: string): Promise<{
    walletCashIsk: string;
    inventoryIsk: string;
    cycleProfitIsk: string;
  }> {
    // 1) Get cycle's initial capital
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { initialCapitalIsk: true },
    });
    const initialCapital = cycle?.initialCapitalIsk
      ? Number(cycle.initialCapitalIsk)
      : 0;

    // 2) Compute realized cycle profit from completed sales (includes all fees)
    const profit = await this.profitService.computeCycleProfit(cycleId);
    const currentProfit = Number(profit.cycleProfitCash);

    // 3) Calculate total capital: Initial Capital + Net Profit
    const totalCapital = initialCapital + currentProfit;

    // 4) Compute inventory value using weighted-average cost (WAC)
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: { unitsBought: true, unitsSold: true, buyCostIsk: true },
    });
    let inventoryTotal = 0;
    for (const line of lines) {
      const unitsRemaining = Math.max(0, line.unitsBought - line.unitsSold);
      if (unitsRemaining > 0 && line.unitsBought > 0) {
        // WAC = Total Cost / Total Units Bought
        const wac = Number(line.buyCostIsk) / line.unitsBought;
        inventoryTotal += wac * unitsRemaining;
      }
    }

    // 5) Calculate cash: Total Capital - Inventory
    const walletCash = totalCapital - inventoryTotal;

    // Store snapshot
    await this.prisma.cycleSnapshot.create({
      data: {
        cycleId,
        snapshotAt: new Date(),
        walletCashIsk: walletCash.toFixed(2),
        inventoryIsk: inventoryTotal.toFixed(2),
        cycleProfitIsk: profit.cycleProfitCash,
      },
    });

    return {
      walletCashIsk: walletCash.toFixed(2),
      inventoryIsk: inventoryTotal.toFixed(2),
      cycleProfitIsk: profit.cycleProfitCash,
    };
  }

  /**
   * Get all snapshots for a cycle
   */
  async getCycleSnapshots(cycleId: string) {
    return await this.prisma.cycleSnapshot.findMany({
      where: { cycleId },
      orderBy: { snapshotAt: 'asc' },
    });
  }
}
