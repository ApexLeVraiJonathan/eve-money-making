import { Injectable } from '@nestjs/common';
import { EsiService } from '@api/esi/esi.service';
import { GameDataService } from '@api/game-data/services/game-data.service';
import { fetchStationOrders } from '@api/esi/market-helpers';
import { AppConfig } from '@api/common/config';
import type {
  SkillFarmMarketPriceEntry,
  SkillFarmMarketPriceKey,
  SkillFarmMarketPricesSnapshot,
} from '@eve/api-contracts';

const SKILL_FARM_PRICE_ITEMS: Array<{
  key: SkillFarmMarketPriceKey;
  name: string;
  fallbackTypeId: number;
  mode: 'MARKET_AVERAGE' | 'STATION_LOWEST_SELL';
}> = [
  // NOTE: ESI does not reliably return PLEX market orders via /markets/{region}/orders.
  // Use the global ESI average price as a best-effort default (still overrideable in UI).
  {
    key: 'PLEX',
    name: 'PLEX (ESI avg)',
    fallbackTypeId: 44992,
    mode: 'MARKET_AVERAGE',
  },
  {
    key: 'EXTRACTOR',
    name: 'Skill Extractor',
    fallbackTypeId: 40519,
    mode: 'STATION_LOWEST_SELL',
  },
  {
    key: 'INJECTOR',
    name: 'Large Skill Injector',
    fallbackTypeId: 40520,
    mode: 'STATION_LOWEST_SELL',
  },
];

@Injectable()
export class SkillFarmMarketPricesService {
  constructor(
    private readonly esi: EsiService,
    private readonly gameData: GameDataService,
  ) {}

  /**
   * For some high-volume items (notably PLEX), the lowest sell orders are often
   * on public structures (Perimeter) rather than the default NPC station hub.
   *
   * Our station-filtered fetch would miss those because location_id != stationId.
   * To keep the UI helpful, we fall back to a region-wide lowest-sell sample
   * (page 1) when station-only yields nothing.
   */
  private async fetchRegionLowestSellSample(params: {
    regionId: number;
    typeId: number;
  }): Promise<number | null> {
    const { data } = await this.esi.fetchPaged<
      Array<{
        is_buy_order: boolean;
        price: number;
        volume_remain: number;
      }>
    >(`/latest/markets/${params.regionId}/orders/`, {
      page: 1,
      query: { order_type: 'sell', type_id: params.typeId },
    });

    if (!Array.isArray(data) || data.length === 0) return null;
    let best: number | null = null;
    for (const o of data) {
      if (o.is_buy_order) continue;
      if (!Number.isFinite(o.price) || o.price <= 0) continue;
      if (!Number.isFinite(o.volume_remain) || o.volume_remain <= 0) continue;
      best = best === null ? o.price : Math.min(best, o.price);
    }
    return best;
  }

  private async fetchMarketAveragePrice(params: {
    typeId: number;
  }): Promise<number | null> {
    const { data } = await this.esi.fetchJson<
      Array<{
        type_id: number;
        average_price?: number;
        adjusted_price?: number;
      }>
    >('/latest/markets/prices/');
    if (!Array.isArray(data) || data.length === 0) return null;
    const row = data.find((x) => x.type_id === params.typeId);
    const avg = row?.average_price;
    if (typeof avg === 'number' && Number.isFinite(avg) && avg > 0) return avg;
    const adj = row?.adjusted_price;
    if (typeof adj === 'number' && Number.isFinite(adj) && adj > 0) return adj;
    return null;
  }

  async getSnapshot(params?: {
    stationId?: number;
  }): Promise<SkillFarmMarketPricesSnapshot> {
    const stationId =
      params?.stationId ?? AppConfig.arbitrage().sourceStationId; // Jita IV-4 default
    const regionId = await this.gameData.getStationRegion(stationId);

    const nameToTypeId = await this.gameData.resolveTypeIdsByNames(
      SKILL_FARM_PRICE_ITEMS.map((x) => x.name),
    );

    const items = await Promise.all(
      SKILL_FARM_PRICE_ITEMS.map(async (x) => {
        const typeId = nameToTypeId.get(x.name) ?? x.fallbackTypeId ?? null;
        if (!regionId || !typeId) {
          return {
            key: x.key,
            itemName: x.name,
            typeId,
            lowestSell: null,
          } satisfies SkillFarmMarketPriceEntry;
        }

        try {
          let lowestSell: number | null = null;
          if (x.mode === 'MARKET_AVERAGE') {
            lowestSell = await this.fetchMarketAveragePrice({ typeId });
          } else {
            const sells = await fetchStationOrders(this.esi, {
              regionId,
              typeId,
              stationId,
              side: 'sell',
            });
            sells.sort((a, b) => a.price - b.price);
            lowestSell = sells.length ? sells[0].price : null;
          }
          return {
            key: x.key,
            itemName: x.name,
            typeId,
            lowestSell,
          } satisfies SkillFarmMarketPriceEntry;
        } catch {
          return {
            key: x.key,
            itemName: x.name,
            typeId,
            lowestSell: null,
          } satisfies SkillFarmMarketPriceEntry;
        }
      }),
    );

    return {
      stationId,
      regionId: regionId ?? null,
      fetchedAt: new Date().toISOString(),
      items,
    };
  }
}
