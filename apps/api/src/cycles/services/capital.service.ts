import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EsiCharactersService } from '../../esi/esi-characters.service';
import { EsiService } from '../../esi/esi.service';
import { GameDataService } from '../../game-data/services/game-data.service';
import { CharacterService } from '../../characters/services/character.service';
import {
  CAPITAL_CONSTANTS,
  computeCostBasisPositions,
  createJitaPriceFetcher,
  getInventoryUnitValue,
} from '../utils/capital-helpers';

type CapitalResponse = {
  cycleId: string;
  asOf: string;
  capital: {
    total: string;
    cash: string;
    inventory: string;
    percentSplit: { cash: number; inventory: number };
  };
  initialInvestment: string | null;
  inventoryBreakdown: Array<{
    stationId: number;
    stationName: string;
    value: string;
  }>;
  notes: string[];
};

/**
 * CapitalService handles capital and NAV (Net Asset Value) computations.
 *
 * Responsibilities:
 * - Compute current capital (cash + inventory)
 * - Calculate NAV from ledger entries
 * - Generate detailed capital snapshots with station breakdowns
 * - Cache capital computations with 1-hour TTL
 *
 * Valuation Strategy:
 * 1. Inventory: Cost basis (WAC) from transactions, fallback to Jita lowest sell
 * 2. Cash: Character wallets minus base reserve
 */
@Injectable()
export class CapitalService {
  private readonly logger = new Logger(CapitalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly esiChars: EsiCharactersService,
    private readonly esi: EsiService,
    private readonly gameData: GameDataService,
    private readonly characterService: CharacterService,
  ) {}

  /**
   * Compute current capital (cash + inventory value).
   *
   * Process:
   * 1. Sum wallet balances from tracked characters
   * 2. Subtract cash reserve (100M ISK per character)
   * 3. Compute inventory value using cost basis + Jita fallback
   *
   * @returns Cash and inventory values in ISK
   */
  async computeCurrentCapitalNow(): Promise<{
    cash: number;
    inventory: number;
  }> {
    // 1) Cash from tracked characters minus base reserve
    let cashSum = 0;
    const tracked = await this.characterService.getTrackedSellerIds();
    for (const cid of tracked) {
      try {
        const bal = await this.esiChars.getWallet(cid);
        cashSum += bal;
      } catch (e) {
        this.logger.warn(`Wallet fetch failed for ${cid}: ${String(e)}`);
      }
    }
    const reserve =
      CAPITAL_CONSTANTS.CASH_RESERVE_PER_CHARACTER_ISK * tracked.length;
    const cash = Math.max(0, cashSum - reserve);

    // 2) Compute weighted-average cost positions from transactions
    const byTypeStation = await computeCostBasisPositions(this.prisma);
    const key = (stationId: number, typeId: number) => `${stationId}:${typeId}`;

    // 3) Merge quantities from active sell orders and assets
    const qtyByTypeStation = new Map<string, number>();

    // Assets (items not on market)
    for (const cid of tracked) {
      try {
        const assets = await this.esiChars.getAssetsAll(cid);
        for (const a of assets) {
          const k2 = key(a.location_id, a.type_id);
          qtyByTypeStation.set(
            k2,
            (qtyByTypeStation.get(k2) ?? 0) + a.quantity,
          );
        }
      } catch (e) {
        this.logger.warn(`Assets fetch failed for ${cid}: ${String(e)}`);
      }
    }

    // Active sell orders (on market)
    for (const cid of tracked) {
      try {
        const orders = await this.esiChars.getOrdersAll(cid);
        for (const o of orders) {
          if (!o.is_buy_order) {
            const k2 = key(o.location_id, o.type_id);
            qtyByTypeStation.set(
              k2,
              (qtyByTypeStation.get(k2) ?? 0) + o.volume_remain,
            );
          }
        }
      } catch (e) {
        this.logger.warn(`Orders fetch failed for ${cid}: ${String(e)}`);
      }
    }

    // 4) Setup Jita price fallback
    const jitaRegionId = await this.gameData.getJitaRegionId();
    const getJitaPrice = createJitaPriceFetcher(this.esi, jitaRegionId);

    // 5) Value inventory using cost basis with Jita fallback
    let inventoryTotal = 0;
    for (const [k2, qty] of qtyByTypeStation) {
      const unitValue = await getInventoryUnitValue(
        k2,
        byTypeStation,
        getJitaPrice,
      );
      if (!unitValue) continue;
      inventoryTotal += unitValue * qty;
    }

    return { cash, inventory: inventoryTotal };
  }

  /**
   * Compute NAV (Net Asset Value) totals from ledger entries
   */
  async computeNav(cycleId: string): Promise<{
    deposits: string;
    withdrawals: string;
    fees: string;
    executions: string;
    net: string;
  }> {
    const entries = await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
    });

    let deposits = 0;
    let withdrawals = 0;
    let fees = 0;
    let executions = 0;

    for (const e of entries) {
      const amt = Number(e.amount);
      switch (e.entryType) {
        case 'deposit':
          deposits += amt;
          break;
        case 'withdrawal':
          withdrawals += amt;
          break;
        case 'fee':
          fees += amt;
          break;
        case 'execution':
          executions += amt;
          break;
      }
    }

    const net = deposits - withdrawals - fees - executions;

    return {
      deposits: deposits.toFixed(2),
      withdrawals: withdrawals.toFixed(2),
      fees: fees.toFixed(2),
      executions: executions.toFixed(2),
      net: net.toFixed(2),
    };
  }

  /**
   * Compute detailed capital breakdown (cash + inventory by station)
   * Includes caching with 1-hour TTL
   */
  async computeCapital(
    cycleId: string,
    opts?: { force?: boolean },
  ): Promise<CapitalResponse> {
    const now = new Date();
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) throw new Error('Cycle not found');

    // Cache unless forced and cache younger than 1h
    if (!opts?.force) {
      const cache = (await (this.prisma as any).cycleCapitalCache.findUnique({
        where: { cycleId },
        select: { snapshot: true, updatedAt: true },
      })) as { snapshot: unknown; updatedAt: Date } | null;
      if (cache?.updatedAt) {
        const ageMs = now.getTime() - cache.updatedAt.getTime();
        if (ageMs < CAPITAL_CONSTANTS.CACHE_TTL_MS) {
          return cache.snapshot as CapitalResponse;
        }
      }
    }

    // 1) Cash: sum wallets for configured characters minus reserve
    const tracked = await this.characterService.getTrackedSellerIds();

    // Fetch all wallets in parallel
    const walletResults = await Promise.allSettled(
      tracked.map((cid) => this.esiChars.getWallet(cid)),
    );

    let cashSum = 0;
    walletResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        cashSum += result.value;
      } else {
        this.logger.warn(
          `Wallet fetch failed for ${tracked[idx]}: ${String(result.reason)}`,
        );
      }
    });

    const reserve =
      CAPITAL_CONSTANTS.CASH_RESERVE_PER_CHARACTER_ISK * tracked.length;
    const cash = Math.max(0, cashSum - reserve);

    // 2) Inventory valuation: cost basis preferred, fallback to Jita lowest sell
    const byTypeStation = await computeCostBasisPositions(this.prisma);
    const key = (stationId: number, typeId: number) => `${stationId}:${typeId}`;

    // Query our active sell orders and assets in parallel
    const chars = await this.characterService.getTrackedSellerIds();

    // Fetch all orders and assets in parallel
    const [ordersResults, assetsResults] = await Promise.all([
      Promise.allSettled(chars.map((cid) => this.esiChars.getOrders(cid))),
      Promise.allSettled(chars.map((cid) => this.esiChars.getAssets(cid))),
    ]);

    // Process orders
    const ourSellOrders: Array<{
      typeId: number;
      stationId: number;
      remaining: number;
    }> = [];
    ordersResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        for (const o of result.value) {
          if (!o.is_buy_order) {
            ourSellOrders.push({
              typeId: o.type_id,
              stationId: o.location_id,
              remaining: o.volume_remain,
            });
          }
        }
      } else {
        this.logger.warn(
          `Orders fetch failed for ${chars[idx]}: ${String(result.reason)}`,
        );
      }
    });

    // Process assets
    const assetsByStationType = new Map<string, number>();
    assetsResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        for (const a of result.value) {
          const k = key(a.location_id, a.type_id);
          assetsByStationType.set(
            k,
            (assetsByStationType.get(k) ?? 0) + a.quantity,
          );
        }
      } else {
        this.logger.warn(
          `Assets fetch failed for ${chars[idx]}: ${String(result.reason)}`,
        );
      }
    });

    // Merge assets + on-market quantities by station/type
    const qtyByTypeStation = new Map<string, number>();
    for (const [k2, q] of assetsByStationType.entries())
      qtyByTypeStation.set(k2, q);
    for (const o of ourSellOrders) {
      const k2 = key(o.stationId, o.typeId);
      qtyByTypeStation.set(k2, (qtyByTypeStation.get(k2) ?? 0) + o.remaining);
    }

    // Station name lookup
    const stationIds = Array.from(
      new Set(
        Array.from(qtyByTypeStation.keys())
          .map((k2) => Number(k2.split(':')[0]))
          .filter((id) => Number.isFinite(id) && id > 0 && id <= 2147483647),
      ),
    );
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

    // Price fallback helper (uses region cache for optimization)
    const jitaRegionId = await this.gameData.getJitaRegionId();
    const getJitaPrice = createJitaPriceFetcher(this.esi, jitaRegionId);

    // Compute inventory value per station
    const itemsNeedingPricing: Array<{
      key: string;
      typeId: number;
      stationId: number;
      qty: number;
    }> = [];
    const itemsWithCostBasis: Array<{
      stationId: number;
      unitValue: number;
      qty: number;
    }> = [];

    for (const [k2, qty] of qtyByTypeStation) {
      const [stationIdStr, typeIdStr] = k2.split(':');
      const stationId = Number(stationIdStr);
      const typeId = Number(typeIdStr);
      const pos = byTypeStation.get(k2);

      if (pos && pos.quantity > 0) {
        const unitValue = pos.totalCost / pos.quantity;
        itemsWithCostBasis.push({ stationId, unitValue, qty });
      } else {
        itemsNeedingPricing.push({ key: k2, typeId, stationId, qty });
      }
    }

    // Fetch all Jita prices in parallel
    const jitaPriceResults = await Promise.allSettled(
      itemsNeedingPricing.map((item) => getJitaPrice(item.typeId)),
    );

    // Compute totals
    let inventoryTotal = 0;
    const breakdownMap = new Map<number, number>();

    // Add items with cost basis
    for (const item of itemsWithCostBasis) {
      const value = item.unitValue * item.qty;
      inventoryTotal += value;
      breakdownMap.set(
        item.stationId,
        (breakdownMap.get(item.stationId) ?? 0) + value,
      );
    }

    // Add items with Jita pricing
    jitaPriceResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        const item = itemsNeedingPricing[idx];
        const value = result.value * item.qty;
        inventoryTotal += value;
        breakdownMap.set(
          item.stationId,
          (breakdownMap.get(item.stationId) ?? 0) + value,
        );
      }
    });

    const total = cash + inventoryTotal;
    const pctCash = total > 0 ? (cash / total) * 100 : 0;
    const pctInv = total > 0 ? (inventoryTotal / total) * 100 : 0;

    const out: CapitalResponse = {
      cycleId,
      asOf: now.toISOString(),
      capital: {
        total: total.toFixed(2),
        cash: cash.toFixed(2),
        inventory: inventoryTotal.toFixed(2),
        percentSplit: {
          cash: Number(pctCash.toFixed(2)),
          inventory: Number(pctInv.toFixed(2)),
        },
      },
      initialInvestment: cycle.initialCapitalIsk
        ? String(cycle.initialCapitalIsk)
        : null,
      inventoryBreakdown: Array.from(breakdownMap.entries()).map(
        ([sid, v]) => ({
          stationId: sid,
          stationName: stationNameById.get(sid) ?? String(sid),
          value: v.toFixed(2),
        }),
      ),
      notes: [
        'valuation=costBasis|fallback:JitaLowestSell',
        `cashReserve=${reserve}`,
      ],
    };

    // Upsert cache
    await (this.prisma as unknown as any).cycleCapitalCache.upsert({
      where: { cycleId },
      create: { cycleId, asOf: now, snapshot: out },
      update: { asOf: now, snapshot: out },
    });

    return out;
  }
}
