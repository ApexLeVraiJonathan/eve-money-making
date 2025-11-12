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
   * 4. Compute initial capital from investor participations only (no wallet ISK)
   * 5. Create rollover cycle lines from active sell orders with linkage to previous cycle
   *
   * After transaction:
   * 6. Process rollover purchase (synthetic buy allocations at cost basis)
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

    // Get previous closed cycle for rollover linkage
    const prevCycle = await this.prisma.cycle.findFirst({
      where: { closedAt: { not: null } },
      orderBy: { closedAt: 'desc' },
      select: { id: true },
    });

    // Build map of previous cycle lines for reference (including current sell prices)
    const prevCycleLines = prevCycle
      ? await this.prisma.cycleLine.findMany({
          where: { cycleId: prevCycle.id },
          select: {
            id: true,
            typeId: true,
            destinationStationId: true,
            currentSellPriceIsk: true,
          },
        })
      : [];

    const prevLineMap = new Map(
      prevCycleLines.map((l) => [
        `${l.destinationStationId}:${l.typeId}`,
        {
          lineId: l.id,
          currentSellPrice: l.currentSellPriceIsk
            ? Number(l.currentSellPriceIsk)
            : null,
        },
      ]),
    );

    // All database operations within a transaction
    const openedCycle = await this.prisma.$transaction(async (tx) => {
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

      // NEW: Initial capital = investor participations ONLY (no wallet ISK)
      // Rollover purchase cost will be deducted from this capital after transaction
      const inj = cycle.initialInjectionIsk
        ? Number(cycle.initialInjectionIsk)
        : 0;
      const initialCapital = participationTotal + inj;
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
        rolloverFromLineId: string | null;
      }> = [];

      for (const [k2, qty] of qtyByTypeStation) {
        const [sidStr, tidStr] = k2.split(':');
        const stationId = Number(sidStr);
        const typeId = Number(tidStr);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        // Get current sell price from ESI orders (active price)
        const currentSellPrice = sellPriceByTypeStation.get(k2) ?? null;

        // Get previous line info for linkage
        const prevLineInfo = prevLineMap.get(k2);

        rolloverLines.push({
          typeId,
          destinationStationId: stationId,
          plannedUnits: Math.floor(qty),
          // Use ESI sell price if available, otherwise use previous cycle's price
          currentSellPriceIsk:
            currentSellPrice ?? prevLineInfo?.currentSellPrice ?? null,
          rolloverFromLineId: prevLineInfo?.lineId ?? null,
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
            buyCostIsk: '0.00', // Will be set by processRolloverPurchase
            currentSellPriceIsk: l.currentSellPriceIsk
              ? l.currentSellPriceIsk.toFixed(2)
              : null,
            // NEW: Mark as rollover and link to previous cycle
            isRollover: true,
            rolloverFromCycleId: prevCycle?.id ?? null,
            rolloverFromLineId: l.rolloverFromLineId,
          })),
        });
        this.logger.log(
          `Created ${rolloverLines.length} rollover cycle lines for cycle ${cycle.id}`,
        );
      }

      return await tx.cycle.findUnique({ where: { id: cycle.id } });
    });

    // After transaction: Process rollover purchase (synthetic buy allocations)
    if (prevCycle) {
      const rolloverResult = await this.processRolloverPurchase(
        cycle.id,
        prevCycle.id,
      );
      this.logger.log(
        `Rollover purchase completed: ${rolloverResult.itemsRolledOver} items, ` +
          `${rolloverResult.totalRolloverCostIsk.toFixed(2)} ISK deducted from capital`,
      );
    }

    return openedCycle;
  }

  /**
   * Process rollover buyback: "Buy back" all remaining inventory at cost basis
   * to realize profit and prepare for next cycle rollover.
   *
   * This allows cycles to close with all units accounted for (unitsSold = unitsBought)
   * and enables full profit realization without locking capital in inventory.
   *
   * Admin pays for remaining inventory at cost, then receives it back when next cycle opens.
   *
   * @param cycleId - Cycle to process buyback for
   * @returns Buyback summary (items count and total ISK)
   */
  private async processRolloverBuyback(cycleId: string): Promise<{
    itemsBoughtBack: number;
    totalBuybackIsk: number;
  }> {
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

    let totalBuyback = 0;
    let itemsProcessed = 0;

    for (const line of lines) {
      const remainingUnits = line.unitsBought - line.unitsSold;
      if (remainingUnits <= 0) continue;

      const wac =
        line.unitsBought > 0 ? Number(line.buyCostIsk) / line.unitsBought : 0;
      const buybackAmount = wac * remainingUnits;

      // Create synthetic sell allocation for buyback (no wallet transaction)
      await this.prisma.sellAllocation.create({
        data: {
          lineId: line.id,
          walletCharacterId: null,
          walletTransactionId: null,
          isRollover: true,
          quantity: remainingUnits,
          unitPrice: wac,
          revenueIsk: buybackAmount,
          taxIsk: 0, // No tax on admin buyback
        },
      });

      // Update cycle line with buyback "sale"
      await this.prisma.cycleLine.update({
        where: { id: line.id },
        data: {
          unitsSold: { increment: remainingUnits },
          salesGrossIsk: { increment: buybackAmount },
          salesNetIsk: { increment: buybackAmount }, // No tax
        },
      });

      totalBuyback += buybackAmount;
      itemsProcessed++;
    }

    this.logger.log(
      `[Rollover Buyback] Processed ${itemsProcessed} line items, ${totalBuyback.toFixed(2)} ISK`,
    );

    return {
      itemsBoughtBack: itemsProcessed,
      totalBuybackIsk: totalBuyback,
    };
  }

  /**
   * Process rollover purchase: "Buy" inventory from previous cycle
   * at the buyback price (original cost basis).
   *
   * This creates synthetic buy allocations for rollover items, allowing
   * the new cycle to start with inventory at proper cost basis.
   *
   * The rollover cost is deducted from investor capital (cycle "spends" ISK
   * to acquire inventory from admin who held it between cycles).
   *
   * @param newCycleId - New cycle receiving rollover inventory
   * @param previousCycleId - Previous cycle that was closed
   * @returns Rollover summary (items count and total cost ISK)
   */
  private async processRolloverPurchase(
    newCycleId: string,
    previousCycleId: string,
  ): Promise<{
    itemsRolledOver: number;
    totalRolloverCostIsk: number;
  }> {
    // Get rollover lines from new cycle (created in openPlannedCycle)
    const rolloverLines = await this.prisma.cycleLine.findMany({
      where: {
        cycleId: newCycleId,
        isRollover: true,
        rolloverFromCycleId: previousCycleId,
      },
      select: {
        id: true,
        typeId: true,
        destinationStationId: true,
        unitsBought: true, // Set from active sell orders
        rolloverFromLineId: true,
      },
    });

    let totalCost = 0;
    let itemsProcessed = 0;

    for (const line of rolloverLines) {
      if (!line.rolloverFromLineId) {
        this.logger.warn(
          `[Rollover Purchase] Line ${line.id} has no rolloverFromLineId, skipping`,
        );
        continue;
      }

      // Get original cost basis from previous cycle line
      const prevLine = await this.prisma.cycleLine.findUnique({
        where: { id: line.rolloverFromLineId },
        select: { unitsBought: true, buyCostIsk: true },
      });

      if (!prevLine) {
        this.logger.warn(
          `[Rollover Purchase] Previous line ${line.rolloverFromLineId} not found, skipping`,
        );
        continue;
      }

      const wac =
        prevLine.unitsBought > 0
          ? Number(prevLine.buyCostIsk) / prevLine.unitsBought
          : 0;
      const rolloverCost = wac * line.unitsBought;

      // Create synthetic buy allocation (no wallet transaction)
      await this.prisma.buyAllocation.create({
        data: {
          lineId: line.id,
          walletCharacterId: null,
          walletTransactionId: null,
          isRollover: true,
          quantity: line.unitsBought,
          unitPrice: wac,
        },
      });

      // Update cycle line with rollover "purchase" cost
      await this.prisma.cycleLine.update({
        where: { id: line.id },
        data: {
          buyCostIsk: rolloverCost,
        },
      });

      totalCost += rolloverCost;
      itemsProcessed++;
    }

    this.logger.log(
      `[Rollover Purchase] Processed ${itemsProcessed} items, ${totalCost.toFixed(2)} ISK cost`,
    );

    return {
      itemsRolledOver: itemsProcessed,
      totalRolloverCostIsk: totalCost,
    };
  }

  /**
   * Orchestrate full cycle closing with final settlement.
   *
   * Steps:
   * 1. Import all linked wallet transactions
   * 2. Allocate transactions to cycle lines
   * 3. Process rollover buyback (admin buys remaining inventory)
   * 4. Close the cycle
   * 5. Create payouts for participants
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

    // Process rollover buyback BEFORE closing cycle
    const buybackResult = await this.processRolloverBuyback(cycleId);
    this.logger.log(
      `Buyback completed: ${buybackResult.itemsBoughtBack} items, ${buybackResult.totalBuybackIsk.toFixed(2)} ISK`,
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
