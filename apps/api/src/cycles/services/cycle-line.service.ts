import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GameDataService } from '../../game-data/services/game-data.service';

/**
 * CycleLineService handles cycle line (item tracking) management.
 * Responsibilities: Cycle line CRUD, enrichment with names.
 */
@Injectable()
export class CycleLineService {
  private readonly logger = new Logger(CycleLineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameData: GameDataService,
  ) {}

  /**
   * Create a cycle line
   */
  async createCycleLine(input: {
    cycleId: string;
    typeId: number;
    destinationStationId: number;
    plannedUnits: number;
  }) {
    return await this.prisma.cycleLine.create({
      data: {
        cycleId: input.cycleId,
        typeId: input.typeId,
        destinationStationId: input.destinationStationId,
        plannedUnits: input.plannedUnits,
      },
    });
  }

  /**
   * List cycle lines with enriched data (type and station names)
   */
  async listCycleLines(cycleId: string) {
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        plannedUnits: true,
        unitsBought: true,
        buyCostIsk: true,
        unitsSold: true,
        salesGrossIsk: true,
        salesTaxIsk: true,
        salesNetIsk: true,
        brokerFeesIsk: true,
        relistFeesIsk: true,
        currentSellPriceIsk: true,
        listedUnits: true,
        isRollover: true,
        rolloverFromCycleId: true,
        rolloverFromLineId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich with type and station names
    const typeIds = Array.from(new Set(lines.map((l) => l.typeId)));
    const stationIds = Array.from(
      new Set(lines.map((l) => l.destinationStationId)),
    );

    const [typeNameById, stationNameById] = await Promise.all([
      this.gameData.getTypeNames(typeIds),
      this.gameData.getStationNames(stationIds),
    ]);

    return lines.map((l) => {
      const unitsBought = l.unitsBought;
      const unitsSold = l.unitsSold;
      const unitsRemaining = Math.max(0, unitsBought - unitsSold);
      const wacUnitCost =
        unitsBought > 0 ? Number(l.buyCostIsk) / unitsBought : 0;

      // Calculate profit: SalesNet - COGS - Fees
      const cogs = wacUnitCost * unitsSold;
      const lineProfitExclTransport =
        Number(l.salesNetIsk) -
        cogs -
        Number(l.brokerFeesIsk) -
        Number(l.relistFeesIsk);

      return {
        id: l.id,
        typeId: l.typeId,
        typeName: typeNameById.get(l.typeId) ?? `Type ${l.typeId}`,
        destinationStationId: l.destinationStationId,
        destinationStationName:
          stationNameById.get(l.destinationStationId) ??
          `Station ${l.destinationStationId}`,
        plannedUnits: l.plannedUnits,
        unitsBought: l.unitsBought,
        buyCostIsk: Number(l.buyCostIsk).toFixed(2),
        wacUnitCost: wacUnitCost.toFixed(2),
        unitsSold: l.unitsSold,
        unitsRemaining,
        salesGrossIsk: Number(l.salesGrossIsk).toFixed(2),
        salesTaxIsk: Number(l.salesTaxIsk).toFixed(2),
        salesNetIsk: Number(l.salesNetIsk).toFixed(2),
        brokerFeesIsk: Number(l.brokerFeesIsk).toFixed(2),
        relistFeesIsk: Number(l.relistFeesIsk).toFixed(2),
        lineProfitExclTransport: lineProfitExclTransport.toFixed(2),
        currentSellPriceIsk: l.currentSellPriceIsk
          ? Number(l.currentSellPriceIsk).toFixed(2)
          : null,
        listedUnits: l.listedUnits,
        isRollover: l.isRollover,
        rolloverFromCycleId: l.rolloverFromCycleId,
        rolloverFromLineId: l.rolloverFromLineId,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Update a cycle line
   */
  async updateCycleLine(lineId: string, data: { plannedUnits?: number }) {
    return await this.prisma.cycleLine.update({
      where: { id: lineId },
      data,
    });
  }

  /**
   * Update current sell prices for multiple cycle lines in bulk
   * If quantity is provided, also increment listedUnits by that amount
   */
  async updateBulkSellPrices(input: {
    updates: Array<{
      lineId: string;
      currentSellPriceIsk: string;
      quantity?: number;
    }>;
  }) {
    return await this.prisma.$transaction(
      input.updates.map((update) =>
        this.prisma.cycleLine.update({
          where: { id: update.lineId },
          data: {
            currentSellPriceIsk: update.currentSellPriceIsk,
            ...(update.quantity
              ? { listedUnits: { increment: update.quantity } }
              : {}),
          },
        }),
      ),
    );
  }

  /**
   * Delete a cycle line
   */
  async deleteCycleLine(lineId: string) {
    return await this.prisma.cycleLine.delete({
      where: { id: lineId },
    });
  }

  // ===== Facade methods for external services =====

  /**
   * Get cycle lines for a specific cycle (facade for external services)
   */
  async getCycleLinesForCycle(cycleId: string): Promise<
    Array<{
      id: string;
      typeId: number;
      destinationStationId: number;
      unitsBought: number;
      buyCostIsk: string;
    }>
  > {
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        unitsBought: true,
        buyCostIsk: true,
      },
    });

    // Convert Decimal to string for API compatibility
    return lines.map((l) => ({
      id: l.id,
      typeId: l.typeId,
      destinationStationId: l.destinationStationId,
      unitsBought: l.unitsBought,
      buyCostIsk: l.buyCostIsk.toString(),
    }));
  }

  /**
   * Get cycle lines with unlisted units (units that have been bought but not yet listed)
   * This replaces the old logic that filtered by currentSellPriceIsk === null
   */
  async getUnlistedCycleLines(cycleId: string) {
    const allLines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        plannedUnits: true,
        unitsBought: true,
        unitsSold: true,
        listedUnits: true,
        buyCostIsk: true,
      },
    });

    // Filter to only lines that have unlisted units
    // unlistedUnits = max(0, unitsBought - listedUnits)
    // We use unitsBought (not remainingUnits) because listedUnits tracks cumulative listed units
    return allLines.filter((line) => {
      const bought = line.unitsBought ?? 0;
      const unlistedUnits = Math.max(0, bought - line.listedUnits);
      return unlistedUnits > 0;
    });
  }

  /**
   * Get cycle lines with remaining units
   */
  async getCycleLinesWithRemaining(cycleId: string) {
    return await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        plannedUnits: true,
        unitsBought: true,
        unitsSold: true,
        buyCostIsk: true,
        salesGrossIsk: true,
        salesNetIsk: true,
        currentSellPriceIsk: true,
      },
    });
  }
}
