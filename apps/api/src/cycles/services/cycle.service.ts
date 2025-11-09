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
import {
  CAPITAL_CONSTANTS,
  computeCostBasisPositions,
  createJitaPriceFetcher,
} from '../utils/capital-helpers';

/**
 * CycleService handles core cycle lifecycle management.
 *
 * Responsibilities:
 * - Cycle CRUD operations (create, plan, list)
 * - Cycle state transitions (open, close)
 * - Ledger entry management
 * - Cycle overview and enrichment
 * - Opening balance line creation from carryover inventory
 *
 * Orchestrates:
 * - Capital computation (via CapitalService)
 * - Payout creation (via PayoutService)
 * - Profit calculations (via ProfitService)
 * - Package completion (via PackageService)
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
   * Create a new cycle with initial capital computation and opening balance lines.
   *
   * Process:
   * 1. Compute initial capital (current capital + injection)
   * 2. Create cycle record
   * 3. Build cost basis positions from wallet transactions
   * 4. Query active sell orders for current inventory
   * 5. Create opening balance cycle lines for carryover items
   *
   * @param input - Cycle creation parameters
   * @returns Created cycle
   */
  async createCycle(input: {
    name?: string | null;
    startedAt: Date;
    initialInjectionIsk?: string;
  }) {
    // 1) Compute current capital (carryover) and store initial total capital
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

    // 2) Build weighted-average cost positions from transactions
    const byTypeStation = await computeCostBasisPositions(this.prisma);
    const key = (stationId: number, typeId: number) => `${stationId}:${typeId}`;

    // 3) Query active sell orders for current inventory quantities and prices
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
            // Track lowest sell price per type/station
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

    // 4) Setup Jita price fallback (for items without sell orders)
    const jitaRegionId = await this.gameData.getJitaRegionId();
    const getJitaPrice = createJitaPriceFetcher(this.esi, jitaRegionId);

    // 5) Create Opening Balance cycle lines with carryover items
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

      // Limit to prevent excessive database operations
      if (lines.length >= CAPITAL_CONSTANTS.MAX_ROLLOVER_LINES) break;
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
   * Open a planned cycle for active trading.
   *
   * Process (within transaction):
   * 1. Clean up unpaid/refunded participations
   * 2. Close any existing open cycle
   * 3. Set startedAt to now if in future
   * 4. Compute initial capital (carryover + injection + validated participations)
   * 5. Create rollover cycle lines from active sell orders
   *
   * @param input - Cycle ID and optional start date override
   * @returns Opened cycle with initial capital set
   * @throws Error if cycle not found
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
        // Limit to prevent excessive database operations
        if (rolloverLines.length >= CAPITAL_CONSTANTS.MAX_ROLLOVER_LINES) break;
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
   * Orchestrate full cycle closing with final settlement.
   *
   * Steps:
   * 1. Import all linked wallet transactions
   * 2. Allocate transactions to cycle lines
   * 3. Close the cycle
   * 4. Create payouts for participants
   *
   * @param cycleId - Cycle to close
   * @param walletService - Wallet service for transaction import
   * @param allocationService - Allocation service for transaction matching
   * @returns Closed cycle
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
            current.startedAt.getTime() +
              CAPITAL_CONSTANTS.DEFAULT_CYCLE_DURATION_MS,
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
      take: Math.min(
        Math.max(limit ?? CAPITAL_CONSTANTS.DEFAULT_ENTRIES_PER_PAGE, 1),
        CAPITAL_CONSTANTS.MAX_ENTRIES_PER_PAGE,
      ),
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
