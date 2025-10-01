import { EsiService } from './esi.service';

/**
 * Paged fetch of regional market orders for a specific type and order side,
 * returning only the rows at the given station (location_id).
 *
 * Learning notes:
 * - We use preferHeaders=true to obtain X-Pages even when content is cached (304).
 * - We short-circuit if a page returns empty; still stop when we've reached X-Pages.
 */
export async function fetchStationOrders(
  esi: EsiService,
  params: {
    regionId: number;
    typeId: number;
    stationId: number;
    side: 'buy' | 'sell';
  },
): Promise<Array<{ price: number; volume: number }>> {
  let page = 1;
  let totalPages: number | null = null;
  const out: Array<{ price: number; volume: number }> = [];
  for (;;) {
    const { data, meta } = await esi.fetchJson<
      Array<{
        order_id: number;
        type_id: number;
        is_buy_order: boolean;
        price: number;
        volume_remain: number;
        location_id: number;
      }>
    >(`/latest/markets/${params.regionId}/orders/`, {
      query: { order_type: params.side, type_id: params.typeId, page },
      preferHeaders: true,
    });
    if (meta?.headers && typeof meta.headers['x-pages'] === 'string') {
      const xp = Number(meta.headers['x-pages']);
      if (!Number.isNaN(xp) && xp > 0) totalPages = xp;
    }
    if (!Array.isArray(data) || data.length === 0) break;
    for (const o of data) {
      const isSell = !o.is_buy_order;
      if (
        o.location_id === params.stationId &&
        ((params.side === 'sell' && isSell) ||
          (params.side === 'buy' && !isSell)) &&
        o.volume_remain > 0
      ) {
        out.push({ price: o.price, volume: o.volume_remain });
      }
    }
    if (totalPages !== null && page >= totalPages) break;
    page++;
  }
  return out;
}
