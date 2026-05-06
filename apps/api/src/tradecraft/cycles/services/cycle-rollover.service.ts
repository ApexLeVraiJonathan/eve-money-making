import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { EsiCharactersService } from '@api/esi/esi-characters.service';
import { EsiService } from '@api/esi/esi.service';
import { CharacterService } from '@api/characters/services/character.service';
import { fetchStationOrders } from '@api/esi/market-helpers';
import { CAPITAL_CONSTANTS } from '../utils/capital-helpers';
import { PayoutService } from './payout.service';
import { ParticipationService } from './participation.service';

export type RolloverLineCandidate = {
  typeId: number;
  destinationStationId: number;
  plannedUnits: number;
  currentSellPriceIsk: number | null;
  rolloverFromLineId: string | null;
  buyCostIsk: number;
};

@Injectable()
export class CycleRolloverService {
  private readonly logger = new Logger(CycleRolloverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly esiChars: EsiCharactersService,
    private readonly esi: EsiService,
    private readonly characterService: CharacterService,
    private readonly payouts: PayoutService,
    private readonly participations: ParticipationService,
  ) {}

  /**
   * Ensure that users with AutoRolloverSettings enabled have a rollover
   * participation created in the target Cycle, even if the Cycle was planned
   * before they enabled auto-rollover.
   */
  private async ensureAutoRolloverParticipations(input: {
    closedCycleId: string;
    targetCycleId: string;
  }): Promise<{
    created: number;
    skippedExisting: number;
    skippedNoSource: number;
  }> {
    const { closedCycleId, targetCycleId } = input;

    const settings = await this.prisma.autoRolloverSettings.findMany({
      where: { enabled: true },
      select: { userId: true, defaultRolloverType: true },
    });

    if (settings.length === 0) {
      return { created: 0, skippedExisting: 0, skippedNoSource: 0 };
    }

    let created = 0;
    let skippedExisting = 0;
    let skippedNoSource = 0;

    for (const s of settings) {
      const type = s.defaultRolloverType;
      if (type !== 'FULL_PAYOUT' && type !== 'INITIAL_ONLY') continue;

      const existing = await this.prisma.cycleParticipation.findFirst({
        where: { cycleId: targetCycleId, userId: s.userId },
        select: { id: true },
      });
      if (existing) {
        skippedExisting++;
        continue;
      }

      const fromP = await this.prisma.cycleParticipation.findFirst({
        where: {
          cycleId: closedCycleId,
          userId: s.userId,
          status: { in: ['OPTED_IN', 'AWAITING_PAYOUT', 'COMPLETED'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          characterName: true,
          amountIsk: true,
          userPrincipalIsk: true,
          jingleYieldProgramId: true,
        },
      });

      if (!fromP) {
        skippedNoSource++;
        continue;
      }

      const rolloverTypeShort = type === 'FULL_PAYOUT' ? 'FULL' : 'INITIAL';
      const memo = `ROLLOVER-${targetCycleId.substring(0, 8)}-${fromP.id.substring(
        0,
        8,
      )}-${rolloverTypeShort}`;

      const amountIsk =
        type === 'FULL_PAYOUT' ? '1.00' : String(fromP.amountIsk);

      await this.prisma.cycleParticipation.create({
        data: {
          cycleId: targetCycleId,
          userId: fromP.userId,
          characterName: fromP.characterName,
          amountIsk,
          userPrincipalIsk: (() => {
            const p = Number(fromP.userPrincipalIsk ?? fromP.amountIsk);
            return Number.isFinite(p) ? p.toFixed(2) : '0.00';
          })(),
          memo,
          status: 'AWAITING_INVESTMENT',
          rolloverType: type,
          rolloverRequestedAmountIsk: fromP.amountIsk,
          rolloverFromParticipationId: fromP.id,
          ...(fromP.jingleYieldProgramId
            ? { jingleYieldProgramId: fromP.jingleYieldProgramId }
            : {}),
        },
      });

      created++;
    }

    if (created > 0) {
      this.logger.log(
        `[AutoRollover] Ensured rollover participations for cycle ${targetCycleId.substring(
          0,
          8,
        )}: created=${created}, skippedExisting=${skippedExisting}, skippedNoSource=${skippedNoSource}`,
      );
    }

    return { created, skippedExisting, skippedNoSource };
  }

  /**
   * Ensure that ACTIVE JingleYield users always have a rollover participation
   * created in the next Cycle, even if they did not manually opt into rollover.
   */
  private async ensureJingleYieldDefaultRollovers(input: {
    closedCycleId: string;
    targetCycleId: string;
    sourceStatuses?: Array<'OPTED_IN' | 'AWAITING_PAYOUT'>;
  }): Promise<{ created: number; skippedExisting: number }> {
    const { closedCycleId, targetCycleId, sourceStatuses } = input;

    const jyFromParticipations = await this.prisma.cycleParticipation.findMany({
      where: {
        cycleId: closedCycleId,
        userId: { not: null },
        jingleYieldProgramId: { not: null },
        jingleYieldProgram: {
          status: 'ACTIVE',
        },
        ...(sourceStatuses ? { status: { in: sourceStatuses } } : {}),
      },
      select: {
        id: true,
        userId: true,
        characterName: true,
        amountIsk: true,
        userPrincipalIsk: true,
      },
    });

    if (jyFromParticipations.length === 0) {
      return { created: 0, skippedExisting: 0 };
    }

    let created = 0;
    let skippedExisting = 0;

    for (const fromP of jyFromParticipations) {
      const userId = fromP.userId;
      if (!userId) continue;

      const existing = await this.prisma.cycleParticipation.findFirst({
        where: {
          cycleId: targetCycleId,
          userId,
        },
        select: { id: true, memo: true, rolloverType: true },
      });

      if (existing) {
        skippedExisting++;
        this.logger.debug(
          `[JY AutoRollover] Skipping user ${userId.substring(
            0,
            8,
          )} for cycle ${targetCycleId.substring(0, 8)}: already has participation ${existing.id.substring(
            0,
            8,
          )} (memo=${existing.memo}, rolloverType=${String(
            existing.rolloverType,
          )})`,
        );
        continue;
      }

      const memo = `ROLLOVER-${targetCycleId.substring(0, 8)}-${fromP.id.substring(
        0,
        8,
      )}-INITIAL`;

      await this.prisma.cycleParticipation.create({
        data: {
          cycleId: targetCycleId,
          userId,
          characterName: fromP.characterName,
          amountIsk: fromP.amountIsk,
          userPrincipalIsk: (() => {
            const p = Number(fromP.userPrincipalIsk ?? 0);
            return Number.isFinite(p) ? p.toFixed(2) : '0.00';
          })(),
          memo,
          status: 'AWAITING_INVESTMENT',
          rolloverType: 'INITIAL_ONLY',
          rolloverRequestedAmountIsk: fromP.amountIsk,
          rolloverFromParticipationId: fromP.id,
        },
      });

      created++;
    }

    if (created > 0 || skippedExisting > 0) {
      this.logger.log(
        `[JY AutoRollover] Prepared default rollovers for cycle ${targetCycleId.substring(
          0,
          8,
        )}: created=${created}, skippedExisting=${skippedExisting}`,
      );
    }

    return { created, skippedExisting };
  }

  async seedPlannedCycleRollovers(targetCycleId: string): Promise<{
    autoRollover: {
      created: number;
      skippedExisting: number;
      skippedIneligible: number;
      skippedUnsupported: number;
    };
    jingleYield: { created: number; skippedExisting: number };
  }> {
    const openCycle = await this.prisma.cycle.findFirst({
      where: { status: 'OPEN' },
      select: { id: true },
    });

    if (!openCycle) {
      this.logger.log(
        `[AutoRollover] No OPEN cycle found; skipping auto-rollover creation for planned cycle ${targetCycleId.substring(
          0,
          8,
        )}`,
      );
      return {
        autoRollover: {
          created: 0,
          skippedExisting: 0,
          skippedIneligible: 0,
          skippedUnsupported: 0,
        },
        jingleYield: { created: 0, skippedExisting: 0 },
      };
    }

    let autoRollover = {
      created: 0,
      skippedExisting: 0,
      skippedIneligible: 0,
      skippedUnsupported: 0,
    };
    try {
      autoRollover = await this.seedAutoRolloverParticipationsForPlannedCycle({
        targetCycleId,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[AutoRollover] Failed to process auto-rollover participations for planned cycle ${targetCycleId.substring(
          0,
          8,
        )}: ${String(err)}`,
      );
    }

    let jingleYield = { created: 0, skippedExisting: 0 };
    try {
      jingleYield = await this.ensureJingleYieldDefaultRollovers({
        closedCycleId: openCycle.id,
        targetCycleId,
        sourceStatuses: ['OPTED_IN', 'AWAITING_PAYOUT'],
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[JY AutoRollover] Failed to create default JY rollovers for planned cycle ${targetCycleId.substring(
          0,
          8,
        )}: ${String(err)}`,
      );
    }

    return { autoRollover, jingleYield };
  }

  private async seedAutoRolloverParticipationsForPlannedCycle(input: {
    targetCycleId: string;
  }): Promise<{
    created: number;
    skippedExisting: number;
    skippedIneligible: number;
    skippedUnsupported: number;
  }> {
    const { targetCycleId } = input;
    const enabled = await this.prisma.autoRolloverSettings.findMany({
      where: { enabled: true },
      select: { userId: true, defaultRolloverType: true },
    });

    if (enabled.length > 0) {
      this.logger.log(
        `[AutoRollover] Planning cycle ${targetCycleId.substring(
          0,
          8,
        )}: evaluating ${enabled.length} user settings`,
      );
    }

    const results = await Promise.all(
      enabled.map(async (setting) => {
        const type = setting.defaultRolloverType;
        if (type !== 'FULL_PAYOUT' && type !== 'INITIAL_ONLY') {
          this.logger.warn(
            `[AutoRollover] Skipping user ${setting.userId.substring(
              0,
              8,
            )}: unsupported type=${String(type)}`,
          );
          return 'skippedUnsupported' as const;
        }

        const existing = await this.prisma.cycleParticipation.findFirst({
          where: {
            cycleId: targetCycleId,
            userId: setting.userId,
          },
          select: { id: true },
        });
        if (existing) return 'skippedExisting' as const;

        try {
          await this.participations.createParticipation({
            cycleId: targetCycleId,
            userId: setting.userId,
            amountIsk: '1.00',
            rollover: { type },
          });
          return 'created' as const;
        } catch (err: unknown) {
          this.logger.debug(
            `[AutoRollover] Could not create rollover participation for user ${setting.userId.substring(
              0,
              8,
            )}: ${String(err)}`,
          );
          return 'skippedIneligible' as const;
        }
      }),
    );

    return {
      created: results.filter((result) => result === 'created').length,
      skippedExisting: results.filter((result) => result === 'skippedExisting')
        .length,
      skippedIneligible: results.filter(
        (result) => result === 'skippedIneligible',
      ).length,
      skippedUnsupported: results.filter(
        (result) => result === 'skippedUnsupported',
      ).length,
    };
  }

  async buildRolloverLineCandidates(
    previousCycleId: string | null,
  ): Promise<RolloverLineCandidate[]> {
    if (previousCycleId) {
      this.logger.log(
        `[Rollover] Creating rollover lines from previous cycle ${previousCycleId}`,
      );
      const prevLines = await this.prisma.cycleLine.findMany({
        where: { cycleId: previousCycleId },
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

      const rolloverLines: RolloverLineCandidate[] = [];
      for (const prevLine of prevLines) {
        const remainingUnits = prevLine.unitsBought - prevLine.unitsSold;
        if (remainingUnits <= 0) continue;
        const wac =
          prevLine.unitsBought > 0
            ? Number(prevLine.buyCostIsk) / prevLine.unitsBought
            : 0;

        rolloverLines.push({
          typeId: prevLine.typeId,
          destinationStationId: prevLine.destinationStationId,
          plannedUnits: remainingUnits,
          currentSellPriceIsk: prevLine.currentSellPriceIsk
            ? Number(prevLine.currentSellPriceIsk)
            : null,
          rolloverFromLineId: prevLine.id,
          buyCostIsk: wac,
        });
      }

      this.logger.log(
        `[Rollover] Found ${rolloverLines.length} items with remaining inventory`,
      );
      return rolloverLines;
    }

    this.logger.log(
      `[Rollover] No previous cycle - fetching initial inventory from ESI`,
    );
    const key = (stationId: number, typeId: number) => `${stationId}:${typeId}`;
    const qtyByTypeStation = new Map<string, number>();
    const sellPriceByTypeStation = new Map<string, number>();
    const trackedChars = await this.characterService.getTrackedSellerIds();

    await Promise.all(
      trackedChars.map(async (cid) => {
        try {
          const orders = await this.esiChars.getOrders(cid);
          for (const order of orders) {
            if (order.is_buy_order) continue;
            const itemKey = key(order.location_id, order.type_id);
            qtyByTypeStation.set(
              itemKey,
              (qtyByTypeStation.get(itemKey) ?? 0) + order.volume_remain,
            );
            const existingPrice = sellPriceByTypeStation.get(itemKey);
            if (!existingPrice || order.price < existingPrice) {
              sellPriceByTypeStation.set(itemKey, order.price);
            }
          }
        } catch (error) {
          this.logger.warn(`Orders fetch failed for ${cid}: ${String(error)}`);
        }
      }),
    );

    const rolloverLines: RolloverLineCandidate[] = [];
    for (const [itemKey, qty] of qtyByTypeStation) {
      const [stationIdRaw, typeIdRaw] = itemKey.split(':');
      const stationId = Number(stationIdRaw);
      const typeId = Number(typeIdRaw);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      rolloverLines.push({
        typeId,
        destinationStationId: stationId,
        plannedUnits: Math.floor(qty),
        currentSellPriceIsk: sellPriceByTypeStation.get(itemKey) ?? null,
        rolloverFromLineId: null,
        buyCostIsk: 0,
      });

      if (rolloverLines.length >= CAPITAL_CONSTANTS.MAX_ROLLOVER_LINES) break;
    }

    this.logger.log(
      `[Rollover] Found ${rolloverLines.length} items from ESI sell orders`,
    );
    return rolloverLines;
  }

  async fetchJitaPricesForRolloverLines(
    rolloverLines: RolloverLineCandidate[],
  ): Promise<Map<number, number>> {
    const itemsNeedingJitaPrices = Array.from(
      new Set(
        rolloverLines
          .filter((line) => line.buyCostIsk === 0)
          .map((line) => line.typeId),
      ),
    );
    const jitaPriceMap = new Map<number, number>();
    if (itemsNeedingJitaPrices.length === 0) return jitaPriceMap;

    this.logger.log(
      `[Jita Fallback] Fetching Jita prices for ${itemsNeedingJitaPrices.length} items...`,
    );
    const jitaPrices = await Promise.all(
      itemsNeedingJitaPrices.map(async (typeId) => ({
        typeId,
        price: await this.fetchJitaCheapestSell(typeId),
      })),
    );
    for (const { typeId, price } of jitaPrices) {
      if (price) jitaPriceMap.set(typeId, price);
    }

    return jitaPriceMap;
  }

  resolveRolloverLineBuyCost(
    line: RolloverLineCandidate,
    jitaPriceMap: Map<number, number>,
  ): number {
    if (line.buyCostIsk > 0) return line.buyCostIsk * line.plannedUnits;

    const jitaPrice = jitaPriceMap.get(line.typeId);
    if (jitaPrice) {
      this.logger.log(
        `[Jita Fallback] Type ${line.typeId}: ${jitaPrice.toFixed(2)} ISK/unit`,
      );
      return jitaPrice * line.plannedUnits;
    }

    this.logger.error(
      `[Line Creation] Type ${line.typeId}: Missing buy cost and Jita price failed`,
    );
    return 0;
  }

  async processInventoryBuyback(cycleId: string): Promise<{
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

      await this.prisma.sellAllocation.create({
        data: {
          lineId: line.id,
          walletCharacterId: null,
          walletTransactionId: null,
          isRollover: true,
          quantity: remainingUnits,
          unitPrice: wac,
          revenueIsk: buybackAmount,
          taxIsk: 0,
        },
      });

      await this.prisma.cycleLine.update({
        where: { id: line.id },
        data: {
          unitsSold: { increment: remainingUnits },
          salesGrossIsk: { increment: buybackAmount },
          salesNetIsk: { increment: buybackAmount },
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

  async processInventoryPurchase(
    newCycleId: string,
    previousCycleId: string | null,
  ): Promise<{
    itemsRolledOver: number;
    totalRolloverCostIsk: number;
  }> {
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
        unitsBought: true,
        rolloverFromLineId: true,
      },
    });

    let totalCost = 0;
    let itemsProcessed = 0;

    for (const line of rolloverLines) {
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

  async processParticipationRollovers(
    closedCycleId: string,
    targetCycleId: string,
  ): Promise<{
    processed: number;
    rolledOver: string;
    paidOut: string;
  }> {
    return await this.processRollovers(closedCycleId, targetCycleId);
  }

  /**
   * Process Rollover Intent for a closed Cycle into the target Cycle.
   */
  async processRollovers(
    closedCycleId: string,
    targetCycleId?: string,
    profitSharePct = 0.5,
  ): Promise<{
    processed: number;
    rolledOver: string;
    paidOut: string;
  }> {
    this.logger.log(
      `[DEBUG] processRollovers called for closedCycleId: ${closedCycleId.substring(0, 8)}, targetCycleId: ${targetCycleId?.substring(0, 8) ?? 'auto-detect'}`,
    );

    let nextCycle;
    if (targetCycleId) {
      nextCycle = await this.prisma.cycle.findUnique({
        where: { id: targetCycleId },
      });
      if (!nextCycle) {
        this.logger.warn(`Target cycle ${targetCycleId} not found`);
        return { processed: 0, rolledOver: '0.00', paidOut: '0.00' };
      }
    } else {
      nextCycle = await this.prisma.cycle.findFirst({
        where: {
          status: { in: ['PLANNED', 'OPEN'] },
          id: { not: closedCycleId },
        },
        orderBy: { startedAt: 'asc' },
      });
      if (!nextCycle) {
        this.logger.log(
          'No PLANNED/OPEN cycle found, skipping rollover processing',
        );
        return { processed: 0, rolledOver: '0.00', paidOut: '0.00' };
      }
    }

    this.logger.log(
      `[DEBUG] Found next cycle: ${nextCycle.id.substring(0, 8)}, status: ${nextCycle.status}`,
    );

    try {
      await this.ensureAutoRolloverParticipations({
        closedCycleId,
        targetCycleId: nextCycle.id,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[AutoRollover] Failed to ensure rollover participations for closedCycleId=${closedCycleId.substring(
          0,
          8,
        )} -> targetCycleId=${nextCycle.id.substring(0, 8)}: ${String(err)}`,
      );
    }

    try {
      await this.ensureJingleYieldDefaultRollovers({
        closedCycleId,
        targetCycleId: nextCycle.id,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[JY AutoRollover] Failed to ensure default rollovers for closedCycleId=${closedCycleId.substring(
          0,
          8,
        )} -> targetCycleId=${nextCycle.id.substring(0, 8)}: ${String(err)}`,
      );
    }

    const rolloverParticipations =
      await this.prisma.cycleParticipation.findMany({
        where: {
          cycleId: nextCycle.id,
          rolloverType: { not: null },
          rolloverFromParticipationId: { not: null },
        },
        include: {
          rolloverFromParticipation: {
            include: {
              jingleYieldProgram: true,
            },
          },
          jingleYieldProgram: true,
        },
      });

    this.logger.log(
      `[DEBUG] Found ${rolloverParticipations.length} rollover participations in cycle ${nextCycle.id.substring(0, 8)}`,
    );

    if (rolloverParticipations.length > 0) {
      for (const rp of rolloverParticipations) {
        this.logger.log(
          `[DEBUG]   - Rollover participation ${rp.id.substring(0, 8)}: rolloverType=${rp.rolloverType}, fromParticipationId=${rp.rolloverFromParticipationId?.substring(0, 8)}, fromCycleId=${rp.rolloverFromParticipation?.cycleId?.substring(0, 8)}`,
        );
      }
    }

    const relevantRollovers = rolloverParticipations.filter(
      (rp) =>
        rp.rolloverFromParticipation?.cycleId === closedCycleId &&
        rp.rolloverFromParticipation?.rolloverDeductedIsk == null,
    );

    this.logger.log(
      `[DEBUG] ${relevantRollovers.length} rollovers are from the closed cycle ${closedCycleId.substring(0, 8)}`,
    );

    if (relevantRollovers.length === 0) {
      this.logger.log('No rollover participations found');
      return { processed: 0, rolledOver: '0.00', paidOut: '0.00' };
    }

    this.logger.log(
      `Processing ${relevantRollovers.length} rollover participations`,
    );

    let totalRolledOver = 0;
    let totalPaidOut = 0;
    const DEFAULT_MAXIMUM_CAP_ISK = 20_000_000_000;

    for (const rollover of relevantRollovers) {
      const fromParticipation = rollover.rolloverFromParticipation!;

      const participationWithPayout =
        await this.prisma.cycleParticipation.findUnique({
          where: { id: fromParticipation.id },
          select: {
            payoutAmountIsk: true,
            amountIsk: true,
            status: true,
            payoutPaidAt: true,
          },
        });

      let actualPayoutIsk: string;
      let initialInvestmentIsk: string;

      if (!participationWithPayout?.payoutAmountIsk) {
        this.logger.warn(
          `No payout amount set for participation ${fromParticipation.id}, using computed value`,
        );
        const { payouts } = await this.payouts.computePayouts(
          closedCycleId,
          profitSharePct,
        );
        const payoutInfo = payouts.find(
          (p) => p.participationId === fromParticipation.id,
        );
        if (!payoutInfo) {
          this.logger.warn(
            `Cannot compute payout for participation ${fromParticipation.id}, skipping rollover`,
          );
          continue;
        }
        actualPayoutIsk = payoutInfo.totalPayoutIsk;
        initialInvestmentIsk = fromParticipation.amountIsk.toString();
      } else {
        actualPayoutIsk = participationWithPayout.payoutAmountIsk.toString();
        initialInvestmentIsk = participationWithPayout.amountIsk.toString();
      }

      const actualPayout = Number(actualPayoutIsk);
      const initialInvestment = Number(initialInvestmentIsk);

      let maximumCapIsk = DEFAULT_MAXIMUM_CAP_ISK;
      if (rollover.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: rollover.userId },
          select: { tradecraftMaximumCapIsk: true },
        });
        const raw =
          user?.tradecraftMaximumCapIsk == null
            ? NaN
            : Number(user.tradecraftMaximumCapIsk);
        maximumCapIsk = Number.isFinite(raw) ? raw : DEFAULT_MAXIMUM_CAP_ISK;
      }

      let rolloverAmount: number;
      let userExtraForRollover = 0;

      if (rollover.rolloverType === 'FULL_PAYOUT') {
        const fromUserPrincipal = Number(
          rollover.rolloverFromParticipation?.userPrincipalIsk ??
            rollover.rolloverFromParticipation?.amountIsk ??
            0,
        );
        const currentUserPrincipal = Number(
          rollover.userPrincipalIsk ?? fromUserPrincipal,
        );
        userExtraForRollover = Math.max(
          currentUserPrincipal - fromUserPrincipal,
          0,
        );

        const totalBeforeCaps = actualPayout + userExtraForRollover;
        const cappedTotal = Math.min(totalBeforeCaps, maximumCapIsk);
        const rolledFromPayout = Math.min(
          actualPayout,
          cappedTotal - userExtraForRollover,
        );

        rolloverAmount = rolledFromPayout + userExtraForRollover;
      } else if (rollover.rolloverType === 'INITIAL_ONLY') {
        rolloverAmount = initialInvestment;
      } else {
        rolloverAmount = Number(rollover.rolloverRequestedAmountIsk);
      }

      const jyProgram =
        rollover.jingleYieldProgram ??
        rollover.rolloverFromParticipation?.jingleYieldProgram ??
        null;

      if (jyProgram && jyProgram.status === 'ACTIVE') {
        const lockedBase = Number(jyProgram.lockedPrincipalIsk);

        if (lockedBase > 0) {
          if (actualPayout >= lockedBase) {
            rolloverAmount = Math.max(rolloverAmount, lockedBase);
          } else {
            rolloverAmount = Math.min(rolloverAmount, actualPayout);
          }
        }
      }

      if (rollover.rolloverType !== 'FULL_PAYOUT') {
        rolloverAmount = Math.min(rolloverAmount, maximumCapIsk, actualPayout);
      }

      const payoutAmount =
        actualPayout - Math.min(rolloverAmount, actualPayout);

      await this.prisma.cycleParticipation.update({
        where: { id: rollover.id },
        data: {
          amountIsk: rolloverAmount.toFixed(2),
          userPrincipalIsk: rollover.userPrincipalIsk ?? null,
          status: 'OPTED_IN',
          validatedAt: new Date(),
          ...(jyProgram
            ? {
                jingleYieldProgramId: jyProgram.id,
              }
            : {}),
        },
      });

      const alreadyPaid =
        participationWithPayout?.payoutPaidAt != null ||
        participationWithPayout?.status === 'COMPLETED';

      await this.prisma.cycleParticipation.update({
        where: { id: fromParticipation.id },
        data: {
          payoutAmountIsk: payoutAmount.toFixed(2),
          rolloverDeductedIsk: rolloverAmount.toFixed(2),
          status: alreadyPaid
            ? 'COMPLETED'
            : payoutAmount > 0
              ? 'AWAITING_PAYOUT'
              : 'COMPLETED',
          payoutPaidAt: alreadyPaid
            ? (participationWithPayout?.payoutPaidAt ?? null)
            : payoutAmount === 0
              ? new Date()
              : null,
        },
      });

      totalRolledOver += rolloverAmount;
      totalPaidOut += payoutAmount;

      this.logger.log(
        `Rollover processed for ${rollover.characterName}: ${rolloverAmount.toFixed(2)} ISK rolled over, ${payoutAmount.toFixed(2)} ISK paid out`,
      );
    }

    return {
      processed: relevantRollovers.length,
      rolledOver: totalRolledOver.toFixed(2),
      paidOut: totalPaidOut.toFixed(2),
    };
  }

  /**
   * Admin helper: backfill missing default JingleYield rollover participations
   * into a specific target Cycle and then process them from the source Cycle.
   */
  async backfillJingleYieldRolloversForTargetCycle(input: {
    targetCycleId: string;
    sourceClosedCycleId?: string;
    profitSharePct?: number;
  }): Promise<{
    targetCycleId: string;
    sourceClosedCycleId: string;
    ensured: { created: number; skippedExisting: number };
    rollovers: {
      processed: number;
      rolledOver: string;
      paidOut: string;
    };
  }> {
    const targetCycle = await this.prisma.cycle.findUnique({
      where: { id: input.targetCycleId },
      select: { id: true, status: true, startedAt: true },
    });
    if (!targetCycle) throw new Error('Target cycle not found');
    if (targetCycle.status !== 'OPEN' && targetCycle.status !== 'PLANNED') {
      throw new Error(
        'Backfill only supported for target cycles in OPEN or PLANNED status',
      );
    }

    let sourceClosedCycleId = input.sourceClosedCycleId;

    if (!sourceClosedCycleId) {
      const inferred = await this.prisma.cycle.findFirst({
        where: {
          status: 'COMPLETED',
          closedAt: { not: null, lte: targetCycle.startedAt },
          id: { not: targetCycle.id },
        },
        orderBy: { closedAt: 'desc' },
        select: { id: true },
      });

      const fallback = inferred
        ? null
        : await this.prisma.cycle.findFirst({
            where: { status: 'COMPLETED', id: { not: targetCycle.id } },
            orderBy: { closedAt: 'desc' },
            select: { id: true },
          });

      sourceClosedCycleId = inferred?.id ?? fallback?.id;
    }

    if (!sourceClosedCycleId) {
      throw new Error(
        'Could not infer a source completed cycle; please provide sourceClosedCycleId',
      );
    }

    const ensured = await this.ensureJingleYieldDefaultRollovers({
      closedCycleId: sourceClosedCycleId,
      targetCycleId: targetCycle.id,
    });

    const rollovers = await this.processRollovers(
      sourceClosedCycleId,
      targetCycle.id,
      input.profitSharePct ?? 0.5,
    );

    return {
      targetCycleId: targetCycle.id,
      sourceClosedCycleId,
      ensured,
      rollovers,
    };
  }

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

      return Math.min(...orders.map((order: { price: number }) => order.price));
    } catch (error: unknown) {
      this.logger.error(
        `[Jita Price Fetch] Failed to fetch Jita sell price for type ${typeId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
