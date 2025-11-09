import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EsiCharactersService } from '../../esi/esi-characters.service';
import { CharacterService } from '../../characters/services/character.service';
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
   * - Cash position (initial capital + realized profit)
   * - Inventory value (unsold items at WAC)
   * - Cycle profit (from completed sales)
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

    // 2) Compute realized cycle profit from completed sales
    const profit = await this.profitService.computeCycleProfit(cycleId);
    const currentProfit = Number(profit.cycleProfitCash);

    // 3) Calculate cash position: Initial Capital + Realized Profit
    const walletCash = initialCapital + currentProfit;

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
