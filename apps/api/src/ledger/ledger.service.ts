import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EsiCharactersService } from '../esi/esi-characters.service';
import { EsiService } from '../esi/esi.service';
import { fetchStationOrders } from '../esi/market-helpers';

export type NavTotals = {
  deposits: string;
  withdrawals: string;
  fees: string;
  executions: string;
  net: string;
};

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

@Injectable()
export class LedgerService {
  private readonly rolloverOpeningCommitMemo = 'Opening Balance (carryover)';
  private readonly jitaStationId = 60003760;
  private readonly trackedCharacterIds = [
    2122406821, 2122406910, 2122406955, 2122471041,
  ];
  constructor(
    private readonly prisma: PrismaService,
    private readonly esiChars: EsiCharactersService,
    private readonly esi: EsiService,
    private readonly logger: Logger,
  ) {}

  private async computeCurrentCapitalNow(): Promise<{
    cash: number;
    inventory: number;
  }> {
    // Cash from tracked characters minus base reserve
    let cashSum = 0;
    for (const cid of this.trackedCharacterIds) {
      try {
        const bal = await this.esiChars.getWallet(cid);
        cashSum += bal;
      } catch (e) {
        this.logger.warn(`Wallet fetch failed for ${cid}: ${String(e)}`);
      }
    }
    const reserve = 100_000_000 * this.trackedCharacterIds.length;
    const cash = Math.max(0, cashSum - reserve);

    // Build weighted-average cost positions by station/type from wallet transactions
    type Position = { quantity: number; totalCost: number };
    const byTypeStation = new Map<string, Position>();
    const txs = await this.prisma.walletTransaction.findMany({
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
      const k = key(t.locationId, t.typeId);
      const pos = byTypeStation.get(k) ?? { quantity: 0, totalCost: 0 };
      if (t.isBuy) {
        pos.quantity += t.quantity;
        pos.totalCost += Number(t.unitPrice) * t.quantity;
      } else {
        const sellQty = Math.min(pos.quantity, t.quantity);
        if (sellQty > 0 && pos.quantity > 0) {
          const avg = pos.totalCost / pos.quantity;
          pos.quantity -= sellQty;
          pos.totalCost -= avg * sellQty;
        }
      }
      byTypeStation.set(k, pos);
    }

    // Merge quantities from our active sell orders and assets
    const qtyByTypeStation = new Map<string, number>();
    // Assets (items on market are not in assets)
    for (const cid of this.trackedCharacterIds) {
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
    for (const cid of this.trackedCharacterIds) {
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

    // Resolve Jita region once
    let jitaRegionId: number | null = null;
    const jitaStation = await this.prisma.stationId.findUnique({
      where: { id: this.jitaStationId },
      select: { solarSystemId: true },
    });
    if (jitaStation) {
      const sys = await this.prisma.solarSystemId.findUnique({
        where: { id: jitaStation.solarSystemId },
        select: { regionId: true },
      });
      if (sys) jitaRegionId = sys.regionId;
    }

    const getJitaLowest = async (typeId: number): Promise<number | null> => {
      if (!jitaRegionId) return null;
      try {
        const orders = await fetchStationOrders(this.esi, {
          regionId: jitaRegionId,
          typeId,
          stationId: this.jitaStationId,
          side: 'sell',
        });
        orders.sort((a, b) => a.price - b.price);
        return orders.length ? orders[0].price : null;
      } catch {
        return null;
      }
    };

    // Value inventory using cost basis fallback to Jita
    let inventoryTotal = 0;
    for (const [k2, qty] of qtyByTypeStation) {
      const [, tidStr] = k2.split(':');
      const typeId = Number(tidStr);
      const pos = byTypeStation.get(k2);
      let unitValue: number | null = null;
      if (pos && pos.quantity > 0) unitValue = pos.totalCost / pos.quantity;
      else unitValue = await getJitaLowest(typeId);
      if (!unitValue) continue;
      inventoryTotal += unitValue * qty;
    }

    return { cash, inventory: inventoryTotal };
  }

  async createCycle(input: {
    name?: string | null;
    startedAt: Date;
    initialInjectionIsk?: string;
  }) {
    // Compute current capital (carryover) and store initial total capital
    const nowCap = await this.computeCurrentCapitalNow();
    const inj = input.initialInjectionIsk
      ? Number(input.initialInjectionIsk)
      : 0;
    const initialCapital = nowCap.cash + nowCap.inventory + inj;
    const cycle = await this.prisma.cycle.create({
      data: {
        name: input.name ?? null,
        startedAt: input.startedAt,
        initialInjectionIsk: input.initialInjectionIsk
          ? input.initialInjectionIsk
          : null,
        initialCapitalIsk: initialCapital.toFixed(2),
      },
      select: { id: true },
    });

    // Build weighted-average cost positions by station/type from wallet transactions
    type Position = { quantity: number; totalCost: number };
    const byTypeStation = new Map<string, Position>();
    const txs = await this.prisma.walletTransaction.findMany({
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
      const k = key(t.locationId, t.typeId);
      const pos = byTypeStation.get(k) ?? { quantity: 0, totalCost: 0 };
      if (t.isBuy) {
        pos.quantity += t.quantity;
        pos.totalCost += Number(t.unitPrice) * t.quantity;
      } else {
        const sellQty = Math.min(pos.quantity, t.quantity);
        if (sellQty > 0 && pos.quantity > 0) {
          const avg = pos.totalCost / pos.quantity;
          pos.quantity -= sellQty;
          pos.totalCost -= avg * sellQty;
        }
      }
      byTypeStation.set(k, pos);
    }

    // Quantities from assets + active sell orders
    const qtyByTypeStation = new Map<string, number>();
    for (const cid of this.trackedCharacterIds) {
      try {
        const assets = await this.esiChars.getAssets(cid);
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
    for (const cid of this.trackedCharacterIds) {
      try {
        const orders = await this.esiChars.getOrders(cid);
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

    // Jita region for fallback pricing
    let jitaRegionId: number | null = null;
    const jitaStation = await this.prisma.stationId.findUnique({
      where: { id: this.jitaStationId },
      select: { solarSystemId: true },
    });
    if (jitaStation) {
      const sys = await this.prisma.solarSystemId.findUnique({
        where: { id: jitaStation.solarSystemId },
        select: { regionId: true },
      });
      if (sys) jitaRegionId = sys.regionId;
    }
    const getJitaLowest = async (typeId: number): Promise<number | null> => {
      if (!jitaRegionId) return null;
      try {
        const orders = await fetchStationOrders(this.esi, {
          regionId: jitaRegionId,
          typeId,
          stationId: this.jitaStationId,
          side: 'sell',
        });
        orders.sort((a, b) => a.price - b.price);
        return orders.length ? orders[0].price : null;
      } catch {
        return null;
      }
    };

    // Create Opening Balance commit with carryover items so sells can be tracked
    const lines: Array<{
      typeId: number;
      sourceStationId: number;
      destinationStationId: number;
      plannedUnits: number;
      unitCost: number;
    }> = [];
    for (const [k2, qty] of qtyByTypeStation) {
      const [sidStr, tidStr] = k2.split(':');
      const stationId = Number(sidStr);
      const typeId = Number(tidStr);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const pos = byTypeStation.get(k2);
      let unitCost: number | null = null;
      if (pos && pos.quantity > 0) unitCost = pos.totalCost / pos.quantity;
      else unitCost = await getJitaLowest(typeId);
      if (!unitCost) continue;
      lines.push({
        typeId,
        sourceStationId: stationId,
        destinationStationId: stationId,
        plannedUnits: Math.floor(qty),
        unitCost: Number(unitCost.toFixed(2)),
      });
      if (lines.length >= 1000) break; // avoid overly large commit
    }
    if (lines.length) {
      const commit = await this.prisma.planCommit.create({
        data: {
          request: { type: 'opening_balance', cycleId: cycle.id },
          result: {
            lines: lines.length,
            generatedAt: new Date().toISOString(),
          },
          memo: this.rolloverOpeningCommitMemo,
        },
        select: { id: true },
      });
      await this.prisma.planCommitLine.createMany({
        data: lines.map((l) => ({
          commitId: commit.id,
          typeId: l.typeId,
          sourceStationId: l.sourceStationId,
          destinationStationId: l.destinationStationId,
          plannedUnits: l.plannedUnits,
          unitCost: l.unitCost,
          unitProfit: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      });
    }

    return cycle;
  }

  async listCycles() {
    return await this.prisma.cycle.findMany({ orderBy: { startedAt: 'desc' } });
  }

  async closeCycle(cycleId: string, closedAt: Date) {
    return await this.prisma.cycle.update({
      where: { id: cycleId },
      data: { closedAt },
    });
  }

  async appendEntry(input: {
    cycleId: string;
    entryType: string;
    amountIsk: string; // use string for decimals
    occurredAt?: Date;
    memo?: string | null;
    planCommitId?: string | null;
  }) {
    return await this.prisma.cycleLedgerEntry.create({
      data: {
        cycleId: input.cycleId,
        entryType: input.entryType,
        amount: input.amountIsk,
        occurredAt: input.occurredAt ?? new Date(),
        memo: input.memo ?? null,
        planCommitId: input.planCommitId ?? null,
      },
    });
  }

  async listEntries(cycleId: string) {
    return await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  async listEntriesEnriched(cycleId: string): Promise<
    Array<{
      id: string;
      occurredAt: Date;
      entryType: string;
      amount: string;
      memo: string | null;
      planCommitId: string | null;
      characterName: string | null;
      stationName: string | null;
      typeName: string | null;
      source: string;
      matchStatus: string | null;
    }>
  > {
    const rows = await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true,
        occurredAt: true,
        entryType: true,
        amount: true,
        memo: true,
        planCommitId: true,
        characterId: true,
        stationId: true,
        typeId: true,
        source: true,
        matchStatus: true,
      },
    });

    const charIds = Array.from(
      new Set(
        rows.map((r) => r.characterId).filter((v): v is number => v !== null),
      ),
    );
    const stationIds = Array.from(
      new Set(
        rows.map((r) => r.stationId).filter((v): v is number => v !== null),
      ),
    );
    const typeIds = Array.from(
      new Set(rows.map((r) => r.typeId).filter((v): v is number => v !== null)),
    );

    const [chars, stations, types] = await Promise.all([
      charIds.length
        ? this.prisma.eveCharacter.findMany({
            where: { id: { in: charIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]),
      stationIds.length
        ? this.prisma.stationId.findMany({
            where: { id: { in: stationIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]),
      typeIds.length
        ? this.prisma.typeId.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]),
    ]);

    const charNameById = new Map<number, string>(
      chars.map((c) => [c.id, c.name] as [number, string]),
    );
    const stationNameById = new Map<number, string>(
      stations.map((s) => [s.id, s.name] as [number, string]),
    );
    const typeNameById = new Map<number, string>(
      types.map((t) => [t.id, t.name] as [number, string]),
    );

    return rows.map((r) => ({
      id: r.id,
      occurredAt: r.occurredAt,
      entryType: r.entryType,
      amount: r.amount.toString(),
      memo: r.memo ?? null,
      planCommitId: r.planCommitId ?? null,
      characterName:
        r.characterId !== null
          ? (charNameById.get(r.characterId) ?? null)
          : null,
      stationName:
        r.stationId !== null
          ? (stationNameById.get(r.stationId) ?? null)
          : null,
      typeName: r.typeId !== null ? (typeNameById.get(r.typeId) ?? null) : null,
      source: r.source,
      matchStatus: r.matchStatus ?? null,
    }));
  }

  async computeNav(cycleId: string): Promise<NavTotals> {
    const entries = await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
    });
    const zero = BigInt(0);
    const scale = 100n; // cents for Decimal(28,2)
    const toInt = (s: string) => BigInt(s.replace(/\./, ''));

    let deposits = zero;
    let withdrawals = zero;
    let fees = zero;
    let executions = zero;

    for (const e of entries) {
      const v = toInt(e.amount.toString());
      switch (e.entryType) {
        case 'deposit':
          deposits += v;
          break;
        case 'withdrawal':
          withdrawals += v;
          break;
        case 'fee':
          fees += v;
          break;
        case 'execution':
          executions += v;
          break;
        default:
          executions += v;
      }
    }

    const fmt = (n: bigint) => (Number(n) / Number(scale)).toFixed(2);
    const net = deposits + executions - withdrawals - fees;
    return {
      deposits: fmt(deposits),
      withdrawals: fmt(withdrawals),
      fees: fmt(fees),
      executions: fmt(executions),
      net: fmt(net),
    };
  }

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const cache = (await (this.prisma as any).cycleCapitalCache.findUnique({
        where: { cycleId },
        select: { snapshot: true, updatedAt: true },
      })) as { snapshot: unknown; updatedAt: Date } | null;
      if (cache?.updatedAt) {
        const ageMs = now.getTime() - cache.updatedAt.getTime();
        if (ageMs < 60 * 60 * 1000) {
          return cache.snapshot as CapitalResponse;
        }
      }
    }

    // 1) Cash: sum wallets for configured characters minus 400M reserve
    let cashSum = 0;
    for (const cid of this.trackedCharacterIds) {
      try {
        const bal = await this.esiChars.getWallet(cid);
        cashSum += bal;
      } catch (e) {
        this.logger.warn(`Wallet fetch failed for ${cid}: ${String(e)}`);
      }
    }
    const reserve = 100_000_000 * this.trackedCharacterIds.length;
    const cash = Math.max(0, cashSum - reserve);

    // 2) Inventory valuation: cost basis preferred, fallback to Jita lowest sell
    // Build cost basis by type and station from wallet transactions
    type Position = { quantity: number; totalCost: number };
    const byTypeStation = new Map<string, Position>();
    const txs = await this.prisma.walletTransaction.findMany({
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
      const k = key(t.locationId, t.typeId);
      const pos = byTypeStation.get(k) ?? { quantity: 0, totalCost: 0 };
      if (t.isBuy) {
        pos.quantity += t.quantity;
        pos.totalCost += Number(t.unitPrice) * t.quantity;
      } else {
        // consume FIFO-ish against WAC by reducing quantity and proportional cost
        const sellQty = Math.min(pos.quantity, t.quantity);
        if (sellQty > 0 && pos.quantity > 0) {
          const avg = pos.totalCost / pos.quantity;
          pos.quantity -= sellQty;
          pos.totalCost -= avg * sellQty;
        }
      }
      byTypeStation.set(k, pos);
    }

    // Query our active sell orders to capture on-market items
    const ourSellOrders: Array<{
      typeId: number;
      stationId: number;
      remaining: number;
    }> = [];
    const chars = this.trackedCharacterIds;
    for (const cid of chars) {
      try {
        const orders = await this.esiChars.getOrders(cid);
        for (const o of orders) {
          if (!o.is_buy_order) {
            ourSellOrders.push({
              typeId: o.type_id,
              stationId: o.location_id,
              remaining: o.volume_remain,
            });
          }
        }
      } catch (e) {
        this.logger.warn(`Orders fetch failed for ${cid}: ${String(e)}`);
      }
    }

    // Query assets for the same characters (items on market won't appear here)
    const assetsByStationType = new Map<string, number>();
    for (const cid of chars) {
      try {
        const assets = await this.esiChars.getAssets(cid);
        for (const a of assets) {
          const k = key(a.location_id, a.type_id);
          assetsByStationType.set(
            k,
            (assetsByStationType.get(k) ?? 0) + a.quantity,
          );
        }
      } catch (e) {
        this.logger.warn(`Assets fetch failed for ${cid}: ${String(e)}`);
      }
    }

    // Merge assets + on-market quantities by station/type
    const qtyByTypeStation = new Map<string, number>();
    for (const [k2, q] of assetsByStationType.entries())
      qtyByTypeStation.set(k2, q);
    for (const o of ourSellOrders) {
      const k2 = key(o.stationId, o.typeId);
      qtyByTypeStation.set(k2, (qtyByTypeStation.get(k2) ?? 0) + o.remaining);
    }

    // Station name lookup (filter out structures/non-NPC ids > INT4 to avoid Prisma int overflow)
    const stationIds = Array.from(
      new Set(
        Array.from(qtyByTypeStation.keys())
          .map((k2) => Number(k2.split(':')[0]))
          .filter((id) => Number.isFinite(id) && id > 0 && id <= 2147483647),
      ),
    );
    const stations = await this.prisma.stationId.findMany({
      where: { id: { in: stationIds } },
      select: { id: true, name: true, solarSystemId: true },
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
    const stationNameById = new Map<number, string>();
    for (const s of stations) {
      regionByStation.set(s.id, regionBySystem.get(s.solarSystemId)!);
      stationNameById.set(s.id, s.name);
    }

    // Price fallback helper
    const getJitaLowest = async (typeId: number): Promise<number | null> => {
      const regionId = regionByStation.get(this.jitaStationId);
      if (!regionId) {
        // Resolve once if missing
        const jita = await this.prisma.stationId.findUnique({
          where: { id: this.jitaStationId },
          select: { solarSystemId: true },
        });
        if (!jita) return null;
        const sys = await this.prisma.solarSystemId.findUnique({
          where: { id: jita.solarSystemId },
          select: { regionId: true },
        });
        if (sys) regionByStation.set(this.jitaStationId, sys.regionId);
      }
      const rid = regionByStation.get(this.jitaStationId);
      if (!rid) return null;
      try {
        const orders = await fetchStationOrders(this.esi, {
          regionId: rid,
          typeId,
          stationId: this.jitaStationId,
          side: 'sell',
        });
        orders.sort((a, b) => a.price - b.price);
        return orders.length ? orders[0].price : null;
      } catch {
        return null;
      }
    };

    // Compute inventory value per station
    let inventoryTotal = 0;
    const breakdownMap = new Map<number, number>();
    for (const [k2, qty] of qtyByTypeStation) {
      const [stationIdStr, typeIdStr] = k2.split(':');
      const stationId = Number(stationIdStr);
      const typeId = Number(typeIdStr);
      const pos = byTypeStation.get(k2);
      let unitValue: number | null = null;
      if (pos && pos.quantity > 0) {
        unitValue = pos.totalCost / pos.quantity; // weighted average cost
      } else {
        unitValue = await getJitaLowest(typeId);
      }
      if (!unitValue) continue;
      const value = unitValue * qty;
      inventoryTotal += value;
      breakdownMap.set(stationId, (breakdownMap.get(stationId) ?? 0) + value);
    }

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (this.prisma as unknown as any).cycleCapitalCache.upsert({
      where: { cycleId },
      create: { cycleId, asOf: now, snapshot: out },
      update: { asOf: now, snapshot: out },
    });

    return out;
  }
}
