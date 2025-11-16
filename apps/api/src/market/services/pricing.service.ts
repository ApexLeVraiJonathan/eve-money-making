import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EsiService } from '../../esi/esi.service';
import { EsiCharactersService } from '../../esi/esi-characters.service';
import { FeeService } from '../../cycles/services/fee.service';
import { fetchStationOrders } from '../../esi/market-helpers';
import { nextCheaperTick } from '../../common/money';
import { getEffectiveSell } from '../fees';
import { AppConfig } from '../../common/config';
import { GameDataService } from '../../game-data/services/game-data.service';
import { CharacterService } from '../../characters/services/character.service';
import { MarketDataService } from './market-data.service';
import { CycleLineService } from '../../cycles/services/cycle-line.service';
import { CycleService } from '../../cycles/services/cycle.service';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly esi: EsiService,
    private readonly esiChars: EsiCharactersService,
    private readonly feeService: FeeService,
    private readonly gameData: GameDataService,
    private readonly characterService: CharacterService,
    private readonly marketData: MarketDataService,
    private readonly cycleLineService: CycleLineService,
    private readonly cycleService: CycleService,
  ) {}

  private parseLines(lines: string[]): Array<{ name: string; qty: number }> {
    const out: Array<{ name: string; qty: number }> = [];
    const trailingQty = /(.*?)[\t\s]+(\d+)\s*$/u; // item name then whitespace then integer qty
    for (const raw of lines) {
      const line = raw.replace(/\u00A0/g, ' ').trim(); // normalize nbsp to space
      if (!line) continue;
      const m = line.match(trailingQty);
      if (!m) continue;
      const name = m[1].trim();
      const qty = Number(m[2]);
      if (!name || !Number.isFinite(qty) || qty <= 0) continue;
      out.push({ name, qty: Math.floor(qty) });
    }
    return out;
  }

  private async resolveTypeIdsByNames(
    names: string[],
  ): Promise<Map<string, number>> {
    return await this.gameData.resolveTypeIdsByNames(names);
  }

  async sellAppraise(params: {
    destinationStationId: number;
    lines: string[];
  }): Promise<
    Array<{
      itemName: string;
      quantity: number;
      destinationStationId: number;
      lowestSell: number | null;
      suggestedSellPriceTicked: number | null;
    }>
  > {
    const parsed = this.parseLines(params.lines);
    // Reverse order as requested (last pasted line first)
    parsed.reverse();
    const uniqueNames = Array.from(new Set(parsed.map((p) => p.name)));
    const nameToType = await this.resolveTypeIdsByNames(uniqueNames);

    // Resolve region for the destination
    const regionId = await this.gameData.getStationRegion(
      params.destinationStationId,
    );
    if (!regionId)
      return parsed.map((p) => ({
        itemName: p.name,
        quantity: p.qty,
        destinationStationId: params.destinationStationId,
        lowestSell: null,
        suggestedSellPriceTicked: null,
      }));

    // Fetch all market data in parallel for speed
    const fetchPromises = parsed.map(async (p) => {
      const typeId = nameToType.get(p.name);
      if (!typeId || !regionId) {
        return {
          itemName: p.name,
          quantity: p.qty,
          destinationStationId: params.destinationStationId,
          lowestSell: null,
          suggestedSellPriceTicked: null,
        };
      }

      // Try live station sell orders
      let orders: Array<{ price: number; volume: number }> = [];
      try {
        orders = await fetchStationOrders(this.esi, {
          regionId,
          typeId,
          stationId: params.destinationStationId,
          side: 'sell',
        });
        orders.sort((a, b) => a.price - b.price);
      } catch {
        // Ignore live fetch errors and rely on daily high fallback below
      }

      let lowest: number | null = null;
      if (orders.length) lowest = orders[0].price;

      // Fallback to latest high from market_order_trades_daily
      if (lowest === null) {
        const latest = await this.marketData.getLatestMarketTrade(
          typeId,
          params.destinationStationId,
        );
        if (latest) lowest = latest.high;
      }

      const suggested = lowest !== null ? nextCheaperTick(lowest) : null;

      return {
        itemName: p.name,
        quantity: p.qty,
        destinationStationId: params.destinationStationId,
        lowestSell: lowest,
        suggestedSellPriceTicked: suggested,
      };
    });

    return await Promise.all(fetchPromises);
  }

  async undercutCheck(params: {
    characterIds?: number[];
    stationIds?: number[];
    cycleId?: string;
  }): Promise<
    Array<{
      characterId: number;
      characterName: string;
      stationId: number;
      stationName: string;
      updates: Array<{
        orderId: number;
        typeId: number;
        itemName: string;
        remaining: number;
        currentPrice: number;
        competitorLowest: number;
        suggestedNewPriceTicked: number;
      }>;
    }>
  > {
    const startTime = Date.now();

    // Determine characters to check - default to logistics sellers
    const characters = params.characterIds?.length
      ? await Promise.all(
          params.characterIds.map(async (id) => {
            const name = await this.characterService.getCharacterName(id);
            return name ? { id, name } : null;
          }),
        ).then((chars) =>
          chars.filter((c): c is { id: number; name: string } => c !== null),
        )
      : await this.characterService.getSellerCharacters();

    const characterNameById = new Map<number, string>();
    for (const c of characters) characterNameById.set(c.id, c.name);

    // Stations default to tracked stations
    const stationIds: number[] = params.stationIds?.length
      ? params.stationIds
      : await this.marketData.getTrackedStationIds();

    // Use Set for O(1) station lookup
    const stationIdSet = new Set(stationIds);

    // Preload regions per station using GameDataService
    const stationsWithRegions =
      await this.gameData.getStationsWithRegions(stationIds);
    const regionByStation = new Map<number, number>();
    const stationNameById = new Map<number, string>();
    for (const [stationId, data] of stationsWithRegions.entries()) {
      stationNameById.set(stationId, data.name);
      if (data.regionId) {
        regionByStation.set(stationId, data.regionId);
      }
    }

    const setupTime = Date.now();

    // Collect our own active sell orders per station and per type in parallel
    const ordersResults = await Promise.allSettled(
      characters.map((c) => this.esiChars.getOrders(c.id)),
    );

    const ourOrders: Array<{
      characterId: number;
      order_id: number;
      type_id: number;
      price: number;
      volume_remain: number;
      location_id: number;
      issued?: string;
    }> = [];

    ordersResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const c = characters[idx];
        for (const o of result.value) {
          if (o.is_buy_order) continue;
          if (!stationIdSet.has(o.location_id)) continue;
          ourOrders.push({
            characterId: c.id,
            order_id: o.order_id,
            type_id: o.type_id,
            price: o.price,
            volume_remain: o.volume_remain,
            location_id: o.location_id,
            issued: o.issued,
          });
        }
      } else {
        console.warn(
          `Orders fetch failed for character ${characters[idx].id}: ${String(result.reason)}`,
        );
      }
    });

    const fetchOrdersTime = Date.now();

    // Early exit if no orders to check
    if (ourOrders.length === 0) {
      console.log(
        `UndercutCheck: No orders to check (setup=${setupTime - startTime}ms, fetchOrders=${fetchOrdersTime - setupTime}ms)`,
      );
      return [];
    }

    // Optional: filter orders to those belonging to a specific cycle scope
    if (params.cycleId) {
      const lines = await this.cycleLineService.getCycleLinesForCycle(
        params.cycleId,
      );

      if (lines.length > 0) {
        // Only check orders for items/stations in the cycle
        const allowed = new Set(
          lines.map((l) => `${l.destinationStationId}:${l.typeId}`),
        );

        for (let i = ourOrders.length - 1; i >= 0; i--) {
          const o = ourOrders[i];
          const key = `${o.location_id}:${o.type_id}`;
          if (!allowed.has(key)) {
            ourOrders.splice(i, 1);
          }
        }
      }
    }

    const filterTime = Date.now();

    // Early exit after cycle filtering
    if (ourOrders.length === 0) {
      console.log(
        `UndercutCheck: No orders after cycle filter (setup=${setupTime - startTime}ms, fetchOrders=${fetchOrdersTime - setupTime}ms, filter=${filterTime - fetchOrdersTime}ms)`,
      );
      return [];
    }

    // Group our orders by station and type
    const byStationType = new Map<string, Array<(typeof ourOrders)[number]>>();
    for (const o of ourOrders) {
      const key = `${o.location_id}:${o.type_id}`;
      const list = byStationType.get(key) ?? [];
      list.push(o);
      byStationType.set(key, list);
    }

    // Get lowest competitor sells per station/type via regional feed filtered to station
    const results: Array<{
      characterId: number;
      characterName: string;
      stationId: number;
      stationName: string;
      updates: Array<{
        orderId: number;
        typeId: number;
        itemName: string;
        remaining: number;
        currentPrice: number;
        competitorLowest: number;
        suggestedNewPriceTicked: number;
      }>;
    }> = [];

    // Map type id to name for output
    const typeIds = Array.from(new Set(ourOrders.map((o) => o.type_id)));
    const typeNameById = typeIds.length
      ? await this.gameData.getTypeNames(typeIds)
      : new Map<number, string>();

    // For each station/type, check if any of our orders is not the lowest
    const updatesByCharStation = new Map<
      string,
      Array<{
        orderId: number;
        typeId: number;
        itemName: string;
        remaining: number;
        currentPrice: number;
        competitorLowest: number;
        suggestedNewPriceTicked: number;
      }>
    >();

    // Fetch competitor orders in parallel using worker pool
    const entries = Array.from(byStationType.entries());
    let idx = 0;

    const worker = async () => {
      for (;;) {
        const current = idx++;
        if (current >= entries.length) break;

        const [key, orders] = entries[current];
        const [stationIdStr, typeIdStr] = key.split(':');
        const stationId = Number(stationIdStr);
        const typeId = Number(typeIdStr);
        const regionId = regionByStation.get(stationId);
        if (!regionId) continue;

        const stationSells = await fetchStationOrders(this.esi, {
          regionId,
          typeId,
          stationId,
          side: 'sell',
        });
        stationSells.sort((a, b) => a.price - b.price);
        if (!stationSells.length) continue;

        // Compute lowest price that is not one of our orders
        const ourPrices = new Set(orders.map((o) => o.price));
        let competitorLowest: number | null = null;
        for (const s of stationSells) {
          if (!ourPrices.has(s.price)) {
            competitorLowest = s.price;
            break;
          }
        }
        // If competitorLowest is null, we are cheapest (all sells are our prices)
        if (competitorLowest === null) continue;

        for (const o of orders) {
          if (o.price <= competitorLowest) continue; // already cheapest
          const suggested = nextCheaperTick(competitorLowest);
          const itemName = typeNameById.get(o.type_id) ?? String(o.type_id);
          const entry = {
            orderId: o.order_id,
            typeId: o.type_id,
            itemName,
            remaining: o.volume_remain,
            currentPrice: o.price,
            competitorLowest: competitorLowest,
            suggestedNewPriceTicked: suggested,
          };
          const groupKey = `${o.characterId}:${stationId}`;
          const list = updatesByCharStation.get(groupKey) ?? [];
          list.push(entry);
          updatesByCharStation.set(groupKey, list);
        }
      }
    };

    const workerCount = Math.min(8, entries.length);
    const fetchCompetitorsStart = Date.now();
    
    await this.esi.withMaxConcurrency(workerCount * 2, async () => {
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
    });

    const fetchCompetitorsTime = Date.now();

    // Build grouped, sorted output
    for (const [key, updates] of updatesByCharStation) {
      const [charIdStr, stationIdStr] = key.split(':');
      const characterId = Number(charIdStr);
      const stationId = Number(stationIdStr);
      updates.sort((a, b) => a.itemName.localeCompare(b.itemName));
      const characterName =
        characterNameById.get(characterId) ?? String(characterId);
      const stationName = stationNameById.get(stationId) ?? String(stationId);
      results.push({
        characterId,
        characterName,
        stationId,
        stationName,
        updates,
      });
    }

    // Stable order by character then station
    results.sort((a, b) =>
      a.characterId !== b.characterId
        ? a.characterId - b.characterId
        : a.stationId - b.stationId,
    );

    const totalTime = Date.now();
    console.log(
      `UndercutCheck completed: ${results.length} updates across ${byStationType.size} station/type combos | ` +
        `Times: setup=${setupTime - startTime}ms, fetchOrders=${fetchOrdersTime - setupTime}ms, ` +
        `filter=${filterTime - fetchOrdersTime}ms, fetchCompetitors=${fetchCompetitorsTime - fetchCompetitorsStart}ms, ` +
        `total=${totalTime - startTime}ms`,
    );

    return results;
  }

  async sellAppraiseByCommit(params: { cycleId: string }): Promise<
    Array<{
      itemName: string;
      typeId: number;
      quantityRemaining: number;
      destinationStationId: number;
      lowestSell: number | null;
      suggestedSellPriceTicked: number | null;
    }>
  > {
    // Get cycle lines that haven't been listed yet (no currentSellPriceIsk set)
    const lines = await this.cycleLineService.getUnlistedCycleLines(
      params.cycleId,
    );

    // Calculate remaining units (bought - sold, or fall back to planned if nothing bought yet)
    const remainingMap = new Map<string, number>();
    for (const l of lines) {
      const bought = l.unitsBought ?? 0;
      const sold = l.unitsSold ?? 0;
      // If items have been bought, show remaining inventory (bought - sold)
      // Otherwise, show planned units to allow pre-listing price checks
      const remaining =
        bought > 0 ? Math.max(0, bought - sold) : l.plannedUnits;
      if (remaining > 0) {
        const k = `${l.destinationStationId}:${l.typeId}`;
        remainingMap.set(k, (remainingMap.get(k) ?? 0) + remaining);
      }
    }

    const typeIds = Array.from(new Set(lines.map((l) => l.typeId)));
    const typeNameById = typeIds.length
      ? await this.gameData.getTypeNames(typeIds)
      : new Map<number, string>();

    const feeDefaults = AppConfig.arbitrage().fees;

    const out: Array<{
      itemName: string;
      typeId: number;
      quantityRemaining: number;
      destinationStationId: number;
      lowestSell: number | null;
      suggestedSellPriceTicked: number | null;
    }> = [];

    // Resolve regionIds for all destination stations
    const stationIds = Array.from(
      new Set(lines.map((l) => l.destinationStationId)),
    );
    const stationsWithRegions =
      await this.gameData.getStationsWithRegions(stationIds);
    const regionByStation = new Map<number, number>();
    for (const [stationId, data] of stationsWithRegions.entries()) {
      if (data.regionId) {
        regionByStation.set(stationId, data.regionId);
      }
    }

    // Fetch all market data in parallel for speed
    const fetchPromises = lines.map(async (l) => {
      const key = `${l.destinationStationId}:${l.typeId}`;
      const qty = remainingMap.get(key) ?? 0;
      if (qty <= 0) return null;

      const regionId = regionByStation.get(l.destinationStationId);
      let lowest: number | null = null;
      if (regionId) {
        try {
          const orders = await fetchStationOrders(this.esi, {
            regionId,
            typeId: l.typeId,
            stationId: l.destinationStationId,
            side: 'sell',
          });
          orders.sort((a, b) => a.price - b.price);
          lowest = orders.length ? orders[0].price : null;
        } catch {
          lowest = null;
        }
      }
      const suggested = lowest !== null ? nextCheaperTick(lowest) : null;
      return {
        itemName: typeNameById.get(l.typeId) ?? String(l.typeId),
        typeId: l.typeId,
        quantityRemaining: qty,
        destinationStationId: l.destinationStationId,
        lowestSell: lowest,
        suggestedSellPriceTicked: suggested,
      };
    });

    const results = await Promise.all(fetchPromises);
    return results.filter((r) => r !== null) as typeof out;
  }

  async confirmListing(params: {
    lineId: string;
    quantity: number;
    unitPrice: number;
  }) {
    // Compute 1.5% broker fee on total value
    const feePct = AppConfig.arbitrage().fees.brokerFeePercent; // default 1.5
    const total = params.quantity * params.unitPrice;
    const amount = (total * (feePct / 100)).toFixed(2);

    // Add broker fee to cycle line
    await this.feeService.addBrokerFee({
      lineId: params.lineId,
      amountIsk: amount,
    });

    // Save current sell price for estimated profit calculations
    await this.prisma.cycleLine.update({
      where: { id: params.lineId },
      data: { currentSellPriceIsk: params.unitPrice.toFixed(2) },
    });

    return { ok: true, feeAmountISK: amount };
  }

  async confirmReprice(params: {
    lineId: string;
    quantity: number;
    newUnitPrice: number;
  }) {
    // Compute 0.3% broker fee on remaining * newUnitPrice
    const feePct = AppConfig.arbitrage().fees.relistFeePercent;
    const total = params.quantity * params.newUnitPrice;
    const amount = (total * (feePct / 100)).toFixed(2);

    // Add relist fee to cycle line
    await this.feeService.addRelistFee({
      lineId: params.lineId,
      amountIsk: amount,
    });

    // Update current sell price for estimated profit calculations
    await this.prisma.cycleLine.update({
      where: { id: params.lineId },
      data: { currentSellPriceIsk: params.newUnitPrice.toFixed(2) },
    });

    return { ok: true, feeAmountISK: amount };
  }

  private async getOpenCycleIdFor(date: Date): Promise<string> {
    return await this.cycleService.getOpenCycleIdForDate(date);
  }

  async getRemainingLines(cycleId: string) {
    // Get actual remaining units from cycle lines
    const lines =
      await this.cycleLineService.getCycleLinesWithRemaining(cycleId);
    return lines.map((l) => ({
      lineId: l.id,
      typeId: l.typeId,
      destinationStationId: l.destinationStationId,
      remainingUnits: Math.max(0, l.unitsBought - l.unitsSold),
      unitCost: l.unitsBought > 0 ? Number(l.buyCostIsk) / l.unitsBought : 0,
    }));
  }
}
