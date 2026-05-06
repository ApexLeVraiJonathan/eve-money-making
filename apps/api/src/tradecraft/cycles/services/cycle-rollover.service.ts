import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { EsiCharactersService } from '@api/esi/esi-characters.service';
import { EsiService } from '@api/esi/esi.service';
import { CharacterService } from '@api/characters/services/character.service';
import { fetchStationOrders } from '@api/esi/market-helpers';
import { CAPITAL_CONSTANTS } from '../utils/capital-helpers';
import { PayoutService } from './payout.service';

export type RolloverLineCandidate = {
  typeId: number;
  destinationStationId: number;
  plannedUnits: number;
  currentSellPriceIsk: number | null;
  rolloverFromLineId: string | null;
  buyCostIsk: number;
};

@Injectable()
export class CycleRolloverService {
  private readonly logger = new Logger(CycleRolloverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly esiChars: EsiCharactersService,
    private readonly esi: EsiService,
    private readonly characterService: CharacterService,
    private readonly payouts: PayoutService,
  ) {}

  async buildRolloverLineCandidates(
    previousCycleId: string | null,
  ): Promise<RolloverLineCandidate[]> {
    if (previousCycleId) {
      this.logger.log(
        `[Rollover] Creating rollover lines from previous cycle ${previousCycleId}`,
      );
      const prevLines = await this.prisma.cycleLine.findMany({
        where: { cycleId: previousCycleId },
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

      const rolloverLines: RolloverLineCandidate[] = [];
      for (const prevLine of prevLines) {
        const remainingUnits = prevLine.unitsBought - prevLine.unitsSold;
        if (remainingUnits <= 0) continue;
        const wac =
          prevLine.unitsBought > 0
            ? Number(prevLine.buyCostIsk) / prevLine.unitsBought
            : 0;

        rolloverLines.push({
          typeId: prevLine.typeId,
          destinationStationId: prevLine.destinationStationId,
          plannedUnits: remainingUnits,
          currentSellPriceIsk: prevLine.currentSellPriceIsk
            ? Number(prevLine.currentSellPriceIsk)
            : null,
          rolloverFromLineId: prevLine.id,
          buyCostIsk: wac,
        });
      }

      this.logger.log(
        `[Rollover] Found ${rolloverLines.length} items with remaining inventory`,
      );
      return rolloverLines;
    }

    this.logger.log(
      `[Rollover] No previous cycle - fetching initial inventory from ESI`,
    );
    const key = (stationId: number, typeId: number) => `${stationId}:${typeId}`;
    const qtyByTypeStation = new Map<string, number>();
    const sellPriceByTypeStation = new Map<string, number>();
    const trackedChars = await this.characterService.getTrackedSellerIds();

    await Promise.all(
      trackedChars.map(async (cid) => {
        try {
          const orders = await this.esiChars.getOrders(cid);
          for (const order of orders) {
            if (order.is_buy_order) continue;
            const itemKey = key(order.location_id, order.type_id);
            qtyByTypeStation.set(
              itemKey,
              (qtyByTypeStation.get(itemKey) ?? 0) + order.volume_remain,
            );
            const existingPrice = sellPriceByTypeStation.get(itemKey);
            if (!existingPrice || order.price < existingPrice) {
              sellPriceByTypeStation.set(itemKey, order.price);
            }
          }
        } catch (error) {
          this.logger.warn(`Orders fetch failed for ${cid}: ${String(error)}`);
        }
      }),
    );

    const rolloverLines: RolloverLineCandidate[] = [];
    for (const [itemKey, qty] of qtyByTypeStation) {
      const [stationIdRaw, typeIdRaw] = itemKey.split(':');
      const stationId = Number(stationIdRaw);
      const typeId = Number(typeIdRaw);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      rolloverLines.push({
        typeId,
        destinationStationId: stationId,
        plannedUnits: Math.floor(qty),
        currentSellPriceIsk: sellPriceByTypeStation.get(itemKey) ?? null,
        rolloverFromLineId: null,
        buyCostIsk: 0,
      });

      if (rolloverLines.length >= CAPITAL_CONSTANTS.MAX_ROLLOVER_LINES) break;
    }

    this.logger.log(
      `[Rollover] Found ${rolloverLines.length} items from ESI sell orders`,
    );
    return rolloverLines;
  }

  async fetchJitaPricesForRolloverLines(
    rolloverLines: RolloverLineCandidate[],
  ): Promise<Map<number, number>> {
    const itemsNeedingJitaPrices = Array.from(
      new Set(
        rolloverLines
          .filter((line) => line.buyCostIsk === 0)
          .map((line) => line.typeId),
      ),
    );
    const jitaPriceMap = new Map<number, number>();
    if (itemsNeedingJitaPrices.length === 0) return jitaPriceMap;

    this.logger.log(
      `[Jita Fallback] Fetching Jita prices for ${itemsNeedingJitaPrices.length} items...`,
    );
    const jitaPrices = await Promise.all(
      itemsNeedingJitaPrices.map(async (typeId) => ({
        typeId,
        price: await this.fetchJitaCheapestSell(typeId),
      })),
    );
    for (const { typeId, price } of jitaPrices) {
      if (price) jitaPriceMap.set(typeId, price);
    }

    return jitaPriceMap;
  }

  resolveRolloverLineBuyCost(
    line: RolloverLineCandidate,
    jitaPriceMap: Map<number, number>,
  ): number {
    if (line.buyCostIsk > 0) return line.buyCostIsk * line.plannedUnits;

    const jitaPrice = jitaPriceMap.get(line.typeId);
    if (jitaPrice) {
      this.logger.log(
        `[Jita Fallback] Type ${line.typeId}: ${jitaPrice.toFixed(2)} ISK/unit`,
      );
      return jitaPrice * line.plannedUnits;
    }

    this.logger.error(
      `[Line Creation] Type ${line.typeId}: Missing buy cost and Jita price failed`,
    );
    return 0;
  }

  async processInventoryBuyback(cycleId: string): Promise<{
    itemsBoughtBack: number;
    totalBuybackIsk: number;
  }> {
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        unitsBought: true,
        unitsSold: true,
        buyCostIsk: true,
      },
    });

    let totalBuyback = 0;
    let itemsProcessed = 0;

    for (const line of lines) {
      const remainingUnits = line.unitsBought - line.unitsSold;
      if (remainingUnits <= 0) continue;

      const wac =
        line.unitsBought > 0 ? Number(line.buyCostIsk) / line.unitsBought : 0;

      if (wac === 0) {
        this.logger.error(
          `[Rollover Buyback] Line ${line.id} (type ${line.typeId}) has no buy cost. This should not happen. Skipping.`,
        );
        continue;
      }

      const buybackAmount = wac * remainingUnits;

      await this.prisma.sellAllocation.create({
        data: {
          lineId: line.id,
          walletCharacterId: null,
          walletTransactionId: null,
          isRollover: true,
          quantity: remainingUnits,
          unitPrice: wac,
          revenueIsk: buybackAmount,
          taxIsk: 0,
        },
      });

      await this.prisma.cycleLine.update({
        where: { id: line.id },
        data: {
          unitsSold: { increment: remainingUnits },
          salesGrossIsk: { increment: buybackAmount },
          salesNetIsk: { increment: buybackAmount },
        },
      });

      totalBuyback += buybackAmount;
      itemsProcessed++;
    }

    this.logger.log(
      `[Rollover Buyback] Processed ${itemsProcessed} line items, ${totalBuyback.toFixed(2)} ISK`,
    );

    return {
      itemsBoughtBack: itemsProcessed,
      totalBuybackIsk: totalBuyback,
    };
  }

  async processInventoryPurchase(
    newCycleId: string,
    previousCycleId: string | null,
  ): Promise<{
    itemsRolledOver: number;
    totalRolloverCostIsk: number;
  }> {
    const rolloverLines = await this.prisma.cycleLine.findMany({
      where: {
        cycleId: newCycleId,
        isRollover: true,
        ...(previousCycleId ? { rolloverFromCycleId: previousCycleId } : {}),
      },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        unitsBought: true,
        rolloverFromLineId: true,
      },
    });

    let totalCost = 0;
    let itemsProcessed = 0;

    for (const line of rolloverLines) {
      const currentLine = await this.prisma.cycleLine.findUnique({
        where: { id: line.id },
        select: {
          buyCostIsk: true,
          unitsBought: true,
        },
      });

      if (!currentLine) {
        this.logger.warn(
          `[Rollover Purchase] Current line ${line.id} not found, skipping`,
        );
        continue;
      }

      const wac =
        currentLine.unitsBought > 0
          ? Number(currentLine.buyCostIsk) / currentLine.unitsBought
          : 0;

      if (wac === 0) {
        this.logger.error(
          `[Rollover Purchase] Line ${line.id} (type ${line.typeId}) has no buy cost. This should not happen. Skipping.`,
        );
        continue;
      }

      const rolloverCost = wac * line.unitsBought;

      await this.prisma.buyAllocation.create({
        data: {
          lineId: line.id,
          walletCharacterId: null,
          walletTransactionId: null,
          isRollover: true,
          quantity: line.unitsBought,
          unitPrice: wac,
        },
      });

      await this.prisma.cycleLine.update({
        where: { id: line.id },
        data: {
          buyCostIsk: rolloverCost,
        },
      });

      totalCost += rolloverCost;
      itemsProcessed++;
    }

    this.logger.log(
      `[Rollover Purchase] Processed ${itemsProcessed} items, ${totalCost.toFixed(2)} ISK cost`,
    );

    return {
      itemsRolledOver: itemsProcessed,
      totalRolloverCostIsk: totalCost,
    };
  }

  async processParticipationRollovers(
    closedCycleId: string,
    targetCycleId: string,
  ): Promise<{
    processed: number;
    rolledOver: string;
    paidOut: string;
  }> {
    return await this.payouts.processRollovers(closedCycleId, targetCycleId);
  }

  private async fetchJitaCheapestSell(typeId: number): Promise<number | null> {
    const JITA_REGION_ID = 10000002; // The Forge
    const JITA_STATION_ID = 60003760; // Jita IV - Moon 4 - Caldari Navy Assembly Plant

    try {
      const orders = await fetchStationOrders(this.esi, {
        regionId: JITA_REGION_ID,
        stationId: JITA_STATION_ID,
        typeId,
        side: 'sell',
      });

      if (orders.length === 0) {
        return null;
      }

      return Math.min(...orders.map((order: { price: number }) => order.price));
    } catch (error: unknown) {
      this.logger.error(
        `[Jita Price Fetch] Failed to fetch Jita sell price for type ${typeId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
