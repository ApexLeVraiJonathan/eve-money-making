import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PackageService } from '../../market/services/package.service';
import { CapitalService } from './capital.service';
import { PayoutService } from './payout.service';
import { ProfitService } from './profit.service';
import { EsiCharactersService } from '../../esi/esi-characters.service';
import { EsiService } from '../../esi/esi.service';
import { GameDataService } from '../../game-data/services/game-data.service';
import { CharacterService } from '../../characters/services/character.service';
import { fetchStationOrders } from '../../esi/market-helpers';

/**
 * CycleService handles core cycle lifecycle management.
 * Responsibilities: CRUD, opening, closing, planning cycles.
 */
@Injectable()
export class CycleService {
  private readonly logger = new Logger(CycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly packages: PackageService,
    @Inject(forwardRef(() => CapitalService))
    private readonly capitalService: CapitalService,
    @Inject(forwardRef(() => PayoutService))
    private readonly payoutService: PayoutService,
    @Inject(forwardRef(() => ProfitService))
    private readonly profitService: ProfitService,
    private readonly esiChars: EsiCharactersService,
    private readonly esi: EsiService,
    private readonly gameData: GameDataService,
    private readonly characterService: CharacterService,
  ) {}

  private readonly jitaStationId = 60003760;

  /**
   * Get the current open cycle
   */
  async getCurrentOpenCycle() {
    return await this.prisma.cycle.findFirst({
      where: { startedAt: { lte: new Date() }, closedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Get the next planned cycle (future or unopened)
   */
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

  /**
   * Plan a future cycle
   */
  async planCycle(input: {
    name?: string | null;
    startedAt: Date;
    initialInjectionIsk?: string;
  }) {
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

  /**
   * List all cycles
   */
  async listCycles() {
    return await this.prisma.cycle.findMany({ orderBy: { startedAt: 'desc' } });
  }

  /**
   * Close a cycle (marks packages as completed)
   */
  async closeCycle(cycleId: string, closedAt: Date) {
    // Mark all active packages as completed before closing cycle
    await this.packages.completePackagesForCycle(cycleId);

    return await this.prisma.cycle.update({
      where: { id: cycleId },
      data: { closedAt },
    });
  }

  /**
   * Get cycle by ID
   */
  async getCycleById(cycleId: string) {
    return await this.prisma.cycle.findUnique({
      where: { id: cycleId },
    });
  }

  /**
   * Get open cycle ID for a specific date (facade for external services)
   */
  async getOpenCycleIdForDate(date: Date): Promise<string> {
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
      if (!latest) throw new Error('No cycles found');
      return latest.id;
    }
    return cycle.id;
  }

  /**
   * Append a ledger entry to a cycle
   */
  async appendEntry(input: {
    cycleId: string;
    entryType: string;
    amountIsk: string;
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

  /**
   * List ledger entries for a cycle
   */
  async listEntries(cycleId: string) {
    return await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  /**
   * Create a new cycle with initial capital computation and opening balance lines
   */
  async createCycle(input: {
    name?: string | null;
    startedAt: Date;
    initialInjectionIsk?: string;
  }) {
    // Compute current capital (carryover) and store initial total capital
    const nowCap = await this.capitalService.computeCurrentCapitalNow();
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

    // Quantities and prices from active sell orders only
    const qtyByTypeStation = new Map<string, number>();
    const sellPriceByTypeStation = new Map<string, number>();
    const tracked = await this.characterService.getTrackedSellerIds();
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
            const existingPrice = sellPriceByTypeStation.get(k2);
            if (!existingPrice || o.price < existingPrice) {
              sellPriceByTypeStation.set(k2, o.price);
            }
          }
        }
      } catch (e) {
        this.logger.warn(`Orders fetch failed for ${cid}: ${String(e)}`);
      }
    }

    // Jita region for fallback pricing
    const jitaRegionId = await this.gameData.getJitaRegionId();
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

    // Create Opening Balance cycle lines with carryover items
    const lines: Array<{
      typeId: number;
      sourceStationId: number;
      destinationStationId: number;
      plannedUnits: number;
      currentSellPriceIsk: number | null;
    }> = [];
    for (const [k2, qty] of qtyByTypeStation) {
      const [sidStr, tidStr] = k2.split(':');
      const stationId = Number(sidStr);
      const typeId = Number(tidStr);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const currentSellPrice = sellPriceByTypeStation.get(k2) ?? null;
      lines.push({
        typeId,
        sourceStationId: stationId,
        destinationStationId: stationId,
        plannedUnits: Math.floor(qty),
        currentSellPriceIsk: currentSellPrice,
      });
      if (lines.length >= 1000) break;
    }

    if (lines.length) {
      await this.prisma.cycleLine.createMany({
        data: lines.map((l) => ({
          cycleId: cycle.id,
          typeId: l.typeId,
          destinationStationId: l.destinationStationId,
          plannedUnits: l.plannedUnits,
          unitsBought: l.plannedUnits,
          buyCostIsk: '0.00',
          currentSellPriceIsk: l.currentSellPriceIsk
            ? l.currentSellPriceIsk.toFixed(2)
            : null,
        })),
      });
      this.logger.log(
        `Created ${lines.length} opening balance cycle lines for cycle ${cycle.id}`,
      );
    }

    return cycle;
  }

  /**
   * Open a planned cycle (with transaction)
   */
  async openPlannedCycle(input: { cycleId: string; startedAt?: Date }) {
    const now = new Date();
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: input.cycleId },
    });
    if (!cycle) throw new Error('Cycle not found');

    // All database operations within a transaction
    return await this.prisma.$transaction(async (tx) => {
      // Clean up unpaid and refunded participations
      await tx.cycleParticipation.deleteMany({
        where: {
          cycleId: input.cycleId,
          status: { in: ['AWAITING_INVESTMENT', 'REFUNDED'] },
        },
      });

      // Close any existing open cycle
      const open = await this.getCurrentOpenCycle();
      if (open && open.id !== cycle.id) {
        await tx.cycle.update({
          where: { id: open.id },
          data: { closedAt: now },
        });
      }

      // Set startedAt if provided
      const startedAt =
        input.startedAt ?? (cycle.startedAt > now ? now : cycle.startedAt);
      if (startedAt.getTime() !== cycle.startedAt.getTime()) {
        await tx.cycle.update({
          where: { id: cycle.id },
          data: { startedAt },
        });
      }

      // Sum validated participations
      const validatedParticipations = await tx.cycleParticipation.aggregate({
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

      // Compute initial capital
      const nowCap = await this.capitalService.computeCurrentCapitalNow();
      const inj = cycle.initialInjectionIsk
        ? Number(cycle.initialInjectionIsk)
        : 0;
      const initialCapital =
        nowCap.cash + nowCap.inventory + inj + participationTotal;
      await tx.cycle.update({
        where: { id: cycle.id },
        data: { initialCapitalIsk: initialCapital.toFixed(2) },
      });

      // Create rollover cycle lines from active sell orders
      const key = (stationId: number, typeId: number) =>
        `${stationId}:${typeId}`;
      const qtyByTypeStation = new Map<string, number>();
      const sellPriceByTypeStation = new Map<string, number>();
      const trackedChars = await this.characterService.getTrackedSellerIds();

      for (const cid of trackedChars) {
        try {
          const orders = await this.esiChars.getOrders(cid);
          for (const o of orders) {
            if (!o.is_buy_order) {
              const k2 = key(o.location_id, o.type_id);
              qtyByTypeStation.set(
                k2,
                (qtyByTypeStation.get(k2) ?? 0) + o.volume_remain,
              );
              const existingPrice = sellPriceByTypeStation.get(k2);
              if (!existingPrice || o.price < existingPrice) {
                sellPriceByTypeStation.set(k2, o.price);
              }
            }
          }
        } catch (e) {
          this.logger.warn(`Orders fetch failed for ${cid}: ${String(e)}`);
        }
      }

      const rolloverLines: Array<{
        typeId: number;
        destinationStationId: number;
        plannedUnits: number;
        currentSellPriceIsk: number | null;
      }> = [];

      for (const [k2, qty] of qtyByTypeStation) {
        const [sidStr, tidStr] = k2.split(':');
        const stationId = Number(sidStr);
        const typeId = Number(tidStr);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const currentSellPrice = sellPriceByTypeStation.get(k2) ?? null;
        rolloverLines.push({
          typeId,
          destinationStationId: stationId,
          plannedUnits: Math.floor(qty),
          currentSellPriceIsk: currentSellPrice,
        });
        if (rolloverLines.length >= 1000) break;
      }

      if (rolloverLines.length) {
        await tx.cycleLine.createMany({
          data: rolloverLines.map((l) => ({
            cycleId: cycle.id,
            typeId: l.typeId,
            destinationStationId: l.destinationStationId,
            plannedUnits: l.plannedUnits,
            unitsBought: l.plannedUnits,
            buyCostIsk: '0.00',
            currentSellPriceIsk: l.currentSellPriceIsk
              ? l.currentSellPriceIsk.toFixed(2)
              : null,
          })),
        });
        this.logger.log(
          `Created ${rolloverLines.length} rollover cycle lines for cycle ${cycle.id}`,
        );
      }

      return await tx.cycle.findUnique({ where: { id: cycle.id } });
    });
  }

  /**
   * Orchestrate full cycle closing: wallet import → allocation → close → payouts
   */
  async closeCycleWithFinalSettlement(
    cycleId: string,
    walletService: { importAllLinked: () => Promise<unknown> },
    allocationService: {
      allocateAll: (cycleId?: string) => Promise<{
        buysAllocated: number;
        sellsAllocated: number;
        unmatchedBuys: number;
        unmatchedSells: number;
      }>;
    },
  ): Promise<unknown> {
    this.logger.log(
      `Closing cycle ${cycleId} - running final wallet import and allocation`,
    );

    await walletService.importAllLinked();
    this.logger.log(`Wallet import completed for cycle ${cycleId}`);

    const allocationResult = await allocationService.allocateAll(cycleId);
    this.logger.log(
      `Allocation completed for cycle ${cycleId}: buys=${allocationResult.buysAllocated}, sells=${allocationResult.sellsAllocated}`,
    );

    const closedCycle = await this.closeCycle(cycleId, new Date());
    this.logger.log(`Cycle ${cycleId} closed successfully`);

    try {
      const payouts = await this.payoutService.createPayouts(cycleId);
      this.logger.log(`Created ${payouts.length} payouts for cycle ${cycleId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to create payouts for cycle ${cycleId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return closedCycle;
  }

  /**
   * Get overview of current and next cycles with stats
   */
  async getCycleOverview(): Promise<{
    current: null | {
      id: string;
      name: string | null;
      startedAt: string;
      endsAt: string | null;
      status: 'Open' | 'Closed' | 'Planned';
      profit: {
        current: number;
        estimated: number;
        portfolioValue: number;
      };
      capital: {
        cash: number;
        inventory: number;
        total: number;
      };
      initialCapitalIsk: number;
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
      profit: {
        current: number;
        estimated: number;
        portfolioValue: number;
      };
      capital: {
        cash: number;
        inventory: number;
        total: number;
      };
      initialCapitalIsk: number;
      participantCount: number;
      totalInvestorCapital: number;
    } = null;

    if (current) {
      const [portfolioData, estimatedData] = await Promise.all([
        this.profitService.computePortfolioValue(current.id),
        this.profitService.computeEstimatedProfit(current.id).catch(() => null),
      ]);

      const currentProfit = 0; // TODO: Get from portfolioData
      const inventoryValue = Number(portfolioData.totalValue);
      const portfolioValue = Number(portfolioData.totalValue);
      const estimatedProfit = estimatedData
        ? Number(estimatedData.estimatedTotalProfit)
        : currentProfit;

      const initial = current.initialCapitalIsk
        ? Number(current.initialCapitalIsk)
        : 0;

      const endsAt = next
        ? next.startedAt.toISOString()
        : new Date(
            current.startedAt.getTime() + 14 * 24 * 60 * 60 * 1000,
          ).toISOString();

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

      const cash = initial + currentProfit;
      const totalCapital = cash + inventoryValue;

      currentOut = {
        id: current.id,
        name: current.name ?? null,
        startedAt: current.startedAt.toISOString(),
        endsAt,
        status: 'Open',
        profit: {
          current: currentProfit,
          estimated: estimatedProfit,
          portfolioValue: portfolioValue,
        },
        capital: {
          cash: cash,
          inventory: inventoryValue,
          total: totalCapital,
        },
        initialCapitalIsk: initial,
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

  /**
   * List ledger entries with enrichment
   */
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
    });

    return rows.map((r) => ({
      id: r.id,
      occurredAt: r.occurredAt,
      entryType: r.entryType,
      amount: String(r.amount),
      memo: r.memo,
      participationId: r.participationId,
    }));
  }
}

