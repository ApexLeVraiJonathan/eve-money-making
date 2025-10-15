import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EsiService } from '../esi/esi.service';
import { EsiCharactersService } from '../esi/esi-characters.service';
import { LedgerService } from '../ledger/ledger.service';
import { fetchStationOrders } from '../esi/market-helpers';
import { nextCheaperTick } from '../common/money';
import { getEffectiveSell } from '../arbitrage/fees';
import { AppConfig } from '../common/config';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly esi: EsiService,
    private readonly esiChars: EsiCharactersService,
    private readonly ledger: LedgerService,
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
    const map = new Map<string, number>();
    if (!names.length) return map;
    // First, try exact matches in a single query
    const rows = await this.prisma.typeId.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true },
    });
    for (const r of rows) map.set(r.name, r.id);

    // For any names not found, try case-insensitive lookup one by one
    const missing = names.filter((n) => !map.has(n));
    for (const n of missing) {
      const r = await this.prisma.typeId.findFirst({
        where: { name: { equals: n, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (r) map.set(n, r.id);
    }
    return map;
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
    const station = await this.prisma.stationId.findUnique({
      where: { id: params.destinationStationId },
      select: { solarSystemId: true },
    });
    if (!station)
      return parsed.map((p) => ({
        itemName: p.name,
        quantity: p.qty,
        destinationStationId: params.destinationStationId,
        lowestSell: null,
        suggestedSellPriceTicked: null,
      }));
    const system = await this.prisma.solarSystemId.findUnique({
      where: { id: station.solarSystemId },
      select: { regionId: true },
    });
    const regionId = system?.regionId ?? null;

    const results: Array<{
      itemName: string;
      quantity: number;
      destinationStationId: number;
      lowestSell: number | null;
      suggestedSellPriceTicked: number | null;
    }> = [];

    for (const p of parsed) {
      const typeId = nameToType.get(p.name);
      if (!typeId || !regionId) {
        results.push({
          itemName: p.name,
          quantity: p.qty,
          destinationStationId: params.destinationStationId,
          lowestSell: null,
          suggestedSellPriceTicked: null,
        });
        continue;
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
        const latest = await this.prisma.marketOrderTradeDaily.findFirst({
          where: {
            locationId: params.destinationStationId,
            typeId,
            isBuyOrder: false,
          },
          orderBy: { scanDate: 'desc' },
          select: { high: true },
        });
        if (latest?.high) lowest = Number(latest.high);
      }

      const suggested =
        lowest !== null
          ? nextCheaperTick(
              getEffectiveSell(lowest, {
                salesTaxPercent: 0,
                brokerFeePercent: 0,
              }),
            )
          : null;

      results.push({
        itemName: p.name,
        quantity: p.qty,
        destinationStationId: params.destinationStationId,
        lowestSell: lowest,
        suggestedSellPriceTicked: suggested,
      });
    }

    return results;
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
        itemName: string;
        remaining: number;
        currentPrice: number;
        competitorLowest: number;
        suggestedNewPriceTicked: number;
      }>;
    }>
  > {
    // Determine characters to check - default to logistics sellers
    const characters = await this.prisma.eveCharacter.findMany({
      where: params.characterIds?.length
        ? {
            id: { in: params.characterIds },
            role: 'LOGISTICS',
            function: 'SELLER',
          }
        : { role: 'LOGISTICS', function: 'SELLER' },
      select: { id: true, name: true },
    });

    const characterNameById = new Map<number, string>();
    for (const c of characters) characterNameById.set(c.id, c.name);

    // Stations default to tracked stations
    const stationIds: number[] = params.stationIds?.length
      ? params.stationIds
      : (
          await this.prisma.trackedStation.findMany({
            select: { stationId: true },
          })
        ).map((t) => t.stationId);

    // Preload region per station
    const stationRows = await this.prisma.stationId.findMany({
      where: { id: { in: stationIds } },
      select: { id: true, solarSystemId: true, name: true },
    });
    const systemIds = Array.from(
      new Set(stationRows.map((s) => s.solarSystemId)),
    );
    const systems = await this.prisma.solarSystemId.findMany({
      where: { id: { in: systemIds } },
      select: { id: true, regionId: true },
    });
    const regionBySystem = new Map<number, number>();
    for (const sys of systems) regionBySystem.set(sys.id, sys.regionId);
    const regionByStation = new Map<number, number>();
    for (const s of stationRows)
      regionByStation.set(s.id, regionBySystem.get(s.solarSystemId)!);

    const stationNameById = new Map<number, string>();
    for (const s of stationRows) stationNameById.set(s.id, s.name);

    // Collect our own active sell orders per station and per type
    const ourOrders: Array<{
      characterId: number;
      order_id: number;
      type_id: number;
      price: number;
      volume_remain: number;
      location_id: number;
      issued?: string;
    }> = [];
    for (const c of characters) {
      const orders = await this.esiChars.getOrders(c.id);
      for (const o of orders) {
        if (o.is_buy_order) continue;
        if (!stationIds.includes(o.location_id)) continue;
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
    }

    // Optional: filter orders to those belonging to a specific cycle scope
    if (params.cycleId) {
      const lines = await this.prisma.cycleLine.findMany({
        where: { cycleId: params.cycleId },
        select: { typeId: true, destinationStationId: true },
      });

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
        itemName: string;
        remaining: number;
        currentPrice: number;
        competitorLowest: number;
        suggestedNewPriceTicked: number;
      }>;
    }> = [];

    // Map type id to name for output
    const typeIds = Array.from(new Set(ourOrders.map((o) => o.type_id)));
    const typeRows = typeIds.length
      ? await this.prisma.typeId.findMany({
          where: { id: { in: typeIds } },
          select: { id: true, name: true },
        })
      : [];
    const typeNameById = new Map<number, string>();
    for (const t of typeRows) typeNameById.set(t.id, t.name);

    // For each station/type, check if any of our orders is not the lowest
    const updatesByCharStation = new Map<
      string,
      Array<{
        orderId: number;
        itemName: string;
        remaining: number;
        currentPrice: number;
        competitorLowest: number;
        suggestedNewPriceTicked: number;
      }>
    >();

    for (const [key, orders] of byStationType) {
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
    // Get cycle lines
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId: params.cycleId },
      select: {
        typeId: true,
        destinationStationId: true,
        plannedUnits: true,
        unitsBought: true,
        unitsSold: true,
      },
    });

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
    const typeRows = typeIds.length
      ? await this.prisma.typeId.findMany({
          where: { id: { in: typeIds } },
          select: { id: true, name: true },
        })
      : [];
    const typeNameById = new Map<number, string>();
    for (const t of typeRows) typeNameById.set(t.id, t.name);

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
    const stations = await this.prisma.stationId.findMany({
      where: { id: { in: stationIds } },
      select: { id: true, solarSystemId: true },
    });
    const systems = await this.prisma.solarSystemId.findMany({
      where: {
        id: { in: Array.from(new Set(stations.map((s) => s.solarSystemId))) },
      },
      select: { id: true, regionId: true },
    });
    const regionBySystem = new Map<number, number>();
    for (const sys of systems) regionBySystem.set(sys.id, sys.regionId);
    const regionByStation = new Map<number, number>();
    for (const s of stations)
      regionByStation.set(s.id, regionBySystem.get(s.solarSystemId)!);

    for (const l of lines) {
      const key = `${l.destinationStationId}:${l.typeId}`;
      const qty = remainingMap.get(key) ?? 0;
      if (qty <= 0) continue;
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
      const suggested =
        lowest !== null
          ? nextCheaperTick(
              getEffectiveSell(lowest, {
                salesTaxPercent: feeDefaults.salesTaxPercent,
                brokerFeePercent: 0,
              }),
            )
          : null;
      out.push({
        itemName: typeNameById.get(l.typeId) ?? String(l.typeId),
        typeId: l.typeId,
        quantityRemaining: qty,
        destinationStationId: l.destinationStationId,
        lowestSell: lowest,
        suggestedSellPriceTicked: suggested,
      });
    }

    return out;
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
    await this.ledger.addBrokerFee({
      lineId: params.lineId,
      amountIsk: amount,
    });

    return { ok: true, feeAmountISK: amount };
  }

  async confirmReprice(params: {
    lineId: string;
    quantity: number;
    newUnitPrice: number;
  }) {
    // Compute 0.3% broker fee on remaining * newUnitPrice
    const feePct = Number(process.env.DEFAULT_RELIST_FEE_PCT ?? 0.3);
    const total = params.quantity * params.newUnitPrice;
    const amount = (total * (feePct / 100)).toFixed(2);

    // Add relist fee to cycle line
    await this.ledger.addRelistFee({
      lineId: params.lineId,
      amountIsk: amount,
    });

    return { ok: true, feeAmountISK: amount };
  }

  private async getOpenCycleIdFor(date: Date): Promise<string> {
    const cycle = await this.prisma.cycle.findFirst({
      where: {
        startedAt: { lte: date },
        OR: [{ closedAt: null }, { closedAt: { gte: date } }],
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    if (!cycle) {
      const latest = await this.prisma.cycle.findFirst({
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      });
      if (!latest) throw new Error('No cycle found. Create a Cycle first.');
      return latest.id;
    }
    return cycle.id;
  }

  async getRemainingLines(cycleId: string) {
    // Get actual remaining units from cycle lines
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
    return lines.map((l) => ({
      lineId: l.id,
      typeId: l.typeId,
      destinationStationId: l.destinationStationId,
      remainingUnits: Math.max(0, l.unitsBought - l.unitsSold),
      unitCost: l.unitsBought > 0 ? Number(l.buyCostIsk) / l.unitsBought : 0,
    }));
  }
}
