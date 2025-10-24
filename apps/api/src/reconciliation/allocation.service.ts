import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CharacterLocation = 'JITA' | 'DODIXIE' | 'AMARR' | 'HEK' | 'RENS' | 'CN';

// Map hub locations to NPC station IDs
const LOCATION_TO_STATION: Record<CharacterLocation, number> = {
  JITA: 60003760,
  DODIXIE: 60011866,
  AMARR: 60008494,
  HEK: 60005686,
  RENS: 60004588,
  CN: 60003760, // fallback to Jita for now
};

@Injectable()
export class AllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  private readonly salesTaxPct =
    Number(process.env.DEFAULT_SALES_TAX_PCT) || 3.37;

  /**
   * Allocate all unallocated wallet transactions to cycle lines.
   * Returns stats: buys allocated, sells allocated, unmatched counts.
   */
  async allocateAll(cycleId?: string): Promise<{
    buysAllocated: number;
    sellsAllocated: number;
    unmatchedBuys: number;
    unmatchedSells: number;
  }> {
    const cycle =
      cycleId ??
      (
        await this.prisma.cycle.findFirst({
          where: { closedAt: null },
          orderBy: { startedAt: 'desc' },
          select: { id: true },
        })
      )?.id;

    if (!cycle) {
      this.logger.warn('[Allocation] No open cycle found');
      return {
        buysAllocated: 0,
        sellsAllocated: 0,
        unmatchedBuys: 0,
        unmatchedSells: 0,
      };
    }

    const buysResult = await this.allocateBuys(cycle);
    const sellsResult = await this.allocateSells(cycle);

    return {
      buysAllocated: buysResult.allocated,
      sellsAllocated: sellsResult.allocated,
      unmatchedBuys: buysResult.unmatched,
      unmatchedSells: sellsResult.unmatched,
    };
  }

  /**
   * Allocate buy transactions FIFO top-to-bottom across cycle lines.
   */
  private async allocateBuys(
    cycleId: string,
  ): Promise<{ allocated: number; unmatched: number }> {
    // Get cycle start date to filter transactions
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { startedAt: true },
    });

    if (!cycle) {
      this.logger.warn(`[Allocation] Cycle ${cycleId} not found`);
      return { allocated: 0, unmatched: 0 };
    }

    // Fetch all wallet buy transactions that occurred during or after cycle start
    const allBuyTxs = await this.prisma.walletTransaction.findMany({
      where: {
        isBuy: true,
        date: { gte: cycle.startedAt },
      },
      orderBy: { date: 'asc' },
      select: {
        characterId: true,
        transactionId: true,
        typeId: true,
        quantity: true,
        unitPrice: true,
      },
    });

    // Fetch all cycle lines for this cycle
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      orderBy: { createdAt: 'asc' }, // FIFO order
      select: {
        id: true,
        typeId: true,
        plannedUnits: true,
        unitsBought: true,
        buyCostIsk: true,
      },
    });

    let allocated = 0;
    let unmatched = 0;

    this.logger.log(
      `[Allocation] Processing ${allBuyTxs.length} buy transactions for cycle ${cycleId}`,
    );

    for (const tx of allBuyTxs) {
      // Check how much of this tx is already allocated
      const existingAllocations = await this.prisma.buyAllocation.aggregate({
        where: {
          walletCharacterId: tx.characterId,
          walletTransactionId: tx.transactionId,
        },
        _sum: { quantity: true },
      });
      const alreadyAllocated = existingAllocations._sum.quantity ?? 0;
      const remaining = tx.quantity - alreadyAllocated;

      if (remaining <= 0) {
        this.logger.debug(
          `[Allocation] TX ${tx.transactionId} already fully allocated`,
        );
        continue;
      }

      // Find lines for this type with capacity
      const matchingLines = lines.filter(
        (l) => l.typeId === tx.typeId && l.unitsBought < l.plannedUnits,
      );

      if (matchingLines.length === 0) {
        this.logger.debug(
          `[Allocation] No matching lines for TX ${tx.transactionId} typeId=${tx.typeId} qty=${remaining}`,
        );
        unmatched++;
        continue;
      }

      let toAllocate = remaining;
      for (const line of matchingLines) {
        if (toAllocate <= 0) break;

        const capacity = line.plannedUnits - line.unitsBought;
        const allocQty = Math.min(toAllocate, capacity);

        if (allocQty <= 0) continue;

        this.logger.log(
          `[Allocation] Allocating ${allocQty} units from TX ${tx.transactionId} to line ${line.id} @ ${tx.unitPrice} ISK/unit`,
        );

        // Create allocation
        await this.prisma.buyAllocation.create({
          data: {
            walletCharacterId: tx.characterId,
            walletTransactionId: tx.transactionId,
            lineId: line.id,
            quantity: allocQty,
            unitPrice: tx.unitPrice.toString(),
          },
        });

        // Update line totals using atomic increments to avoid race conditions
        const costIncrement = allocQty * Number(tx.unitPrice);

        this.logger.log(
          `[Allocation] Allocating to line ${line.id}: +${allocQty} units, +${costIncrement.toFixed(2)} ISK`,
        );

        await this.prisma.cycleLine.update({
          where: { id: line.id },
          data: {
            unitsBought: { increment: allocQty },
            buyCostIsk: { increment: costIncrement },
          },
        });

        toAllocate -= allocQty;
        // Update local cache for subsequent iterations
        line.unitsBought = line.unitsBought + allocQty;
        (line as any).buyCostIsk = (
          Number(line.buyCostIsk) + costIncrement
        ).toString();
        allocated++;
      }

      if (toAllocate > 0) {
        unmatched++;
      }
    }

    this.logger.log(
      `[Allocation] Buys: allocated=${allocated}, unmatched=${unmatched}`,
    );
    return { allocated, unmatched };
  }

  /**
   * Allocate sell transactions by matching character location to destination.
   */
  private async allocateSells(
    cycleId: string,
  ): Promise<{ allocated: number; unmatched: number }> {
    // Get cycle start date to filter transactions
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { startedAt: true },
    });

    if (!cycle) {
      this.logger.warn(`[Allocation] Cycle ${cycleId} not found`);
      return { allocated: 0, unmatched: 0 };
    }

    // Get SELLER characters with locations
    const sellers = await this.prisma.eveCharacter.findMany({
      where: { function: 'SELLER' },
      select: { id: true, location: true },
    });
    const charToStation = new Map<number, number>();
    for (const s of sellers) {
      if (s.location) {
        charToStation.set(
          s.id,
          LOCATION_TO_STATION[s.location as CharacterLocation],
        );
      }
    }

    // Fetch all wallet sell transactions that occurred during or after cycle start
    const allSellTxs = await this.prisma.walletTransaction.findMany({
      where: {
        isBuy: false,
        date: { gte: cycle.startedAt },
      },
      orderBy: { date: 'asc' },
      select: {
        characterId: true,
        transactionId: true,
        typeId: true,
        quantity: true,
        unitPrice: true,
      },
    });

    // Fetch all cycle lines
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        unitsBought: true,
        unitsSold: true,
        salesGrossIsk: true,
        salesTaxIsk: true,
        salesNetIsk: true,
      },
    });

    let allocated = 0;
    let unmatched = 0;

    for (const tx of allSellTxs) {
      // Check existing allocations
      const existingAllocations = await this.prisma.sellAllocation.aggregate({
        where: {
          walletCharacterId: tx.characterId,
          walletTransactionId: tx.transactionId,
        },
        _sum: { quantity: true },
      });
      const alreadyAllocated = existingAllocations._sum.quantity ?? 0;
      const remaining = tx.quantity - alreadyAllocated;

      if (remaining <= 0) continue;

      // Resolve destination from character location
      const destStation = charToStation.get(tx.characterId);
      if (!destStation) {
        unmatched++;
        continue;
      }

      // Find matching lines
      const matchingLines = lines.filter(
        (l) =>
          l.typeId === tx.typeId &&
          l.destinationStationId === destStation &&
          l.unitsSold < l.unitsBought,
      );

      if (matchingLines.length === 0) {
        unmatched++;
        continue;
      }

      let toAllocate = remaining;
      for (const line of matchingLines) {
        if (toAllocate <= 0) break;

        const capacity = line.unitsBought - line.unitsSold;
        const allocQty = Math.min(toAllocate, capacity);

        if (allocQty <= 0) continue;

        // Compute revenue and tax
        const revenue = allocQty * Number(tx.unitPrice);
        const tax = revenue * (this.salesTaxPct / 100);
        const net = revenue - tax;

        // Create allocation
        await this.prisma.sellAllocation.create({
          data: {
            walletCharacterId: tx.characterId,
            walletTransactionId: tx.transactionId,
            lineId: line.id,
            quantity: allocQty,
            unitPrice: tx.unitPrice.toString(),
            revenueIsk: revenue.toFixed(2),
            taxIsk: tax.toFixed(2),
          },
        });

        // Update line totals using atomic increments
        await this.prisma.cycleLine.update({
          where: { id: line.id },
          data: {
            unitsSold: { increment: allocQty },
            salesGrossIsk: { increment: revenue },
            salesTaxIsk: { increment: tax },
            salesNetIsk: { increment: net },
          },
        });

        toAllocate -= allocQty;
        // Update local cache for subsequent iterations
        line.unitsSold = line.unitsSold + allocQty;
        (line as any).salesGrossIsk = (
          Number(line.salesGrossIsk) + revenue
        ).toString();
        (line as any).salesTaxIsk = (Number(line.salesTaxIsk) + tax).toString();
        (line as any).salesNetIsk = (Number(line.salesNetIsk) + net).toString();
        allocated++;
      }

      if (toAllocate > 0) {
        unmatched++;
      }
    }

    this.logger.log(
      `[Allocation] Sells: allocated=${allocated}, unmatched=${unmatched}`,
    );
    return { allocated, unmatched };
  }
}
