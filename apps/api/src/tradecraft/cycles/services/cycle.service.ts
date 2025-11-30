import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { PackageService } from '@api/tradecraft/market/services/package.service';
import { CapitalService } from './capital.service';
import { PayoutService } from './payout.service';
import { ProfitService } from './profit.service';
import { EsiCharactersService } from '@api/esi/esi-characters.service';
import { EsiService } from '@api/esi/esi.service';
import { GameDataService } from '@api/game-data/services/game-data.service';
import { CharacterService } from '@api/characters/services/character.service';
import { NotificationService } from '@api/notifications/notification.service';
import {
  CAPITAL_CONSTANTS,
  computeCostBasisPositions,
  createJitaPriceFetcher,
} from '../utils/capital-helpers';
import { fetchStationOrders } from '@api/esi/market-helpers';

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
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Get the current open cycle (status = OPEN)
   */
  async getCurrentOpenCycle() {
    return await this.prisma.cycle.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Get the next planned cycle (status = PLANNED)
   */
  async getNextPlannedCycle() {
    return await this.prisma.cycle.findFirst({
      where: { status: 'PLANNED' },
      orderBy: { startedAt: 'asc' },
    });
  }

  /**
   * Plan a future cycle
   */
  async planCycle(input: {
    name?: string | null;
    startedAt: Date;
    initialInjectionIsk?: string;
  }) {
    const cycle = await this.prisma.cycle.create({
      data: {
        name: input.name ?? null,
        startedAt: input.startedAt,
        initialInjectionIsk: input.initialInjectionIsk
          ? input.initialInjectionIsk
          : null,
      },
    });
    // Fire user notifications (best-effort, non-blocking)
    void this.notifications
      .notifyCyclePlanned(cycle.id)
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to send cycle planned notifications: ${String(err)}`,
        ),
      );
    return cycle;
  }

  /**
   * List all cycles
   */
  async listCycles() {
    return await this.prisma.cycle.findMany({ orderBy: { startedAt: 'desc' } });
  }

  /**
   * Get public cycle history with profit metrics (for completed cycles only)
   */
  async getCycleHistory() {
    const completedCycles = await this.prisma.cycle.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        name: true,
        startedAt: true,
        closedAt: true,
        status: true,
        initialCapitalIsk: true,
      },
    });

    // Get profit and participation data for each cycle
    const history = await Promise.all(
      completedCycles.map(async (cycle: any) => {
        // Get profit data
        const profitData = await this.profitService.computeCycleProfit(
          cycle.id,
        );
        const profit = Number(profitData.cycleProfitCash);
        const initialCapital = Number(cycle.initialCapitalIsk);
        const roi = initialCapital > 0 ? (profit / initialCapital) * 100 : 0;

        // Get participation count (but not individual details)
        const participationCount = await this.prisma.cycleParticipation.count({
          where: { cycleId: cycle.id },
        });

        // Calculate duration
        const durationDays = cycle.closedAt
          ? Math.ceil(
              (new Date(cycle.closedAt).getTime() -
                new Date(cycle.startedAt).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;

        return {
          id: cycle.id,
          name: cycle.name,
          startedAt: cycle.startedAt.toISOString(),
          closedAt: cycle.closedAt?.toISOString() ?? null,
          status: cycle.status,
          initialCapitalIsk: cycle.initialCapitalIsk,
          profitIsk: profit.toFixed(2),
          roiPercent: roi.toFixed(2),
          participantCount: participationCount,
          durationDays,
        };
      }),
    );

    return history;
  }

  /**
   * Close a cycle (marks packages as completed)
   */
  async closeCycle(cycleId: string, closedAt: Date) {
    // Mark all active packages as completed before closing cycle
    await this.packages.completePackagesForCycle(cycleId);

    return await this.prisma.cycle.update({
      where: { id: cycleId },
      data: {
        status: 'COMPLETED',
        closedAt,
      },
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
          // Opening balance items come from active sell orders and should be
          // treated as already listed on the market.
          listedUnits: l.plannedUnits,
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
   * 5. Create rollover cycle lines from active sell orders with proper buyCostIsk:
   *    - If previous cycle has buy cost: use WAC from previous cycle
   *    - If no buy cost: fetch Jita sell price and use as buy cost
   *
   * After transaction:
   * 6. Process rollover purchase (synthetic buy allocations at cost basis)
   *
   * @param input - Cycle ID and optional start date override
   * @returns Opened cycle with initial capital set
   * @throws Error if cycle not found
   */
  async openPlannedCycle(
    input: { cycleId: string; startedAt?: Date },
    allocationService?: {
      allocateAll: (cycleId?: string) => Promise<{
        buysAllocated: number;
        sellsAllocated: number;
        unmatchedBuys: number;
        unmatchedSells: number;
      }>;
    },
  ) {
    const now = new Date();
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: input.cycleId },
    });
    if (!cycle) throw new Error('Cycle not found');

    // Check if there's a currently open cycle (which we'll close and rollover from)
    const previousCycleToClose = await this.getCurrentOpenCycle();

    // Build rollover lines list
    const rolloverLinesTemp: Array<{
      typeId: number;
      destinationStationId: number;
      plannedUnits: number;
      currentSellPriceIsk: number | null;
      rolloverFromLineId: string | null;
      buyCostIsk: number;
    }> = [];

    if (previousCycleToClose && previousCycleToClose.id !== cycle.id) {
      // SCENARIO: Subsequent cycle - rollover from previous cycle's remaining inventory
      this.logger.log(
        `[Rollover] Creating rollover lines from previous cycle ${previousCycleToClose.id}`,
      );

      const prevLines = await this.prisma.cycleLine.findMany({
        where: { cycleId: previousCycleToClose.id },
        select: {
          id: true,
          typeId: true,
          destinationStationId: true,
          unitsBought: true,
          unitsSold: true,
          buyCostIsk: true,
          currentSellPriceIsk: true,
        },
      });

      for (const prevLine of prevLines) {
        const remainingUnits = prevLine.unitsBought - prevLine.unitsSold;
        if (remainingUnits > 0) {
          const wac =
            prevLine.unitsBought > 0
              ? Number(prevLine.buyCostIsk) / prevLine.unitsBought
              : 0;

          rolloverLinesTemp.push({
            typeId: prevLine.typeId,
            destinationStationId: prevLine.destinationStationId,
            plannedUnits: remainingUnits,
            currentSellPriceIsk: prevLine.currentSellPriceIsk
              ? Number(prevLine.currentSellPriceIsk)
              : null,
            rolloverFromLineId: prevLine.id,
            buyCostIsk: wac, // Store unit WAC for Jita fallback check
          });
        }
      }

      this.logger.log(
        `[Rollover] Found ${rolloverLinesTemp.length} items with remaining inventory`,
      );
    } else {
      // SCENARIO: First cycle - fetch from ESI sell orders
      this.logger.log(
        `[Rollover] No previous cycle - fetching initial inventory from ESI`,
      );

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

      for (const [k2, qty] of qtyByTypeStation) {
        const [sidStr, tidStr] = k2.split(':');
        const stationId = Number(sidStr);
        const typeId = Number(tidStr);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const currentSellPrice = sellPriceByTypeStation.get(k2) ?? null;

        rolloverLinesTemp.push({
          typeId,
          destinationStationId: stationId,
          plannedUnits: Math.floor(qty),
          currentSellPriceIsk: currentSellPrice,
          rolloverFromLineId: null, // No previous line for first cycle
          buyCostIsk: 0, // Will need Jita fallback
        });

        if (rolloverLinesTemp.length >= CAPITAL_CONSTANTS.MAX_ROLLOVER_LINES)
          break;
      }

      this.logger.log(
        `[Rollover] Found ${rolloverLinesTemp.length} items from ESI sell orders`,
      );
    }

    // Pre-fetch Jita prices for items without buy cost (OUTSIDE transaction)
    const jitaPriceMap = new Map<number, number>();
    if (rolloverLinesTemp.length > 0) {
      const itemsNeedingJitaPrices = new Set<number>();
      for (const l of rolloverLinesTemp) {
        // If buyCostIsk is 0, we need Jita fallback
        if (l.buyCostIsk === 0) {
          itemsNeedingJitaPrices.add(l.typeId);
        }
      }

      if (itemsNeedingJitaPrices.size > 0) {
        this.logger.log(
          `[Jita Fallback] Fetching Jita prices for ${itemsNeedingJitaPrices.size} items...`,
        );
        const jitaPricePromises = Array.from(itemsNeedingJitaPrices).map(
          async (typeId) => {
            const price = await this.fetchJitaCheapestSell(typeId);
            return { typeId, price };
          },
        );
        const jitaPrices = await Promise.all(jitaPricePromises);
        for (const { typeId, price } of jitaPrices) {
          if (price) jitaPriceMap.set(typeId, price);
        }
      }
    }

    // Auto-close previous cycle BEFORE transaction (if allocation service provided)
    // Note: previousCycleToClose was already fetched above for rollover logic
    if (
      previousCycleToClose &&
      previousCycleToClose.id !== cycle.id &&
      allocationService
    ) {
      this.logger.log(`Auto-closing previous cycle ${previousCycleToClose.id}`);

      // 1. Run final allocation
      const allocationResult = await allocationService.allocateAll(
        previousCycleToClose.id,
      );
      this.logger.log(
        `Allocation: buys=${allocationResult.buysAllocated}, sells=${allocationResult.sellsAllocated}`,
      );

      // 2. Process rollover buyback (creates synthetic sell allocations)
      const buybackResult = await this.processRolloverBuyback(
        previousCycleToClose.id,
      );
      this.logger.log(
        `Buyback: ${buybackResult.itemsBoughtBack} items, ${buybackResult.totalBuybackIsk.toFixed(2)} ISK`,
      );

      // 3. Try to create payouts (non-blocking)
      try {
        this.logger.log(
          `Creating payouts for cycle ${previousCycleToClose.id}...`,
        );
        const payouts = await this.payoutService.createPayouts(
          previousCycleToClose.id,
        );
        this.logger.log(
          `✓ Created ${payouts.length} payouts for cycle ${previousCycleToClose.id}`,
        );
        if (payouts.length > 0) {
          const totalPayout = payouts.reduce(
            (sum, p) => sum + Number(p.payoutIsk),
            0,
          );
          this.logger.log(
            `  Total payout amount: ${totalPayout.toFixed(2)} ISK`,
          );
        }
      } catch (error) {
        this.logger.error(
          `❌ Payout creation failed for cycle ${previousCycleToClose.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (error instanceof Error && error.stack) {
          this.logger.error(error.stack);
        }
      }

      // 4. Process rollover participations
      try {
        this.logger.log(
          `Processing rollovers for cycle ${previousCycleToClose.id}...`,
        );
        const rolloverResult = await this.payoutService.processRollovers(
          previousCycleToClose.id,
          input.cycleId, // Pass the cycle being opened as the target for rollovers
        );
        if (rolloverResult.processed > 0) {
          this.logger.log(
            `✓ Processed ${rolloverResult.processed} rollovers: ${rolloverResult.rolledOver} ISK rolled over, ${rolloverResult.paidOut} ISK paid out`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to process rollovers for cycle ${previousCycleToClose.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // All database operations within a transaction
    const openedCycle = await this.prisma.$transaction(async (tx: any) => {
      // Clean up unpaid and refunded participations
      // BUT: Keep rollover participations (they have rolloverType set)
      await tx.cycleParticipation.deleteMany({
        where: {
          cycleId: input.cycleId,
          status: { in: ['AWAITING_INVESTMENT', 'REFUNDED'] },
          rolloverType: null, // Only delete non-rollover participations
        },
      });

      // Close any existing open cycle (already handled before transaction if allocationService provided)
      const open = await this.getCurrentOpenCycle();
      if (open && open.id !== cycle.id) {
        this.logger.log(
          `Marking cycle ${open.id} as completed (already processed above)`,
        );

        // Mark all active packages as completed
        await tx.committedPackage.updateMany({
          where: {
            cycleId: open.id,
            status: 'active',
          },
          data: {
            status: 'completed',
          },
        });

        // Close the cycle
        await tx.cycle.update({
          where: { id: open.id },
          data: {
            status: 'COMPLETED',
            closedAt: now,
          },
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
        data: {
          status: 'OPEN',
          initialCapitalIsk: initialCapital.toFixed(2),
        },
      });

      // Create rollover cycle lines with pre-calculated buy costs
      if (rolloverLinesTemp.length) {
        const lineDataWithCosts: Array<{
          typeId: number;
          destinationStationId: number;
          plannedUnits: number;
          buyCostIsk: string;
          currentSellPriceIsk: string | null;
          rolloverFromLineId: string | null;
        }> = [];

        // Calculate total buy cost for each line
        for (const l of rolloverLinesTemp) {
          let totalBuyCost = 0;

          if (l.buyCostIsk > 0) {
            // Use WAC from previous cycle (already calculated as unit cost)
            totalBuyCost = l.buyCostIsk * l.plannedUnits;
          } else {
            // Use pre-fetched Jita price
            const jitaPrice = jitaPriceMap.get(l.typeId);
            if (jitaPrice) {
              totalBuyCost = jitaPrice * l.plannedUnits;
              this.logger.log(
                `[Jita Fallback] Type ${l.typeId}: ${jitaPrice.toFixed(2)} ISK/unit`,
              );
            } else {
              this.logger.error(
                `[Line Creation] Type ${l.typeId}: Missing buy cost and Jita price failed`,
              );
              totalBuyCost = 0;
            }
          }

          lineDataWithCosts.push({
            typeId: l.typeId,
            destinationStationId: l.destinationStationId,
            plannedUnits: l.plannedUnits,
            buyCostIsk: totalBuyCost.toFixed(2),
            currentSellPriceIsk: l.currentSellPriceIsk
              ? l.currentSellPriceIsk.toFixed(2)
              : null,
            rolloverFromLineId: l.rolloverFromLineId,
          });
        }

        // Bulk create with pre-calculated costs (1 DB operation)
        await tx.cycleLine.createMany({
          data: lineDataWithCosts.map((l) => ({
            cycleId: cycle.id,
            typeId: l.typeId,
            destinationStationId: l.destinationStationId,
            plannedUnits: l.plannedUnits,
            unitsBought: l.plannedUnits,
            // Rollover inventory corresponds to already-listed market orders,
            // so mark all rollover units as listed at cycle open.
            listedUnits: l.plannedUnits,
            buyCostIsk: l.buyCostIsk,
            currentSellPriceIsk: l.currentSellPriceIsk,
            // Mark as rollover and link to previous cycle
            isRollover: true,
            rolloverFromCycleId: previousCycleToClose?.id ?? null,
            rolloverFromLineId: l.rolloverFromLineId,
          })),
        });
        this.logger.log(
          `Created ${rolloverLinesTemp.length} rollover cycle lines for cycle ${cycle.id}`,
        );
      }

      return await tx.cycle.findUnique({ where: { id: cycle.id } });
    });

    // After transaction: Process rollover purchase (synthetic buy allocations)
    // Check if we actually have rollover lines (regardless of whether there's a previous cycle)
    const rolloverLineCount = await this.prisma.cycleLine.count({
      where: { cycleId: cycle.id, isRollover: true },
    });

    if (rolloverLineCount > 0) {
      const rolloverResult = await this.processRolloverPurchase(
        cycle.id,
        previousCycleToClose?.id ?? null,
      );

      // Log rollover completion (capital remains unchanged)
      if (rolloverResult.totalRolloverCostIsk > 0) {
        this.logger.log(
          `Rollover purchase completed: ${rolloverResult.itemsRolledOver} items, ` +
            `${rolloverResult.totalRolloverCostIsk.toFixed(2)} ISK in inventory from rollover`,
        );
      }
    }

    // Fire user notifications (best-effort, non-blocking)
    if (openedCycle?.id) {
      void this.notifications
        .notifyCycleStarted(openedCycle.id)
        .catch((err: unknown) =>
          this.logger.warn(
            `Failed to send cycle started notifications: ${String(err)}`,
          ),
        );
    }

    return openedCycle;
  }

  /**
   * Fetch the cheapest sell order price from Jita for a given type.
   * Used as fallback when an item has no buy cost data.
   *
   * @param typeId - EVE type ID
   * @returns Lowest sell price in ISK, or null if no orders found
   */
  private async fetchJitaCheapestSell(typeId: number): Promise<number | null> {
    const JITA_REGION_ID = 10000002; // The Forge
    const JITA_STATION_ID = 60003760; // Jita IV - Moon 4 - Caldari Navy Assembly Plant

    try {
      const orders = await fetchStationOrders(this.esi, {
        regionId: JITA_REGION_ID,
        stationId: JITA_STATION_ID,
        typeId,
        side: 'sell',
      });

      if (orders.length === 0) {
        return null;
      }

      // Find the lowest price
      const lowestPrice = Math.min(
        ...orders.map((o: { price: number }) => o.price),
      );
      return lowestPrice;
    } catch (error) {
      this.logger.error(
        `[Jita Price Fetch] Failed to fetch Jita sell price for type ${typeId}: ${error.message}`,
      );
      return null;
    }
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

      if (wac === 0) {
        this.logger.error(
          `[Rollover Buyback] Line ${line.id} (type ${line.typeId}) has no buy cost. This should not happen. Skipping.`,
        );
        continue;
      }

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
    previousCycleId: string | null,
  ): Promise<{
    itemsRolledOver: number;
    totalRolloverCostIsk: number;
  }> {
    // Get rollover lines from new cycle (created in openPlannedCycle)
    const rolloverLines = await this.prisma.cycleLine.findMany({
      where: {
        cycleId: newCycleId,
        isRollover: true,
        ...(previousCycleId ? { rolloverFromCycleId: previousCycleId } : {}),
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
      // Note: rolloverFromLineId can be null for items detected from game
      // that don't have a previous cycle line (e.g., first cycle in dev)

      // Get the buy cost that was set during line creation
      // (either from previous cycle WAC or Jita price)
      const currentLine = await this.prisma.cycleLine.findUnique({
        where: { id: line.id },
        select: {
          buyCostIsk: true,
          unitsBought: true,
        },
      });

      if (!currentLine) {
        this.logger.warn(
          `[Rollover Purchase] Current line ${line.id} not found, skipping`,
        );
        continue;
      }

      const wac =
        currentLine.unitsBought > 0
          ? Number(currentLine.buyCostIsk) / currentLine.unitsBought
          : 0;

      if (wac === 0) {
        this.logger.error(
          `[Rollover Purchase] Line ${line.id} (type ${line.typeId}) has no buy cost. This should not happen. Skipping.`,
        );
        continue;
      }

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

    // Process rollover participations
    try {
      const rolloverResult = await this.payoutService.processRollovers(cycleId);
      if (rolloverResult.processed > 0) {
        this.logger.log(
          `Processed ${rolloverResult.processed} rollovers: ${rolloverResult.rolledOver} ISK rolled over, ${rolloverResult.paidOut} ISK paid out`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to process rollovers for cycle ${cycleId}: ${error instanceof Error ? error.message : String(error)}`,
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
    const [current, next] = await Promise.all([
      this.getCurrentOpenCycle(),
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
      const [portfolioData, estimatedData, profitData] = await Promise.all([
        this.profitService.computePortfolioValue(current.id),
        this.profitService.computeEstimatedProfit(current.id).catch(() => null),
        this.profitService.computeCycleProfit(current.id),
      ]);

      const currentProfit = Number(profitData.cycleProfitCash);
      const inventoryValue = Number(portfolioData.inventoryValueAtCost);
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
        (sum: number, p: { amountIsk: unknown }) => sum + Number(p.amountIsk),
        0,
      );

      // Portfolio = Starting Capital + Profit
      const totalCapital = initial + currentProfit;
      // Cash = Portfolio - Inventory
      const cash = totalCapital - inventoryValue;

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

    return rows.map((r: any) => ({
      id: r.id,
      occurredAt: r.occurredAt,
      entryType: r.entryType,
      amount: String(r.amount),
      memo: r.memo,
      participationId: r.participationId,
    }));
  }
}
