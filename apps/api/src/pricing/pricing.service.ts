import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EsiService } from '../esi/esi.service';
import { EsiCharactersService } from '../esi/esi-characters.service';
import { fetchStationOrders } from '../esi/market-helpers';
import { nextCheaperTick } from '../common/money';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly esi: EsiService,
    private readonly esiChars: EsiCharactersService,
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

      const suggested = lowest !== null ? nextCheaperTick(lowest) : null;

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
  }): Promise<
    Array<{
      characterId: number;
      stationId: number;
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
    // Determine characters to check
    const characters: Array<{ id: number }> = params.characterIds?.length
      ? await this.prisma.eveCharacter.findMany({
          where: { id: { in: params.characterIds } },
          select: { id: true },
        })
      : await this.prisma.eveCharacter.findMany({ select: { id: true } });

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
      select: { id: true, solarSystemId: true },
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

    // Collect our own active sell orders per station and per type
    const ourOrders: Array<{
      characterId: number;
      order_id: number;
      type_id: number;
      price: number;
      volume_remain: number;
      location_id: number;
    }> = [];
    for (const c of characters) {
      const orders = await this.esiChars.getOrders(c.id);
      for (const o of orders) {
        if (!o.is_buy_order && stationIds.includes(o.location_id)) {
          ourOrders.push({
            characterId: c.id,
            order_id: o.order_id,
            type_id: o.type_id,
            price: o.price,
            volume_remain: o.volume_remain,
            location_id: o.location_id,
          });
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
      stationId: number;
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
      results.push({ characterId, stationId, updates });
    }

    // Stable order by character then station
    results.sort((a, b) =>
      a.characterId !== b.characterId
        ? a.characterId - b.characterId
        : a.stationId - b.stationId,
    );
    return results;
  }
}
