import { PrismaService } from '@api/prisma/prisma.service';
import { EsiService } from '@api/esi/esi.service';
import { fetchStationOrders } from '@api/esi/market-helpers';

/**
 * Constants for capital and inventory calculations
 */
export const CAPITAL_CONSTANTS = {
  /** Jita 4-4 station ID */
  JITA_STATION_ID: 60003760,
  /** Cash reserve per tracked character (ISK) */
  CASH_RESERVE_PER_CHARACTER_ISK: 100_000_000,
  /** Cache TTL for capital snapshots (1 hour) */
  CACHE_TTL_MS: 60 * 60 * 1000,
  /** Maximum cycle lines to create during rollover */
  MAX_ROLLOVER_LINES: 1000,
  /** Default cycle duration (14 days) */
  DEFAULT_CYCLE_DURATION_MS: 14 * 24 * 60 * 60 * 1000,
  /** Max entries per page */
  MAX_ENTRIES_PER_PAGE: 1000,
  /** Default entries per page */
  DEFAULT_ENTRIES_PER_PAGE: 500,
} as const;

/**
 * Position for weighted-average cost tracking
 */
export type CostBasisPosition = {
  quantity: number;
  totalCost: number;
};

/**
 * Computes weighted-average cost positions by station/type from wallet transactions.
 *
 * Algorithm:
 * - For buys: Add quantity and cost to position
 * - For sells: Reduce quantity and cost proportionally using WAC
 *
 * @param prisma - Prisma client for database access
 * @returns Map of "stationId:typeId" to cost basis positions
 */
export async function computeCostBasisPositions(
  prisma: PrismaService,
): Promise<Map<string, CostBasisPosition>> {
  const byTypeStation = new Map<string, CostBasisPosition>();

  const txs = await prisma.walletTransaction.findMany({
    select: {
      isBuy: true,
      locationId: true,
      typeId: true,
      quantity: true,
      unitPrice: true,
    },
    orderBy: { date: 'asc' },
  });

  const key = (stationId: number, typeId: number) => `${stationId}:${typeId}`;

  for (const t of txs) {
    const stationId = Number(t.locationId);
    if (!Number.isSafeInteger(stationId)) continue;
    const k = key(stationId, t.typeId);
    const pos = byTypeStation.get(k) ?? { quantity: 0, totalCost: 0 };

    if (t.isBuy) {
      // Add to position
      pos.quantity += t.quantity;
      pos.totalCost += Number(t.unitPrice) * t.quantity;
    } else {
      // Reduce position using weighted average cost
      const sellQty = Math.min(pos.quantity, t.quantity);
      if (sellQty > 0 && pos.quantity > 0) {
        const avg = pos.totalCost / pos.quantity;
        pos.quantity -= sellQty;
        pos.totalCost -= avg * sellQty;
      }
    }

    byTypeStation.set(k, pos);
  }

  return byTypeStation;
}

/**
 * Creates a Jita lowest sell price fetcher with caching support.
 *
 * @param esi - ESI service for market data
 * @param jitaRegionId - Jita region ID (cached from GameDataService)
 * @returns Async function that fetches lowest Jita sell price for a type
 */
export function createJitaPriceFetcher(
  esi: EsiService,
  jitaRegionId: number | null,
): (typeId: number) => Promise<number | null> {
  return async (typeId: number): Promise<number | null> => {
    if (!jitaRegionId) return null;

    try {
      const orders = await fetchStationOrders(esi, {
        regionId: jitaRegionId,
        typeId,
        stationId: CAPITAL_CONSTANTS.JITA_STATION_ID,
        side: 'sell',
      });

      // Find lowest sell order
      orders.sort((a, b) => a.price - b.price);
      return orders.length ? orders[0].price : null;
    } catch {
      return null;
    }
  };
}

/**
 * Computes unit value for inventory item using cost basis with Jita fallback.
 *
 * Priority:
 * 1. Cost basis from wallet transactions (WAC)
 * 2. Jita lowest sell price
 *
 * @param key - Station:Type key
 * @param costBasisPositions - Map of cost basis positions
 * @param getJitaPrice - Function to fetch Jita price
 * @returns Unit value in ISK, or null if unavailable
 */
export async function getInventoryUnitValue(
  key: string,
  costBasisPositions: Map<string, CostBasisPosition>,
  getJitaPrice: (typeId: number) => Promise<number | null>,
): Promise<number | null> {
  const pos = costBasisPositions.get(key);

  // Priority 1: Use cost basis if available
  if (pos && pos.quantity > 0) {
    return pos.totalCost / pos.quantity;
  }

  // Priority 2: Fallback to Jita lowest sell
  const [, typeIdStr] = key.split(':');
  const typeId = Number(typeIdStr);
  return await getJitaPrice(typeId);
}
