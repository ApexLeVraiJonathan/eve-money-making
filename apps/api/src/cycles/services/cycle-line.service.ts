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
   */
  async updateBulkSellPrices(input: {
    updates: Array<{ lineId: string; currentSellPriceIsk: string }>;
  }) {
    return await this.prisma.$transaction(
      input.updates.map((update) =>
        this.prisma.cycleLine.update({
          where: { id: update.lineId },
          data: { currentSellPriceIsk: update.currentSellPriceIsk },
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
      typeId: number;
      destinationStationId: number;
    }>
  > {
    return await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: { typeId: true, destinationStationId: true },
    });
  }

  /**
   * Get unlisted cycle lines (no current sell price set)
   */
  async getUnlistedCycleLines(cycleId: string) {
    return await this.prisma.cycleLine.findMany({
      where: {
        cycleId,
        currentSellPriceIsk: null,
      },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        plannedUnits: true,
        unitsBought: true,
        unitsSold: true,
        buyCostIsk: true,
      },
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
