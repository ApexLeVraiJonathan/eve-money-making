import { Injectable } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { EsiService } from '@api/esi/esi.service';
import { EsiCharactersService } from '@api/esi/esi-characters.service';
import { FeeService } from '@api/tradecraft/cycles/services/fee.service';
import { fetchStationOrders } from '@api/esi/market-helpers';
import { nextCheaperTick } from '@eve/eve-core/money';
import { getEffectiveSell } from '../fees';
import { AppConfig } from '@api/common/config';
import { GameDataService } from '@api/game-data/services/game-data.service';
import { CharacterService } from '@api/characters/services/character.service';
import { MarketDataService } from './market-data.service';
import { CycleLineService } from '@api/tradecraft/cycles/services/cycle-line.service';
import { CycleService } from '@api/tradecraft/cycles/services/cycle.service';

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
    groupingMode?: 'perOrder' | 'perCharacter' | 'global';
    minUndercutVolumeRatio?: number;
    minUndercutUnits?: number;
    expiryRefreshDays?: number;
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
        expiresAt?: string;
        expiresInHours?: number;
        isExpiringSoon?: boolean;
        reasons?: Array<'undercut' | 'expiry' | 'ladder'>;
        estimatedMarginPercentAfter?: number;
        estimatedProfitIskAfter?: number;
        wouldBeLossAfter?: boolean;
      }>;
    }>
  > {
    const startTime = Date.now();

    // Set defaults for new parameters
    const groupingMode = params.groupingMode ?? 'perOrder';
    const minUndercutVolumeRatio = params.minUndercutVolumeRatio ?? 0.15; // 15% default
    const minUndercutUnits = params.minUndercutUnits ?? 1;
    const expiryRefreshDays = params.expiryRefreshDays ?? 2;

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
      volume_total: number;
      location_id: number;
      issued?: string;
      duration?: number;
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
            volume_total: o.volume_total,
            location_id: o.location_id,
            issued: o.issued,
            duration: o.duration,
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
    // Also build a map of cycle lines for profitability computation
    const cycleLineMap = new Map<
      string,
      { unitCost: number; lineId: string }
    >();

    if (params.cycleId) {
      const lines = await this.cycleLineService.getCycleLinesForCycle(
        params.cycleId,
      );

      if (lines.length > 0) {
        // Only check orders for items/stations in the cycle
        const allowed = new Set(
          lines.map((l) => `${l.destinationStationId}:${l.typeId}`),
        );

        // Build profitability lookup map
        for (const l of lines) {
          const unitCost =
            l.unitsBought > 0 ? Number(l.buyCostIsk) / l.unitsBought : 0;
          const key = `${l.destinationStationId}:${l.typeId}`;
          cycleLineMap.set(key, { unitCost, lineId: l.id });
        }

        // Restrict orders to the cycle scope
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

    // Output containers
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
        expiresAt?: string;
        expiresInHours?: number;
        isExpiringSoon?: boolean;
        reasons?: Array<'undercut' | 'expiry' | 'ladder'>;
        estimatedMarginPercentAfter?: number;
        estimatedProfitIskAfter?: number;
        wouldBeLossAfter?: boolean;
      }>;
    }> = [];

    // Map type id to name for output
    const typeIds = Array.from(new Set(ourOrders.map((o) => o.type_id)));
    const typeNameById = typeIds.length
      ? await this.gameData.getTypeNames(typeIds)
      : new Map<number, string>();

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
        expiresAt?: string;
        expiresInHours?: number;
        isExpiringSoon?: boolean;
        reasons?: Array<'undercut' | 'expiry' | 'ladder'>;
        estimatedMarginPercentAfter?: number;
        estimatedProfitIskAfter?: number;
        wouldBeLossAfter?: boolean;
      }>
    >();

    const nowMs = Date.now();
    const MS_PER_HOUR = 60 * 60 * 1000;
    const MS_PER_DAY = 24 * MS_PER_HOUR;

    const computeExpiryMeta = (o: (typeof ourOrders)[number]) => {
      if (!o.issued || !o.duration || o.duration <= 0) return null;
      const issuedMs = Date.parse(o.issued);
      if (!Number.isFinite(issuedMs)) return null;
      const expiresAtMs = issuedMs + o.duration * MS_PER_DAY;
      const expiresInMs = expiresAtMs - nowMs;
      const expiresInHours = expiresInMs / MS_PER_HOUR;
      const isExpiringSoon =
        expiryRefreshDays > 0 && expiresInMs <= expiryRefreshDays * MS_PER_DAY;
      return {
        expiresAt: new Date(expiresAtMs).toISOString(),
        expiresInHours,
        isExpiringSoon,
      };
    };

    const findTargetCompetitorPrice = (params2: {
      stationSells: Array<{ price: number; volume: number }>;
      ourPrices: Set<number>;
      ourPrice: number;
      volumeTotal: number;
    }): number | null => {
      const volumeThreshold = Math.max(
        minUndercutVolumeRatio * params2.volumeTotal,
        minUndercutUnits,
      );

      let cumulativeCompetitorVolume = 0;
      for (const s of params2.stationSells) {
        if (s.price >= params2.ourPrice) break;
        if (params2.ourPrices.has(s.price)) continue;
        cumulativeCompetitorVolume += s.volume;
        if (cumulativeCompetitorVolume >= volumeThreshold) return s.price;
      }
      return null;
    };

    const computeProfitability = (params2: {
      stationId: number;
      typeId: number;
      remaining: number;
      suggestedPrice: number;
    }): {
      estimatedMarginPercentAfter?: number;
      estimatedProfitIskAfter?: number;
      wouldBeLossAfter?: boolean;
    } => {
      const lineKey = `${params2.stationId}:${params2.typeId}`;
      const lineData = cycleLineMap.get(lineKey);
      if (!lineData || lineData.unitCost <= 0) return {};
      const feeDefaults = AppConfig.arbitrage().fees;
      const effectiveSellPrice = getEffectiveSell(
        params2.suggestedPrice,
        feeDefaults,
      );
      const profitPerUnit = effectiveSellPrice - lineData.unitCost;
      return {
        estimatedMarginPercentAfter: (profitPerUnit / lineData.unitCost) * 100,
        estimatedProfitIskAfter: profitPerUnit * params2.remaining,
        wouldBeLossAfter: profitPerUnit < 0,
      };
    };

    // Fetch competitor orders in parallel using worker pool and cache by station/type
    const stationTypeEntries = Array.from(byStationType.entries());
    const stationSellsByKey = new Map<
      string,
      Array<{ price: number; volume: number }>
    >();
    let fetchIdx = 0;

    const worker = async () => {
      for (;;) {
        const current = fetchIdx++;
        if (current >= stationTypeEntries.length) break;
        const [key] = stationTypeEntries[current];
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
        stationSellsByKey.set(key, stationSells);
      }
    };

    const workerCount = Math.min(8, stationTypeEntries.length);
    const fetchCompetitorsStart = Date.now();

    await this.esi.withMaxConcurrency(workerCount * 2, async () => {
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
    });

    const fetchCompetitorsTime = Date.now();

    // Bulk daily volume lookup (latest scanned day)
    const pairs = Array.from(byStationType.keys()).map((k) => {
      const [stationIdStr, typeIdStr] = k.split(':');
      return { locationId: Number(stationIdStr), typeId: Number(typeIdStr) };
    });
    const latestTradeByKey = await this.marketData.getLatestMarketTradesForPairs(
      pairs,
    );

    const pushUpdate = (params2: {
      order: (typeof ourOrders)[number];
      stationId: number;
      typeId: number;
      itemName: string;
      competitorLowest: number;
      suggestedNewPriceTicked: number;
      reasons: Array<'undercut' | 'expiry' | 'ladder'>;
      expiryMeta: ReturnType<typeof computeExpiryMeta> | null;
    }) => {
      const profit = computeProfitability({
        stationId: params2.stationId,
        typeId: params2.typeId,
        remaining: params2.order.volume_remain,
        suggestedPrice: params2.suggestedNewPriceTicked,
      });

      const entry = {
        orderId: params2.order.order_id,
        typeId: params2.typeId,
        itemName: params2.itemName,
        remaining: params2.order.volume_remain,
        currentPrice: params2.order.price,
        competitorLowest: params2.competitorLowest,
        suggestedNewPriceTicked: params2.suggestedNewPriceTicked,
        expiresAt: params2.expiryMeta?.expiresAt,
        expiresInHours: params2.expiryMeta?.expiresInHours,
        isExpiringSoon: params2.expiryMeta?.isExpiringSoon,
        reasons: params2.reasons,
        ...profit,
      };

      const groupKey = `${params2.order.characterId}:${params2.stationId}`;
      const list = updatesByCharStation.get(groupKey) ?? [];
      list.push(entry);
      updatesByCharStation.set(groupKey, list);
    };

    const evaluateOrderForUpdate = (params2: {
      order: (typeof ourOrders)[number];
      stationId: number;
      typeId: number;
      stationSells: Array<{ price: number; volume: number }> | undefined;
      ourPrices: Set<number>;
    }): {
      targetCompetitorPrice: number | null;
      suggestedPrice: number | null;
      reasons: Array<'undercut' | 'expiry'>;
      expiryMeta: ReturnType<typeof computeExpiryMeta> | null;
    } => {
      const expiryMeta = computeExpiryMeta(params2.order);
      const reasons: Array<'undercut' | 'expiry'> = [];

      let targetCompetitorPrice: number | null = null;
      let suggestedPrice: number | null = null;

      if (params2.stationSells?.length) {
        targetCompetitorPrice = findTargetCompetitorPrice({
          stationSells: params2.stationSells,
          ourPrices: params2.ourPrices,
          ourPrice: params2.order.price,
          volumeTotal: params2.order.volume_total,
        });
        if (targetCompetitorPrice !== null && params2.order.price > targetCompetitorPrice) {
          const suggested = nextCheaperTick(targetCompetitorPrice);
          if (suggested > 0) {
            suggestedPrice = suggested;
            reasons.push('undercut');
          }
        }
      }

      // Expiry refresh trigger (low-impact: 1 tick cheaper than our current)
      if (
        expiryMeta?.isExpiringSoon &&
        (suggestedPrice === null || suggestedPrice <= 0)
      ) {
        const refresh = nextCheaperTick(params2.order.price);
        if (refresh > 0 && refresh !== params2.order.price) {
          suggestedPrice = refresh;
          reasons.push('expiry');
          targetCompetitorPrice ??= params2.order.price;
        }
      }

      return { targetCompetitorPrice, suggestedPrice, reasons, expiryMeta };
    };

    if (groupingMode === 'perOrder') {
      for (const o of ourOrders) {
        const stationId = o.location_id;
        const typeId = o.type_id;
        const stationTypeKey = `${stationId}:${typeId}`;
        const stationSells = stationSellsByKey.get(stationTypeKey);
        const ourPrices = new Set(
          (byStationType.get(stationTypeKey) ?? []).map((x) => x.price),
        );
        const itemName = typeNameById.get(typeId) ?? String(typeId);

        const evalRes = evaluateOrderForUpdate({
          order: o,
          stationId,
          typeId,
          stationSells,
          ourPrices,
        });
        if (!evalRes.suggestedPrice) continue;
        pushUpdate({
          order: o,
          stationId,
          typeId,
          itemName,
          competitorLowest: evalRes.targetCompetitorPrice ?? o.price,
          suggestedNewPriceTicked: evalRes.suggestedPrice,
          reasons: evalRes.reasons,
          expiryMeta: evalRes.expiryMeta,
        });
      }
    } else {
      // perCharacter / global: encourage consolidation by focusing on lowest-remaining orders
      const groupMap = new Map<string, Array<(typeof ourOrders)[number]>>();
      for (const o of ourOrders) {
        const groupKey =
          groupingMode === 'perCharacter'
            ? `${o.characterId}:${o.location_id}:${o.type_id}`
            : `${o.location_id}:${o.type_id}`;
        const list = groupMap.get(groupKey) ?? [];
        list.push(o);
        groupMap.set(groupKey, list);
      }

      for (const orders of groupMap.values()) {
        orders.sort((a, b) => a.volume_remain - b.volume_remain);
        const first = orders[0];
        const second = orders[1];
        const stationId = first.location_id;
        const typeId = first.type_id;
        const stationTypeKey = `${stationId}:${typeId}`;
        const stationSells = stationSellsByKey.get(stationTypeKey);
        const ourPrices = new Set(
          (byStationType.get(stationTypeKey) ?? []).map((x) => x.price),
        );
        const itemName = typeNameById.get(typeId) ?? String(typeId);

        const firstEval = evaluateOrderForUpdate({
          order: first,
          stationId,
          typeId,
          stationSells,
          ourPrices,
        });
        if (!firstEval.suggestedPrice) continue;

        const dailyKey = `${stationId}:${typeId}`;
        const dailyUnitsSold = latestTradeByKey.get(dailyKey)?.amount ?? 0;
        const shouldLadderSecond =
          !!second && dailyUnitsSold > first.volume_remain;

        if (shouldLadderSecond) {
          const baseHigh =
            firstEval.targetCompetitorPrice !== null &&
            firstEval.reasons.includes('undercut')
              ? nextCheaperTick(firstEval.targetCompetitorPrice)
              : nextCheaperTick(first.price);
          const baseLow = nextCheaperTick(baseHigh);

          pushUpdate({
            order: first,
            stationId,
            typeId,
            itemName,
            competitorLowest: firstEval.targetCompetitorPrice ?? first.price,
            suggestedNewPriceTicked:
              baseLow > 0 ? baseLow : firstEval.suggestedPrice,
            reasons: Array.from(new Set([...firstEval.reasons, 'ladder'])),
            expiryMeta: firstEval.expiryMeta,
          });

          pushUpdate({
            order: second!,
            stationId,
            typeId,
            itemName,
            competitorLowest: firstEval.targetCompetitorPrice ?? second!.price,
            suggestedNewPriceTicked:
              baseHigh > 0 ? baseHigh : nextCheaperTick(second!.price),
            reasons: ['ladder'],
            expiryMeta: computeExpiryMeta(second!),
          });
        } else {
          pushUpdate({
            order: first,
            stationId,
            typeId,
            itemName,
            competitorLowest: firstEval.targetCompetitorPrice ?? first.price,
            suggestedNewPriceTicked: firstEval.suggestedPrice,
            reasons: firstEval.reasons,
            expiryMeta: firstEval.expiryMeta,
          });
        }
      }
    }

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

    results.sort((a, b) =>
      a.characterId !== b.characterId
        ? a.characterId - b.characterId
        : a.stationId - b.stationId,
    );

    const totalTime = Date.now();
    console.log(
      `UndercutCheck completed (mode=${groupingMode}): ${results.length} groups | ` +
        `Times: setup=${setupTime - startTime}ms, fetchOrders=${fetchOrdersTime - setupTime}ms, ` +
        `filter=${filterTime - fetchOrdersTime}ms, fetchCompetitors=${fetchCompetitorsTime - fetchCompetitorsStart}ms, ` +
        `total=${totalTime - startTime}ms | station/type=${byStationType.size}, orders=${ourOrders.length}`,
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
    // Get cycle lines with unlisted units (using new quantity-based logic)
    const lines = await this.cycleLineService.getUnlistedCycleLines(
      params.cycleId,
    );

    // Calculate unlisted units per line and aggregate by type+destination
    // unlistedUnits = unitsBought - listedUnits (listedUnits is cumulative)
    const unlistedMap = new Map<string, number>();
    for (const l of lines) {
      const bought = l.unitsBought ?? 0;
      const unlistedUnits = Math.max(0, bought - l.listedUnits);

      if (unlistedUnits > 0) {
        const k = `${l.destinationStationId}:${l.typeId}`;
        unlistedMap.set(k, (unlistedMap.get(k) ?? 0) + unlistedUnits);
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
      const qty = unlistedMap.get(key) ?? 0;
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
    // Compute 1.5% broker fee on total value (based on quantity being listed now)
    const feePct = AppConfig.arbitrage().fees.brokerFeePercent; // default 1.5
    const total = params.quantity * params.unitPrice;
    const amount = (total * (feePct / 100)).toFixed(2);

    // Add broker fee to cycle line
    await this.feeService.addBrokerFee({
      lineId: params.lineId,
      amountIsk: amount,
    });

    // Update current sell price and increment listedUnits by the quantity being listed
    await this.prisma.cycleLine.update({
      where: { id: params.lineId },
      data: {
        currentSellPriceIsk: params.unitPrice.toFixed(2),
        listedUnits: { increment: params.quantity },
      },
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
