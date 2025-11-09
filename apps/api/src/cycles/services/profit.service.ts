import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GameDataService } from '../../game-data/services/game-data.service';
import { AppConfig } from '../../common/config';

/**
 * ProfitService handles all profit calculation logic.
 *
 * Responsibilities:
 * - Compute realized cycle profit from completed sales
 * - Estimate unrealized profit from current inventory
 * - Calculate portfolio valuations
 *
 * Profit Formulas:
 * - Line Profit = SalesNet - BuyCost - BrokerFees - RelistFees
 * - Cycle Profit = Sum(Line Profits) - Transport Fees
 * - Estimated Profit = Realized + (CurrentValue - CostBasis) for unsold inventory
 */
@Injectable()
export class ProfitService {
  private readonly logger = new Logger(ProfitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameData: GameDataService,
  ) {}

  /**
   * Compute realized profit for a cycle from completed sales.
   *
   * Formula:
   * - Per-line: SalesNet - BuyCost - BrokerFees - RelistFees
   * - Cycle Total: Sum(Line Profits) - Transport Fees
   *
   * @param cycleId - Cycle to compute profit for
   * @returns Profit breakdown with line-level details
   */
  async computeCycleProfit(cycleId: string): Promise<{
    lineProfitExclTransport: string;
    transportFees: string;
    cycleProfitCash: string;
    lineBreakdown: Array<{
      lineId: string;
      typeId: number;
      typeName: string;
      destinationStationId: number;
      destinationStationName: string;
      profit: string;
    }>;
  }> {
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        salesNetIsk: true,
        buyCostIsk: true,
        brokerFeesIsk: true,
        relistFeesIsk: true,
      },
    });

    const fees = await this.prisma.cycleFeeEvent.findMany({
      where: { cycleId, feeType: 'transport' },
      select: { amountIsk: true },
    });

    let lineProfitTotal = 0;
    const breakdown: Array<{
      lineId: string;
      typeId: number;
      typeName: string;
      destinationStationId: number;
      destinationStationName: string;
      profit: string;
    }> = [];

    // Fetch names
    const typeIds = Array.from(new Set(lines.map((l) => l.typeId)));
    const stationIds = Array.from(
      new Set(lines.map((l) => l.destinationStationId)),
    );
    const [typeNameById, stationNameById] = await Promise.all([
      this.gameData.getTypeNames(typeIds),
      this.gameData.getStationNames(stationIds),
    ]);

    for (const line of lines) {
      const profit =
        Number(line.salesNetIsk) -
        Number(line.buyCostIsk) -
        Number(line.brokerFeesIsk) -
        Number(line.relistFeesIsk);
      lineProfitTotal += profit;
      breakdown.push({
        lineId: line.id,
        typeId: line.typeId,
        typeName: typeNameById.get(line.typeId) ?? String(line.typeId),
        destinationStationId: line.destinationStationId,
        destinationStationName:
          stationNameById.get(line.destinationStationId) ??
          String(line.destinationStationId),
        profit: profit.toFixed(2),
      });
    }

    const transportTotal = fees.reduce(
      (sum, f) => sum + Number(f.amountIsk),
      0,
    );
    const cycleProfitCash = lineProfitTotal - transportTotal;

    return {
      lineProfitExclTransport: lineProfitTotal.toFixed(2),
      transportFees: transportTotal.toFixed(2),
      cycleProfitCash: cycleProfitCash.toFixed(2),
      lineBreakdown: breakdown,
    };
  }

  /**
   * Compute estimated profit (current + projected from remaining inventory)
   */
  async computeEstimatedProfit(cycleId: string): Promise<{
    currentProfit: string;
    estimatedAdditionalRevenue: string;
    estimatedAdditionalFees: string;
    estimatedTotalProfit: string;
    lineBreakdown: Array<{
      lineId: string;
      typeId: number;
      typeName: string;
      destinationStationId: number;
      destinationStationName: string;
      currentProfit: string;
      remainingUnits: number;
      currentSellPrice: string | null;
      estimatedRevenue: string;
      estimatedFees: string;
      estimatedLineProfit: string;
    }>;
  }> {
    // First get current profit
    const currentProfitData = await this.computeCycleProfit(cycleId);
    const currentProfit = Number(currentProfitData.cycleProfitCash);

    // Get all lines with unsold inventory
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        unitsBought: true,
        unitsSold: true,
        buyCostIsk: true,
        salesNetIsk: true,
        brokerFeesIsk: true,
        relistFeesIsk: true,
        currentSellPriceIsk: true,
      },
    });

    // Fetch names
    const typeIds = Array.from(new Set(lines.map((l) => l.typeId)));
    const stationIds = Array.from(
      new Set(lines.map((l) => l.destinationStationId)),
    );
    const [typeNameById, stationNameById] = await Promise.all([
      this.gameData.getTypeNames(typeIds),
      this.gameData.getStationNames(stationIds),
    ]);

    let totalEstimatedRevenue = 0;
    let totalEstimatedFees = 0;
    const breakdown: Array<{
      lineId: string;
      typeId: number;
      typeName: string;
      destinationStationId: number;
      destinationStationName: string;
      currentProfit: string;
      remainingUnits: number;
      currentSellPrice: string | null;
      estimatedRevenue: string;
      estimatedFees: string;
      estimatedLineProfit: string;
    }> = [];

    const feeDefaults = AppConfig.arbitrage().fees;

    for (const line of lines) {
      const currentLineProfit =
        Number(line.salesNetIsk) -
        Number(line.buyCostIsk) -
        Number(line.brokerFeesIsk) -
        Number(line.relistFeesIsk);

      const remainingUnits = Math.max(0, line.unitsBought - line.unitsSold);
      const currentSellPrice = line.currentSellPriceIsk
        ? Number(line.currentSellPriceIsk)
        : null;

      let estimatedRevenue = 0;
      let estimatedFees = 0;

      if (remainingUnits > 0 && currentSellPrice) {
        const grossRevenue = remainingUnits * currentSellPrice;
        const salesTax = grossRevenue * (feeDefaults.salesTaxPercent / 100);
        estimatedRevenue = grossRevenue - salesTax;
        // Broker fees already paid on listing, only sales tax on sell
        estimatedFees = salesTax;
      }

      totalEstimatedRevenue += estimatedRevenue;
      totalEstimatedFees += estimatedFees;

      const estimatedLineProfit = estimatedRevenue - estimatedFees;

      breakdown.push({
        lineId: line.id,
        typeId: line.typeId,
        typeName: typeNameById.get(line.typeId) ?? String(line.typeId),
        destinationStationId: line.destinationStationId,
        destinationStationName:
          stationNameById.get(line.destinationStationId) ??
          String(line.destinationStationId),
        currentProfit: currentLineProfit.toFixed(2),
        remainingUnits,
        currentSellPrice: currentSellPrice?.toFixed(2) ?? null,
        estimatedRevenue: estimatedRevenue.toFixed(2),
        estimatedFees: estimatedFees.toFixed(2),
        estimatedLineProfit: estimatedLineProfit.toFixed(2),
      });
    }

    const estimatedTotalProfit =
      currentProfit + totalEstimatedRevenue - totalEstimatedFees;

    return {
      currentProfit: currentProfit.toFixed(2),
      estimatedAdditionalRevenue: totalEstimatedRevenue.toFixed(2),
      estimatedAdditionalFees: totalEstimatedFees.toFixed(2),
      estimatedTotalProfit: estimatedTotalProfit.toFixed(2),
      lineBreakdown: breakdown,
    };
  }

  /**
   * Compute portfolio value (inventory + expected sales revenue)
   */
  async computePortfolioValue(cycleId: string): Promise<{
    cycle: { id: string; name: string | null; startedAt: Date };
    totalValue: string;
    breakdown: Array<{
      lineId: string;
      typeId: number;
      typeName: string;
      destinationStationId: number;
      destinationStationName: string;
      remainingUnits: number;
      wacUnitCost: string;
      currentSellPrice: string | null;
      inventoryValue: string;
      expectedSalesRevenue: string;
    }>;
  }> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { id: true, name: true, startedAt: true },
    });
    if (!cycle) throw new Error('Cycle not found');

    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        unitsBought: true,
        unitsSold: true,
        buyCostIsk: true,
        currentSellPriceIsk: true,
      },
    });

    const typeIds = Array.from(new Set(lines.map((l) => l.typeId)));
    const stationIds = Array.from(
      new Set(lines.map((l) => l.destinationStationId)),
    );
    const [typeNameById, stationNameById] = await Promise.all([
      this.gameData.getTypeNames(typeIds),
      this.gameData.getStationNames(stationIds),
    ]);

    let totalInventoryValue = 0;
    let totalSalesRevenue = 0;
    const breakdown: Array<{
      lineId: string;
      typeId: number;
      typeName: string;
      destinationStationId: number;
      destinationStationName: string;
      remainingUnits: number;
      wacUnitCost: string;
      currentSellPrice: string | null;
      inventoryValue: string;
      expectedSalesRevenue: string;
    }> = [];

    for (const line of lines) {
      const remainingUnits = Math.max(0, line.unitsBought - line.unitsSold);
      if (remainingUnits === 0) continue;

      const wacUnitCost =
        line.unitsBought > 0 ? Number(line.buyCostIsk) / line.unitsBought : 0;
      const inventoryValue = wacUnitCost * remainingUnits;
      totalInventoryValue += inventoryValue;

      const currentSellPrice = line.currentSellPriceIsk
        ? Number(line.currentSellPriceIsk)
        : null;
      const expectedSalesRevenue = currentSellPrice
        ? currentSellPrice * remainingUnits
        : 0;
      totalSalesRevenue += expectedSalesRevenue;

      breakdown.push({
        lineId: line.id,
        typeId: line.typeId,
        typeName: typeNameById.get(line.typeId) ?? String(line.typeId),
        destinationStationId: line.destinationStationId,
        destinationStationName:
          stationNameById.get(line.destinationStationId) ??
          String(line.destinationStationId),
        remainingUnits,
        wacUnitCost: wacUnitCost.toFixed(2),
        currentSellPrice: currentSellPrice?.toFixed(2) ?? null,
        inventoryValue: inventoryValue.toFixed(2),
        expectedSalesRevenue: expectedSalesRevenue.toFixed(2),
      });
    }

    const totalValue = totalInventoryValue + totalSalesRevenue;

    return {
      cycle: { id: cycle.id, name: cycle.name, startedAt: cycle.startedAt },
      totalValue: totalValue.toFixed(2),
      breakdown,
    };
  }
}
