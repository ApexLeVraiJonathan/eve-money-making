import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { PackageService } from '@api/tradecraft/market/services/package.service';
import { CapitalService } from './capital.service';
import { ProfitService } from './profit.service';
import { EsiCharactersService } from '@api/esi/esi-characters.service';
import { EsiService } from '@api/esi/esi.service';
import { GameDataService } from '@api/game-data/services/game-data.service';
import { CharacterService } from '@api/characters/services/character.service';
import { NotificationService } from '@api/notifications/notification.service';
import { CycleRolloverService } from './cycle-rollover.service';
import { Prisma } from '@eve/prisma';
import {
  CAPITAL_CONSTANTS,
  computeCostBasisPositions,
  createJitaPriceFetcher,
} from '../utils/capital-helpers';
/**
 * CycleService handles cycle records, ledger entries, and cycle summaries.
 *
 * Responsibilities:
 * - Cycle CRUD operations (create, plan, list)
 * - Low-level cycle state persistence used by the Cycle Lifecycle Entry Point
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
    @Inject(forwardRef(() => ProfitService))
    private readonly profitService: ProfitService,
    private readonly esiChars: EsiCharactersService,
    private readonly esi: EsiService,
    private readonly gameData: GameDataService,
    private readonly characterService: CharacterService,
    private readonly notifications: NotificationService,
    private readonly rollovers: CycleRolloverService,
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

    try {
      await this.rollovers.seedPlannedCycleRollovers(cycle.id);
    } catch (err: unknown) {
      this.logger.warn(
        `[CycleRollover] Failed to seed rollovers for planned cycle ${cycle.id.substring(
          0,
          8,
        )}: ${String(err)}`,
      );
    }

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
      completedCycles.map(async (cycle) => {
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
    return await this.prisma.$transaction(async (tx) => {
      return await this.closeCycleInTransaction(tx, cycleId, closedAt);
    });
  }

  async closeCycleInTransaction(
    tx: Prisma.TransactionClient,
    cycleId: string,
    closedAt: Date,
  ) {
    await this.packages.completePackagesForCycleInTransaction(tx, cycleId);

    return await tx.cycle.update({
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
   * Update a cycle.
   *
   * Rules:
   * - PLANNED: can update name, startedAt, initialInjectionIsk
   * - OPEN/COMPLETED: can update name only (no timeline/capital mutations)
   */
  async updateCycle(
    cycleId: string,
    input: {
      name?: string;
      startedAt?: Date;
      initialInjectionIsk?: string;
    },
  ) {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    const isPlanned = cycle.status === 'PLANNED';
    const data: Record<string, unknown> = {};

    if (typeof input.name !== 'undefined') {
      data.name = input.name ?? null;
    }

    if (!isPlanned) {
      if (typeof input.startedAt !== 'undefined') {
        throw new BadRequestException(
          'startedAt can only be updated while cycle is PLANNED',
        );
      }
      if (typeof input.initialInjectionIsk !== 'undefined') {
        throw new BadRequestException(
          'initialInjectionIsk can only be updated while cycle is PLANNED',
        );
      }
    } else {
      if (typeof input.startedAt !== 'undefined')
        data.startedAt = input.startedAt;
      if (typeof input.initialInjectionIsk !== 'undefined') {
        data.initialInjectionIsk = input.initialInjectionIsk ?? null;
      }
    }

    if (Object.keys(data).length === 0) return cycle;

    return await this.prisma.cycle.update({
      where: { id: cycleId },
      data,
    });
  }

  /**
   * Delete a cycle.
   *
   * Safety:
   * - Only PLANNED cycles can be deleted
   * - Blocks deletion if referenced by a JingleYield program start/completion
   *
   * Note: cycle relations are mostly `onDelete: Cascade`, so this operation can
   * remove participations/lines/etc. Keep it admin-only.
   */
  async deletePlannedCycle(cycleId: string) {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    if (cycle.status !== 'PLANNED') {
      throw new BadRequestException('Only PLANNED cycles can be deleted');
    }

    const jyRefs = await this.prisma.jingleYieldProgram.count({
      where: {
        OR: [{ startCycleId: cycleId }, { completedCycleId: cycleId }],
      },
    });
    if (jyRefs > 0) {
      throw new BadRequestException(
        'Cycle is referenced by a JingleYield program and cannot be deleted',
      );
    }

    try {
      return await this.prisma.cycle.delete({ where: { id: cycleId } });
    } catch (err: unknown) {
      throw new BadRequestException(
        `Failed to delete cycle: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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
    const _byTypeStation = await computeCostBasisPositions(this.prisma);
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
    const _getJitaPrice = createJitaPriceFetcher(this.esi, jitaRegionId);

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
