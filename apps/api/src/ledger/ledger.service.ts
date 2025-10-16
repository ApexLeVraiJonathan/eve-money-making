import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ParticipationStatus, Prisma } from '@prisma/client';
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

  private async getTrackedCharacterIds(): Promise<number[]> {
    // Only SELLERs stationed in any of the specified hubs, and that have a token
    const rows = await this.prisma.eveCharacter.findMany({
      where: {
        function: 'SELLER',
        location: { in: ['DODIXIE', 'HEK', 'RENS', 'AMARR'] },
        token: { isNot: null },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  constructor(
    private readonly prisma: PrismaService,
    private readonly esiChars: EsiCharactersService,
    private readonly esi: EsiService,
    private readonly logger: Logger,
  ) {}

  // Helpers
  async getCurrentOpenCycle() {
    return await this.prisma.cycle.findFirst({
      where: { startedAt: { lte: new Date() }, closedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getNextPlannedCycle() {
    // First try to find a cycle with future startedAt
    const futureCycle = await this.prisma.cycle.findFirst({
      where: { startedAt: { gt: new Date() }, closedAt: null },
      orderBy: { startedAt: 'asc' },
    });

    if (futureCycle) return futureCycle;

    // If no future cycle, find the most recent cycle without ledger entries (not yet opened)
    const unopenedCycle = await this.prisma.cycle.findFirst({
      where: {
        closedAt: null,
        ledgerEntries: { none: {} }, // No ledger entries = not opened yet
      },
      orderBy: { createdAt: 'desc' },
    });

    return unopenedCycle;
  }

  async planCycle(input: {
    name?: string | null;
    startedAt: Date; // must be future to be a planned cycle
    initialInjectionIsk?: string;
  }) {
    // Do not close existing cycle or create opening commit here
    return await this.prisma.cycle.create({
      data: {
        name: input.name ?? null,
        startedAt: input.startedAt,
        initialInjectionIsk: input.initialInjectionIsk
          ? input.initialInjectionIsk
          : null,
      },
    });
  }

  private async buildOpeningBalanceLines(): Promise<
    Array<{
      stationId: number;
      typeId: number;
      qty: number;
      unitCost: number | null;
    }>
  > {
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
    const tracked = await this.getTrackedCharacterIds();
    for (const cid of tracked) {
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
    for (const cid of tracked) {
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

    const lines: Array<{
      stationId: number;
      typeId: number;
      qty: number;
      unitCost: number | null;
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
        stationId,
        typeId,
        qty: Math.floor(qty),
        unitCost: Number(unitCost.toFixed(2)),
      });
      if (lines.length >= 1000) break;
    }
    return lines;
  }

  async openPlannedCycle(input: { cycleId: string; startedAt?: Date }) {
    const now = new Date();
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: input.cycleId },
    });
    if (!cycle) throw new Error('Cycle not found');

    // Clean up unpaid and refunded participations for this cycle
    // Remove any participations that are AWAITING_INVESTMENT or REFUNDED
    await this.prisma.cycleParticipation.deleteMany({
      where: {
        cycleId: input.cycleId,
        status: { in: ['AWAITING_INVESTMENT', 'REFUNDED'] },
      },
    });

    // Close any existing open cycle
    const open = await this.getCurrentOpenCycle();
    if (open && open.id !== cycle.id) {
      await this.prisma.cycle.update({
        where: { id: open.id },
        data: { closedAt: now },
      });
    }

    // Set startedAt if provided or if cycle is still future ensure it's set now
    const startedAt =
      input.startedAt ?? (cycle.startedAt > now ? now : cycle.startedAt);
    if (startedAt.getTime() !== cycle.startedAt.getTime()) {
      await this.prisma.cycle.update({
        where: { id: cycle.id },
        data: { startedAt },
      });
    }

    // Sum validated participations for this cycle
    const validatedParticipations =
      await this.prisma.cycleParticipation.aggregate({
        where: {
          cycleId: cycle.id,
          status: 'OPTED_IN',
          validatedAt: { not: null },
        },
        _sum: { amountIsk: true },
      });
    const participationTotal = validatedParticipations._sum.amountIsk
      ? Number(validatedParticipations._sum.amountIsk)
      : 0;

    // Compute initial capital snapshot (carryover + optional injection + validated participations)
    const nowCap = await this.computeCurrentCapitalNow();
    const inj = cycle.initialInjectionIsk
      ? Number(cycle.initialInjectionIsk)
      : 0;
    const initialCapital =
      nowCap.cash + nowCap.inventory + inj + participationTotal;
    await this.prisma.cycle.update({
      where: { id: cycle.id },
      data: { initialCapitalIsk: initialCapital.toFixed(2) },
    });

    // No longer creating synthetic opening balance entries
    // Inventory rollover is handled via cycle lines if needed

    return await this.prisma.cycle.findUnique({ where: { id: cycle.id } });
  }
  private async computeCurrentCapitalNow(): Promise<{
    cash: number;
    inventory: number;
  }> {
    // Cash from tracked characters minus base reserve
    let cashSum = 0;
    const tracked = await this.getTrackedCharacterIds();
    for (const cid of tracked) {
      try {
        const bal = await this.esiChars.getWallet(cid);
        cashSum += bal;
      } catch (e) {
        this.logger.warn(`Wallet fetch failed for ${cid}: ${String(e)}`);
      }
    }
    const reserve = 100_000_000 * tracked.length;
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
    const tracked = await this.getTrackedCharacterIds();
    for (const cid of tracked) {
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
    for (const cid of tracked) {
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
    // Create CycleLine records for opening balance inventory (if any)
    if (lines.length) {
      await this.prisma.cycleLine.createMany({
        data: lines.map((l) => ({
          cycleId: cycle.id,
          typeId: l.typeId,
          destinationStationId: l.destinationStationId,
          plannedUnits: l.plannedUnits,
        })),
      });
      this.logger.log(
        `Created ${lines.length} opening balance cycle lines for cycle ${cycle.id}`,
      );
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
    participationId?: string | null;
  }) {
    return await this.prisma.cycleLedgerEntry.create({
      data: {
        cycleId: input.cycleId,
        entryType: input.entryType,
        amount: input.amountIsk,
        occurredAt: input.occurredAt ?? new Date(),
        memo: input.memo ?? null,
        participationId: input.participationId ?? null,
      },
    });
  }

  async listEntries(cycleId: string) {
    return await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  // Participation workflows
  async createParticipation(input: {
    cycleId: string;
    characterName?: string;
    amountIsk: string; // Decimal(28,2) as string
    userId?: string; // Link to user if authenticated
  }) {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: input.cycleId },
    });
    if (!cycle) throw new Error('Cycle not found');
    if (cycle.startedAt <= new Date()) {
      throw new Error('Opt-in only allowed for planned cycles');
    }
    // If characterName not provided, pick a latest linked character name (fallback)
    let characterName = input.characterName;
    if (!characterName) {
      const anyChar = await this.prisma.eveCharacter.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { name: true },
      });
      characterName = anyChar?.name ?? 'Unknown';
    }

    // Generate short memo to fit EVE's donation reason field (~40 char limit)
    // Format: ARB-{first8CharsOfCycleId}
    // Character name removed - can be inferred from journal's firstPartyId
    const memo = `ARB-${cycle.id.substring(0, 8)}`;

    // Check for existing participation by cycle + user (memo might not be unique anymore)
    const existing = await this.prisma.cycleParticipation.findFirst({
      where: {
        cycleId: input.cycleId,
        userId: input.userId ?? null,
      },
    });
    if (existing) return existing;
    return await this.prisma.cycleParticipation.create({
      data: {
        cycleId: input.cycleId,
        userId: input.userId, // Link to user
        characterName,
        amountIsk: input.amountIsk,
        memo,
        status: 'AWAITING_INVESTMENT',
      },
    });
  }

  async listParticipations(cycleId: string, status?: string) {
    const validStatuses: ParticipationStatus[] = [
      'AWAITING_INVESTMENT',
      'AWAITING_VALIDATION',
      'OPTED_IN',
      'OPTED_OUT',
      'COMPLETED',
      'REFUNDED',
    ];
    const where: Prisma.CycleParticipationWhereInput = {
      cycleId,
      ...(status && validStatuses.includes(status as ParticipationStatus)
        ? { status: status as ParticipationStatus }
        : {}),
    };
    return await this.prisma.cycleParticipation.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  async optOutParticipation(participationId: string) {
    const p = await this.prisma.cycleParticipation.findUnique({
      where: { id: participationId },
      include: { cycle: true },
    });
    if (!p) throw new Error('Participation not found');
    const cycle = p.cycle as { startedAt: Date };
    if (cycle.startedAt <= new Date()) {
      throw new Error('Cannot opt-out after cycle start');
    }

    // If still awaiting investment (no payment), just delete the participation
    if (p.status === 'AWAITING_INVESTMENT') {
      return await this.prisma.cycleParticipation.delete({
        where: { id: participationId },
      });
    }

    // If payment received (OPTED_IN), mark for refund
    if (p.status === 'OPTED_IN') {
      return await this.prisma.cycleParticipation.update({
        where: { id: participationId },
        data: { status: 'OPTED_OUT', optedOutAt: new Date() },
      });
    }

    throw new Error('Invalid participation status for opt-out');
  }

  async adminValidatePayment(input: {
    participationId: string;
    walletJournal?: { characterId: number; journalId: bigint } | null;
  }) {
    const p = await this.prisma.cycleParticipation.findUnique({
      where: { id: input.participationId },
    });
    if (!p) throw new Error('Participation not found');
    if (p.status === 'OPTED_IN' && p.validatedAt) return p;
    const updated = await this.prisma.cycleParticipation.update({
      where: { id: input.participationId },
      data: {
        status: 'OPTED_IN',
        validatedAt: new Date(),
        walletJournalId: input.walletJournal?.journalId ?? null,
      },
    });
    // Create deposit ledger entry
    await this.appendEntry({
      cycleId: updated.cycleId,
      entryType: 'deposit',
      amountIsk: String(updated.amountIsk),
      memo: `Participation deposit ${updated.characterName}`,
      participationId: updated.id,
      planCommitId: null,
    });
    return updated;
  }

  /**
   * Match wallet journal entries (player donations) to participations.
   * Supports:
   * - Exact memo matching
   * - Fuzzy memo matching (typos)
   * - Multiple payments with same memo (sum them)
   * - Wrong character (use actual payer)
   * - Partial/over payments (update to actual amount)
   */
  async matchParticipationPayments(cycleId?: string): Promise<{
    matched: number;
    partial: number;
    unmatched: Array<{
      journalId: string;
      characterId: number;
      amount: string;
      description: string | null;
      reason: string | null;
      date: Date;
    }>;
  }> {
    // Get all AWAITING_INVESTMENT participations
    const participations = await this.prisma.cycleParticipation.findMany({
      where: {
        status: 'AWAITING_INVESTMENT',
        ...(cycleId ? { cycleId } : {}),
      },
      include: {
        cycle: { select: { id: true, startedAt: true } },
      },
    });

    if (!participations.length) {
      return { matched: 0, partial: 0, unmatched: [] };
    }

    // Get all player_donation journal entries that aren't already linked
    const journals = await this.prisma.walletJournalEntry.findMany({
      where: {
        refType: 'player_donation',
        // Only consider donations to logistics characters
        characterId: {
          in: await this.prisma.eveCharacter
            .findMany({
              where: { role: 'LOGISTICS' },
              select: { id: true },
            })
            .then((chars) => chars.map((c) => c.id)),
        },
      },
      orderBy: { date: 'desc' },
    });

    // Find journals already linked to participations
    const linkedJournalIds = new Set(
      (
        await this.prisma.cycleParticipation.findMany({
          where: { walletJournalId: { not: null } },
          select: { walletJournalId: true },
        })
      )
        .map((p) => p.walletJournalId)
        .filter((id): id is bigint => id !== null),
    );

    const unlinkedJournals = journals.filter(
      (j) => !linkedJournalIds.has(j.journalId),
    );

    let matched = 0;
    let partial = 0;
    const unmatchedJournals: Array<{
      journalId: string;
      characterId: number;
      amount: string;
      description: string | null;
      reason: string | null;
      date: Date;
    }> = [];

    // Helper: Fuzzy memo matching (Levenshtein distance)
    const fuzzyMatch = (a: string, b: string): number => {
      const matrix: number[][] = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1,
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };

    // Try to match each participation
    for (const p of participations) {
      const expectedMemo = p.memo;
      const expectedAmount = Number(p.amountIsk);

      // Find all journals that could match this participation
      const candidates = unlinkedJournals
        .map((j) => {
          // Use 'reason' field for memo matching (EVE Online donation memo)
          const memo = (j.reason || '').trim();
          let score = 0;

          // Exact memo match = highest priority
          if (memo === expectedMemo) {
            score = 1000;
          }
          // Contains memo
          else if (memo.includes(expectedMemo)) {
            score = 500;
          }
          // Fuzzy match (allow up to 3 character differences)
          else {
            const distance = fuzzyMatch(
              memo.toLowerCase(),
              expectedMemo.toLowerCase(),
            );
            if (distance <= 3) {
              score = 100 - distance * 10;
            }
          }

          // Boost score if amount matches exactly
          const amount = Number(j.amount);
          if (amount === expectedAmount) {
            score += 50;
          }

          return { journal: j, score, amount };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);

      if (candidates.length === 0) {
        // No match found for this participation
        continue;
      }

      // Sum up all matching payments (support multiple payments with same memo)
      const matchedJournals = candidates.filter((c) => c.score >= 100); // Only take good matches
      const totalAmount = matchedJournals.reduce((sum, c) => sum + c.amount, 0);

      if (matchedJournals.length === 0) {
        continue;
      }

      // Use the character from the first (best) match
      const primaryJournal = matchedJournals[0].journal;

      // Get the donor's character name from firstPartyId (the sender)
      // Note: firstPartyId might not be in our EveCharacter table if they haven't linked
      let donorName = p.characterName; // Keep original name as fallback
      if (primaryJournal.firstPartyId) {
        const donorCharacter = await this.prisma.eveCharacter.findUnique({
          where: { id: primaryJournal.firstPartyId },
          select: { name: true },
        });
        if (donorCharacter) {
          donorName = donorCharacter.name;
        }
      }

      // Update participation with actual amount and link to journal
      const updated = await this.prisma.cycleParticipation.update({
        where: { id: p.id },
        data: {
          amountIsk: totalAmount.toFixed(2),
          characterName: donorName, // Keep donor's name, not logistics character
          status: 'OPTED_IN',
          validatedAt: new Date(),
          walletJournalId: primaryJournal.journalId,
        },
      });

      // Create deposit ledger entry
      await this.appendEntry({
        cycleId: updated.cycleId,
        entryType: 'deposit',
        amountIsk: String(updated.amountIsk),
        memo: `Participation deposit ${updated.characterName} (auto-matched)`,
        participationId: updated.id,
        planCommitId: null,
      });

      // Mark these journals as "used"
      for (const c of matchedJournals) {
        linkedJournalIds.add(c.journal.journalId);
      }

      matched++;
      if (totalAmount !== expectedAmount) {
        partial++;
      }
    }

    // Collect unmatched journals
    for (const j of unlinkedJournals) {
      if (!linkedJournalIds.has(j.journalId)) {
        unmatchedJournals.push({
          journalId: j.journalId.toString(),
          characterId: j.characterId,
          amount: j.amount.toString(),
          description: j.description,
          reason: j.reason,
          date: j.date,
        });
      }
    }

    return { matched, partial, unmatched: unmatchedJournals };
  }

  async adminMarkRefund(input: { participationId: string; amountIsk: string }) {
    const p = await this.prisma.cycleParticipation.findUnique({
      where: { id: input.participationId },
    });
    if (!p) throw new Error('Participation not found');

    // Create ledger entry for audit trail
    await this.appendEntry({
      cycleId: p.cycleId,
      entryType: 'withdrawal',
      amountIsk: input.amountIsk,
      memo: `Participation refund ${p.characterName}`,
      participationId: p.id,
      planCommitId: null,
    });

    // Delete the participation now that refund is complete
    // User can opt-in again if they want to participate
    const deleted = await this.prisma.cycleParticipation.delete({
      where: { id: input.participationId },
    });

    return deleted;
  }

  async getAllParticipations() {
    return await this.prisma.cycleParticipation.findMany({
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            startedAt: true,
            closedAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getUnmatchedDonations() {
    // Get all player_donation journal entries to LOGISTICS characters
    const logisticsCharacterIds = await this.prisma.eveCharacter
      .findMany({
        where: { role: 'LOGISTICS' },
        select: { id: true, name: true },
      })
      .then((chars) => chars);

    const charIdMap = new Map(logisticsCharacterIds.map((c) => [c.id, c.name]));
    const charIds = logisticsCharacterIds.map((c) => c.id);

    // Get all linked journal IDs
    const linkedJournalIds = new Set(
      (
        await this.prisma.cycleParticipation.findMany({
          where: { walletJournalId: { not: null } },
          select: { walletJournalId: true },
        })
      )
        .map((p) => p.walletJournalId)
        .filter((id): id is bigint => id !== null),
    );

    // Get all player_donation journals
    const journals = await this.prisma.walletJournalEntry.findMany({
      where: {
        refType: 'player_donation',
        characterId: { in: charIds },
      },
      orderBy: { date: 'desc' },
      take: 200, // Limit to recent 200
    });

    // Filter unlinked and add character names
    return journals
      .filter((j) => !linkedJournalIds.has(j.journalId))
      .map((j) => ({
        journalId: j.journalId.toString(),
        characterId: j.characterId,
        characterName: charIdMap.get(j.characterId) ?? null,
        amount: j.amount.toString(),
        description: j.description,
        reason: j.reason,
        date: j.date.toISOString(),
      }));
  }

  async markPayoutAsSent(participationId: string) {
    return await this.prisma.cycleParticipation.update({
      where: { id: participationId },
      data: { payoutPaidAt: new Date() },
    });
  }

  async computePayouts(cycleId: string, profitSharePct = 0.5) {
    const capital = await this.computeCapital(cycleId);
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) throw new Error('Cycle not found');
    const total = Number(capital.capital.total);
    const initial = cycle.initialCapitalIsk
      ? Number(cycle.initialCapitalIsk)
      : 0;
    const profit = Math.max(0, total - initial);
    const pool = profit * profitSharePct;
    const parts = await this.prisma.cycleParticipation.findMany({
      where: { cycleId, status: 'OPTED_IN' },
      orderBy: { createdAt: 'asc' },
    });
    const netById = new Map<string, number>();
    let investedTotal = 0;
    for (const p of parts) {
      const amt = Number(p.amountIsk) - Number(p.refundAmountIsk ?? 0);
      if (amt > 0) {
        netById.set(p.id, amt);
        investedTotal += amt;
      }
    }
    if (investedTotal <= 0 || pool <= 0)
      return {
        profit: profit.toFixed(2),
        pool: pool.toFixed(2),
        payouts: [] as Array<any>,
      };
    const payouts = parts
      .filter((p) => netById.has(p.id))
      .map((p) => {
        const share = (netById.get(p.id) ?? 0) / investedTotal;
        const payout = pool * share;
        return {
          participationId: p.id,
          characterName: p.characterName,
          amountIsk: String(p.amountIsk),
          payoutIsk: payout.toFixed(2),
        };
      });
    return { profit: profit.toFixed(2), pool: pool.toFixed(2), payouts };
  }

  async finalizePayouts(cycleId: string, profitSharePct = 0.5) {
    const rec = await this.computePayouts(cycleId, profitSharePct);
    type Payout = {
      participationId: string;
      characterName: string;
      amountIsk: string;
      payoutIsk: string;
    };
    const payouts: Payout[] = rec.payouts as unknown as Payout[];
    for (const p of payouts) {
      const current = await this.prisma.cycleParticipation.findUnique({
        where: { id: p.participationId },
        select: {
          id: true,
          characterName: true,
          status: true,
          payoutAmountIsk: true,
        },
      });
      if (!current) continue;
      if (current.status === 'COMPLETED' && current.payoutAmountIsk) continue;
      // create withdrawal ledger entry
      await this.appendEntry({
        cycleId,
        entryType: 'withdrawal',
        amountIsk: p.payoutIsk,
        memo: `Participation payout ${current.characterName}`,
        participationId: current.id,
        planCommitId: null,
      });
      await this.prisma.cycleParticipation.update({
        where: { id: current.id },
        data: {
          payoutAmountIsk: p.payoutIsk,
          payoutPaidAt: new Date(),
          status: 'COMPLETED',
        },
      });
    }
    return { ...rec, payouts };
  }

  async listEntriesEnriched(
    cycleId: string,
    limit?: number,
    offset?: number,
  ): Promise<
    Array<{
      id: string;
      occurredAt: Date;
      entryType: string;
      amount: string;
      memo: string | null;
      participationId: string | null;
    }>
  > {
    const rows = await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(Math.max(limit ?? 500, 1), 1000),
      skip: Math.max(offset ?? 0, 0),
      select: {
        id: true,
        occurredAt: true,
        entryType: true,
        amount: true,
        memo: true,
        participationId: true,
      },
    });

    // CycleLedgerEntry now only stores investor cash flows (deposits, withdrawals, payouts)
    // No need to resolve character/station/type names
    return rows.map((r) => ({
      id: r.id,
      occurredAt: r.occurredAt,
      entryType: r.entryType,
      amount: r.amount.toString(),
      memo: r.memo ?? null,
      participationId: r.participationId ?? null,
    }));
  }

  async getCycleOverview(): Promise<{
    current: null | {
      id: string;
      name: string | null;
      startedAt: string;
      endsAt: string | null;
      status: 'Open' | 'Closed' | 'Planned';
      capital: {
        cashISK: number;
        inventoryISK: number;
        originalInvestmentISK: number;
      };
      performance: { marginPct: number; profitISK: number };
      participantCount: number;
      totalInvestorCapital: number;
    };
    next: null | {
      id: string;
      name: string | null;
      startedAt: string;
      status: 'Planned';
    };
  }> {
    const now = new Date();
    const [current, next] = await Promise.all([
      this.prisma.cycle.findFirst({
        where: { startedAt: { lte: now }, closedAt: null },
        orderBy: { startedAt: 'desc' },
      }),
      this.getNextPlannedCycle(),
    ]);

    let currentOut: null | {
      id: string;
      name: string | null;
      startedAt: string;
      endsAt: string | null;
      status: 'Open' | 'Closed' | 'Planned';
      capital: {
        cashISK: number;
        inventoryISK: number;
        originalInvestmentISK: number;
      };
      performance: { marginPct: number; profitISK: number };
      participantCount: number;
      totalInvestorCapital: number;
    } = null;

    if (current) {
      const cap = await this.computeCapital(current.id);
      const total = Number(cap.capital.total);
      const initial = current.initialCapitalIsk
        ? Number(current.initialCapitalIsk)
        : 0;
      const profit = total - initial;
      const marginPct = initial > 0 ? profit / initial : 0;
      const endsAt = next
        ? next.startedAt.toISOString()
        : new Date(
            current.startedAt.getTime() + 14 * 24 * 60 * 60 * 1000,
          ).toISOString();

      // Get participant count and total investor capital
      const participations = await this.prisma.cycleParticipation.findMany({
        where: {
          cycleId: current.id,
          status: { in: ['OPTED_IN', 'COMPLETED'] },
        },
        select: { amountIsk: true },
      });

      const participantCount = participations.length;
      const totalInvestorCapital = participations.reduce(
        (sum, p) => sum + Number(p.amountIsk),
        0,
      );

      currentOut = {
        id: current.id,
        name: current.name ?? null,
        startedAt: current.startedAt.toISOString(),
        endsAt,
        status: 'Open',
        capital: {
          cashISK: Number(cap.capital.cash),
          inventoryISK: Number(cap.capital.inventory),
          originalInvestmentISK: initial,
        },
        performance: { marginPct, profitISK: profit },
        participantCount,
        totalInvestorCapital,
      };
    }

    const nextOut = next
      ? {
          id: next.id,
          name: next.name ?? null,
          startedAt: next.startedAt.toISOString(),
          status: 'Planned' as const,
        }
      : null;

    return { current: currentOut, next: nextOut };
  }

  async getCommitSummaries(cycleId: string) {
    // Return cycle line summaries instead of commit summaries
    return await this.listCycleLines(cycleId);
  }

  async getMyParticipation(cycleId: string, userId: string) {
    this.logger.log(
      `[getMyParticipation] Querying: cycleId=${cycleId}, userId=${userId}`,
    );

    const row = await this.prisma.cycleParticipation.findFirst({
      where: { cycleId, userId },
      select: {
        id: true,
        cycleId: true,
        userId: true,
        characterName: true,
        amountIsk: true,
        memo: true,
        status: true,
        walletJournalId: true,
        validatedAt: true,
        optedOutAt: true,
        refundAmountIsk: true,
        refundedAt: true,
        payoutAmountIsk: true,
        payoutPaidAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `[getMyParticipation] Query result: ${row ? `Found - id=${row.id}, userId=${row.userId}, status=${row.status}` : 'Not found (null)'}`,
    );

    if (!row) return null;

    // Compute estimated payout using current pool suggestion
    try {
      const rec = await this.computePayouts(cycleId, 0.5);
      type P = { participationId: string; payoutIsk: string };
      const payout = (rec.payouts as unknown as P[]).find(
        (x) => String(x.participationId) === String(row.id),
      );
      if (payout?.payoutIsk) {
        (row as unknown as { estimatedPayoutIsk?: string }).estimatedPayoutIsk =
          String(payout.payoutIsk);
      }
    } catch {
      // ignore errors in estimate
    }

    return row;
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
    const tracked = await this.getTrackedCharacterIds();

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

    const reserve = 100_000_000 * tracked.length;
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

    // Query our active sell orders and assets in parallel
    const chars = await this.getTrackedCharacterIds();

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
    // First, collect items that need Jita pricing (no cost basis)
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
        // Have cost basis - use immediately
        const unitValue = pos.totalCost / pos.quantity;
        itemsWithCostBasis.push({ stationId, unitValue, qty });
      } else {
        // Need Jita pricing
        itemsNeedingPricing.push({ key: k2, typeId, stationId, qty });
      }
    }

    // Fetch all Jita prices in parallel
    const jitaPriceResults = await Promise.allSettled(
      itemsNeedingPricing.map((item) => getJitaLowest(item.typeId)),
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (this.prisma as unknown as any).cycleCapitalCache.upsert({
      where: { cycleId },
      create: { cycleId, asOf: now, snapshot: out },
      update: { asOf: now, snapshot: out },
    });

    return out;
  }

  // ===== Cycle Lines (Buy Commits) =====

  async createCycleLine(input: {
    cycleId: string;
    typeId: number;
    destinationStationId: number;
    plannedUnits: number;
  }) {
    return await this.prisma.cycleLine.create({
      data: {
        cycleId: input.cycleId,
        typeId: input.typeId,
        destinationStationId: input.destinationStationId,
        plannedUnits: input.plannedUnits,
      },
    });
  }

  async listCycleLines(cycleId: string) {
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich with type and station names
    const typeIds = Array.from(new Set(lines.map((l) => l.typeId)));
    const stationIds = Array.from(
      new Set(lines.map((l) => l.destinationStationId)),
    );

    const [types, stations] = await Promise.all([
      this.prisma.typeId.findMany({
        where: { id: { in: typeIds } },
        select: { id: true, name: true },
      }),
      this.prisma.stationId.findMany({
        where: { id: { in: stationIds } },
        select: { id: true, name: true },
      }),
    ]);

    const typeNameById = new Map(types.map((t) => [t.id, t.name]));
    const stationNameById = new Map(stations.map((s) => [s.id, s.name]));

    return lines.map((l) => {
      const unitsBought = l.unitsBought;
      const unitsSold = l.unitsSold;
      const unitsRemaining = Math.max(0, unitsBought - unitsSold);
      const wacUnitCost =
        unitsBought > 0 ? Number(l.buyCostIsk) / unitsBought : 0;
      const lineProfitExclTransport =
        Number(l.salesNetIsk) -
        Number(l.buyCostIsk) -
        Number(l.brokerFeesIsk) -
        Number(l.relistFeesIsk);

      return {
        ...l,
        typeName: typeNameById.get(l.typeId) ?? String(l.typeId),
        destinationStationName:
          stationNameById.get(l.destinationStationId) ??
          String(l.destinationStationId),
        unitsRemaining,
        wacUnitCost: wacUnitCost.toFixed(2),
        lineProfitExclTransport: lineProfitExclTransport.toFixed(2),
        buyCostIsk: l.buyCostIsk.toString(),
        salesGrossIsk: l.salesGrossIsk.toString(),
        salesTaxIsk: l.salesTaxIsk.toString(),
        salesNetIsk: l.salesNetIsk.toString(),
        brokerFeesIsk: l.brokerFeesIsk.toString(),
        relistFeesIsk: l.relistFeesIsk.toString(),
      };
    });
  }

  async updateCycleLine(lineId: string, data: { plannedUnits?: number }) {
    return await this.prisma.cycleLine.update({
      where: { id: lineId },
      data,
    });
  }

  async deleteCycleLine(lineId: string) {
    return await this.prisma.cycleLine.delete({
      where: { id: lineId },
    });
  }

  // ===== Fees =====

  async addBrokerFee(input: { lineId: string; amountIsk: string }) {
    const line = await this.prisma.cycleLine.findUnique({
      where: { id: input.lineId },
      select: { brokerFeesIsk: true },
    });
    if (!line) throw new Error('Line not found');

    const newTotal = Number(line.brokerFeesIsk) + Number(input.amountIsk);
    return await this.prisma.cycleLine.update({
      where: { id: input.lineId },
      data: { brokerFeesIsk: newTotal.toFixed(2) },
    });
  }

  async addRelistFee(input: { lineId: string; amountIsk: string }) {
    const line = await this.prisma.cycleLine.findUnique({
      where: { id: input.lineId },
      select: { relistFeesIsk: true },
    });
    if (!line) throw new Error('Line not found');

    const newTotal = Number(line.relistFeesIsk) + Number(input.amountIsk);
    return await this.prisma.cycleLine.update({
      where: { id: input.lineId },
      data: { relistFeesIsk: newTotal.toFixed(2) },
    });
  }

  async addTransportFee(input: {
    cycleId: string;
    amountIsk: string;
    memo?: string;
  }) {
    return await this.prisma.cycleFeeEvent.create({
      data: {
        cycleId: input.cycleId,
        feeType: 'transport',
        amountIsk: input.amountIsk,
        memo: input.memo,
      },
    });
  }

  async listTransportFees(cycleId: string) {
    return await this.prisma.cycleFeeEvent.findMany({
      where: { cycleId, feeType: 'transport' },
      orderBy: { occurredAt: 'desc' },
    });
  }

  // ===== Cycle Profit (Cash-only) =====

  async computeCycleProfit(cycleId: string): Promise<{
    lineProfitExclTransport: string;
    transportFees: string;
    cycleProfitCash: string;
    lineBreakdown: Array<{
      lineId: string;
      typeId: number;
      typeName: string;
      destinationStationId: number;
      destinationStationName: string;
      profit: string;
    }>;
  }> {
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        salesNetIsk: true,
        buyCostIsk: true,
        brokerFeesIsk: true,
        relistFeesIsk: true,
      },
    });

    const fees = await this.prisma.cycleFeeEvent.findMany({
      where: { cycleId, feeType: 'transport' },
      select: { amountIsk: true },
    });

    let lineProfitTotal = 0;
    const breakdown: Array<{
      lineId: string;
      typeId: number;
      typeName: string;
      destinationStationId: number;
      destinationStationName: string;
      profit: string;
    }> = [];

    // Fetch names
    const typeIds = Array.from(new Set(lines.map((l) => l.typeId)));
    const stationIds = Array.from(
      new Set(lines.map((l) => l.destinationStationId)),
    );
    const [types, stations] = await Promise.all([
      this.prisma.typeId.findMany({
        where: { id: { in: typeIds } },
        select: { id: true, name: true },
      }),
      this.prisma.stationId.findMany({
        where: { id: { in: stationIds } },
        select: { id: true, name: true },
      }),
    ]);
    const typeNameById = new Map(types.map((t) => [t.id, t.name]));
    const stationNameById = new Map(stations.map((s) => [s.id, s.name]));

    for (const line of lines) {
      const profit =
        Number(line.salesNetIsk) -
        Number(line.buyCostIsk) -
        Number(line.brokerFeesIsk) -
        Number(line.relistFeesIsk);
      lineProfitTotal += profit;
      breakdown.push({
        lineId: line.id,
        typeId: line.typeId,
        typeName: typeNameById.get(line.typeId) ?? String(line.typeId),
        destinationStationId: line.destinationStationId,
        destinationStationName:
          stationNameById.get(line.destinationStationId) ??
          String(line.destinationStationId),
        profit: profit.toFixed(2),
      });
    }

    const transportTotal = fees.reduce(
      (sum, f) => sum + Number(f.amountIsk),
      0,
    );
    const cycleProfitCash = lineProfitTotal - transportTotal;

    return {
      lineProfitExclTransport: lineProfitTotal.toFixed(2),
      transportFees: transportTotal.toFixed(2),
      cycleProfitCash: cycleProfitCash.toFixed(2),
      lineBreakdown: breakdown,
    };
  }

  // ===== Cycle Snapshots =====

  async createCycleSnapshot(cycleId: string): Promise<{
    walletCashIsk: string;
    inventoryIsk: string;
    cycleProfitIsk: string;
  }> {
    // Get wallet cash for SELLER characters
    const tracked = await this.getTrackedCharacterIds();
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
    const reserve = Number(process.env.WALLET_RESERVE_PER_CHAR ?? 100_000_000);
    const walletCash = Math.max(0, cashSum - reserve * tracked.length);

    // Compute inventory from cycle lines (no ESI needed)
    const lines = await this.prisma.cycleLine.findMany({
      where: { cycleId },
      select: { unitsBought: true, unitsSold: true, buyCostIsk: true },
    });
    let inventoryTotal = 0;
    for (const line of lines) {
      const unitsRemaining = Math.max(0, line.unitsBought - line.unitsSold);
      if (unitsRemaining > 0 && line.unitsBought > 0) {
        const wac = Number(line.buyCostIsk) / line.unitsBought;
        inventoryTotal += wac * unitsRemaining;
      }
    }

    // Compute cycle profit
    const profit = await this.computeCycleProfit(cycleId);

    // Store snapshot
    await this.prisma.cycleSnapshot.create({
      data: {
        cycleId,
        snapshotAt: new Date(),
        walletCashIsk: walletCash.toFixed(2),
        inventoryIsk: inventoryTotal.toFixed(2),
        cycleProfitIsk: profit.cycleProfitCash,
      },
    });

    return {
      walletCashIsk: walletCash.toFixed(2),
      inventoryIsk: inventoryTotal.toFixed(2),
      cycleProfitIsk: profit.cycleProfitCash,
    };
  }

  async getCycleSnapshots(cycleId: string) {
    return await this.prisma.cycleSnapshot.findMany({
      where: { cycleId },
      orderBy: { snapshotAt: 'asc' },
    });
  }
}
