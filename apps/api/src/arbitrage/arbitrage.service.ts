import { Injectable, Logger } from '@nestjs/common';
import { LiquidityService } from '../liquidity/liquidity.service';
import { PrismaService } from '../prisma/prisma.service';
import { EsiService } from '../esi/esi.service';
import { fetchStationOrders } from '../esi/market-helpers';
import { ArbitragePackagerService } from '../../libs/arbitrage-packager/src';
import type {
  DestinationConfig,
  MultiPlanOptions,
  PlanResult,
} from '../../libs/arbitrage-packager/src/interfaces/packager.interfaces';
import type {
  DestinationGroup,
  Opportunity,
  PriceValidationSource,
} from './dto/opportunity.dto';
import type { PlanPackagesRequest } from './dto/plan-packages-request.dto';
import type { ArbitrageCheckRequest } from './dto/check-request.dto';
import { applySellFees, computeUnitNetProfit } from './fees';
import { round2 } from '../common/money';

@Injectable()
export class ArbitrageService {
  constructor(
    private readonly liquidity: LiquidityService,
    private readonly prisma: PrismaService,
    private readonly esi: EsiService,
    private readonly logger: Logger,
    private readonly packager: ArbitragePackagerService,
  ) {}

  private async fetchCheapestSellAtStation(
    typeId: number,
    stationId: number,
  ): Promise<number | null> {
    // Resolve region to query ESI regional markets
    const station = await this.prisma.stationId.findUnique({
      where: { id: stationId },
      select: { solarSystemId: true },
    });
    if (!station) return null;
    const system = await this.prisma.solarSystemId.findUnique({
      where: { id: station.solarSystemId },
      select: { regionId: true },
    });
    if (!system) return null;
    const regionId = system.regionId;

    // Use shared helper to fetch station-filtered sell orders
    const orders = await fetchStationOrders(this.esi, {
      regionId,
      typeId,
      stationId,
      side: 'sell',
      reqId: undefined,
    });
    if (!orders.length) return null;
    let cheapest: number | null = null;
    for (const o of orders) {
      cheapest = cheapest === null ? o.price : Math.min(cheapest, o.price);
    }
    return cheapest;
  }

  private async fetchStationSellOrders(
    typeId: number,
    stationId: number,
  ): Promise<Array<{ price: number; volume: number }>> {
    const station = await this.prisma.stationId.findUnique({
      where: { id: stationId },
      select: { solarSystemId: true },
    });
    if (!station) return [];
    const system = await this.prisma.solarSystemId.findUnique({
      where: { id: station.solarSystemId },
      select: { regionId: true },
    });
    if (!system) return [];
    const regionId = system.regionId;

    const orders = await fetchStationOrders(this.esi, {
      regionId,
      typeId,
      stationId,
      side: 'sell',
    });
    orders.sort((a, b) => a.price - b.price);
    return orders;
  }

  private getMarginalUnitPrice(
    orders: Array<{ price: number; volume: number }>,
    quantity: number,
  ): number | null {
    if (!orders.length) return null;
    if (quantity <= 0) return null;
    const required = Math.ceil(quantity);
    let remaining = required;
    let lastPrice: number | null = null;
    for (const o of orders) {
      if (o.volume <= 0) continue;
      lastPrice = o.price;
      if (remaining <= o.volume) {
        return lastPrice;
      }
      remaining -= o.volume;
    }
    // Not enough depth to fully satisfy; return highest price available
    return lastPrice;
  }

  async check(
    params?: ArbitrageCheckRequest,
    reqId?: string,
  ): Promise<Record<string, DestinationGroup>> {
    const sourceStationId = params?.sourceStationId ?? 60003760; // Jita IV-4
    const arbitrageMultiplier = params?.arbitrageMultiplier ?? 5;
    const marginValidateThreshold = params?.marginValidateThreshold ?? 50; // percent
    const minTotalProfitISK = params?.minTotalProfitISK ?? 1_000_000;
    const stationConcurrency = Math.max(1, params?.stationConcurrency ?? 4);
    const itemConcurrency = Math.max(1, params?.itemConcurrency ?? 20);
    const salesTaxPercent = params?.salesTaxPercent ?? 3.37;
    const brokerFeePercent = params?.brokerFeePercent ?? 1.5;
    const feeInputs = { salesTaxPercent, brokerFeePercent };

    // Get liquidity for all tracked stations with defaults
    const liquidity = await this.liquidity.runCheck();

    const result: Record<string, DestinationGroup> = {};

    // Memoize source station sell orders by typeId; compute marginal price per quantity
    const sourceOrdersCache = new Map<
      number,
      Array<{ price: number; volume: number }>
    >();
    const sourceOrdersInFlight = new Map<
      number,
      Promise<Array<{ price: number; volume: number }>>
    >();
    const getSourceOrders = async (
      typeId: number,
    ): Promise<Array<{ price: number; volume: number }>> => {
      if (sourceOrdersCache.has(typeId)) {
        return sourceOrdersCache.get(typeId) ?? [];
      }
      const inflight = sourceOrdersInFlight.get(typeId);
      if (inflight) return inflight;
      const promise = this.fetchStationSellOrders(typeId, sourceStationId)
        .then((orders) => {
          sourceOrdersCache.set(typeId, orders);
          return orders;
        })
        .finally(() => {
          sourceOrdersInFlight.delete(typeId);
        });
      sourceOrdersInFlight.set(typeId, promise);
      return promise;
    };

    const startedAt = Date.now();
    const stations = Object.entries(liquidity);
    const desiredEsiConc =
      params?.esiMaxConcurrency ?? Math.max(1, itemConcurrency * 4);
    this.logger.log(
      `[reqId=${reqId ?? '-'}] Arbitrage start src=${sourceStationId} mult=${arbitrageMultiplier} validate>${marginValidateThreshold}% minProfit=${minTotalProfitISK} stationConc=${stationConcurrency} itemConc=${itemConcurrency} stations=${stations.length} esiConc=${desiredEsiConc}`,
    );
    let sIdx = 0;
    const stationWorkers = Array.from(
      { length: Math.min(stationConcurrency, stations.length) },
      async () => {
        for (;;) {
          const current = sIdx++;
          if (current >= stations.length) break;
          const [stationIdStr, group] = stations[current];
          const destinationStationId = Number(stationIdStr);

          const itemsOut: Opportunity[] = [];

          // process items with concurrency
          const list = group.items;
          let iIdx = 0;
          const stationStart = Date.now();
          const itemWorker = async () => {
            for (;;) {
              const i = iIdx++;
              if (i >= list.length) break;
              const item = list[i];
              const recentDailyVolume = item.avgDailyAmount;
              const plannedArbitrageQuantity =
                recentDailyVolume * arbitrageMultiplier;

              const [sourceOrders, dstPriceFromEsi] = await Promise.all([
                getSourceOrders(item.typeId),
                this.fetchCheapestSellAtStation(
                  item.typeId,
                  destinationStationId,
                ),
              ]);

              const availableAtSource = sourceOrders.reduce(
                (acc, o) => acc + (o.volume > 0 ? o.volume : 0),
                0,
              );
              const arbitrageQuantity = Math.min(
                plannedArbitrageQuantity,
                availableAtSource,
              );

              const srcPrice = this.getMarginalUnitPrice(
                sourceOrders,
                arbitrageQuantity,
              );

              let destinationPrice = dstPriceFromEsi ?? null;
              let priceValidationSource: PriceValidationSource = 'ESI';

              if (
                srcPrice !== null &&
                destinationPrice !== null &&
                srcPrice > 0
              ) {
                const rawMargin = (destinationPrice / srcPrice) * 100;
                if (rawMargin - 100 > marginValidateThreshold) {
                  const liquidityHigh = Number(item.latest?.high ?? '0');
                  const validated = Math.min(
                    destinationPrice,
                    liquidityHigh || destinationPrice,
                  );
                  if (validated !== destinationPrice)
                    priceValidationSource = 'LiquidityHigh';
                  destinationPrice = validated;
                }
              }

              // Apply sell-side fees to destination price only
              const effectiveDestPrice =
                destinationPrice !== null
                  ? applySellFees(destinationPrice, feeInputs)
                  : null;

              const netProfitISK =
                srcPrice !== null && destinationPrice !== null
                  ? computeUnitNetProfit(srcPrice, destinationPrice, feeInputs)
                  : 0;
              // Margin as percent gain over cost: ((sell_net - buy)/buy)*100
              const margin =
                srcPrice !== null && effectiveDestPrice !== null && srcPrice > 0
                  ? ((effectiveDestPrice - srcPrice) / srcPrice) * 100
                  : 0;
              const totalCostISK =
                srcPrice !== null ? srcPrice * arbitrageQuantity : 0;
              const totalProfitISK = netProfitISK * arbitrageQuantity;

              const opp: Opportunity = {
                typeId: item.typeId,
                name: item.typeName ?? String(item.typeId),
                sourceStationId,
                destinationStationId,
                sourcePrice: srcPrice !== null ? round2(srcPrice) : null,
                destinationPrice:
                  destinationPrice !== null ? round2(destinationPrice) : null,
                priceValidationSource,
                netProfitISK: round2(netProfitISK),
                margin: round2(margin),
                recentDailyVolume,
                arbitrageQuantity,
                totalCostISK: round2(totalCostISK),
                totalProfitISK: round2(totalProfitISK),
              };
              if (opp.totalProfitISK >= minTotalProfitISK) {
                itemsOut.push(opp);
              }
            }
          };

          await Promise.all(
            Array.from({ length: Math.min(itemConcurrency, list.length) }, () =>
              itemWorker(),
            ),
          );

          // Order by totalProfitISK desc
          itemsOut.sort((a, b) => b.totalProfitISK - a.totalProfitISK);

          const totals = itemsOut.reduce(
            (acc, it) => {
              acc.cost += it.totalCostISK;
              acc.profit += it.totalProfitISK;
              acc.marginSum += it.margin;
              return acc;
            },
            { cost: 0, profit: 0, marginSum: 0 },
          );
          const averageMargin = itemsOut.length
            ? round2(totals.marginSum / itemsOut.length)
            : 0;

          const stationName = (group as { stationName?: string }).stationName;

          result[stationIdStr] = {
            destinationStationId,
            stationName: stationName ?? undefined,
            totalItems: itemsOut.length,
            totalCostISK: round2(totals.cost),
            totalProfitISK: round2(totals.profit),
            averageMargin,
            items: itemsOut,
          };
          this.logger.log(
            `[reqId=${reqId ?? '-'}] Arb station ${destinationStationId}: items=${itemsOut.length} cost=${round2(
              totals.cost,
            )} profit=${round2(totals.profit)} avgMargin=${averageMargin}% ms=${
              Date.now() - stationStart
            }`,
          );
        }
      },
    );

    await this.esi.withMaxConcurrency(desiredEsiConc, async () => {
      await Promise.all(stationWorkers);
    });

    this.logger.log(
      `[reqId=${reqId ?? '-'}] Arbitrage completed in ${Date.now() - startedAt}ms (stations=${stations.length})`,
    );
    return result;
  }

  async planPackages(
    params: PlanPackagesRequest,
    reqId?: string,
  ): Promise<PlanResult> {
    // Build DestinationConfig[] from arbitrage check results
    const arbitrage = await this.check(undefined, reqId);
    // Fetch volumes (m3) for all needed typeIds from DB (TypeId.volume)
    const typeIds = Array.from(
      new Set(
        Object.values(arbitrage).flatMap((g) => g.items.map((it) => it.typeId)),
      ),
    );
    const volumes = await this.prisma.typeId.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, volume: true },
    });
    const volByType = new Map<number, number>();
    for (const v of volumes) volByType.set(v.id, Number(v.volume ?? 0));

    const destinations: DestinationConfig[] = Object.values(arbitrage).map(
      (group) => ({
        destinationStationId: group.destinationStationId,
        shippingCostISK:
          params.shippingCostByStation[group.destinationStationId] ?? 0,
        items: group.items.map((it) => ({
          typeId: it.typeId,
          name: it.name,
          sourceStationId: it.sourceStationId,
          destinationStationId: it.destinationStationId,
          sourcePrice: it.sourcePrice ?? 0,
          destinationPrice: it.destinationPrice ?? 0,
          netProfitISK: it.netProfitISK, // already per-unit
          arbitrageQuantity: Math.max(0, Math.floor(it.arbitrageQuantity)),
          m3: volByType.get(it.typeId) ?? 0,
        })),
      }),
    );

    const opts: MultiPlanOptions = {
      packageCapacityM3: params.packageCapacityM3,
      investmentISK: params.investmentISK,
      perDestinationMaxBudgetSharePerItem:
        params.perDestinationMaxBudgetSharePerItem ?? 0.2,
      maxPackagesHint: params.maxPackagesHint ?? 30,
      destinationCaps: params.destinationCaps,
      allocation: params.allocation,
    };

    const plan = this.packager.planMultiDestination(destinations, opts);

    // Attach destination names to packages when available
    const nameByDest = new Map<number, string | undefined>();
    for (const group of Object.values(arbitrage)) {
      const id = group.destinationStationId;
      const name = (group as { stationName?: string }).stationName;
      if (!nameByDest.has(id)) nameByDest.set(id, name);
    }

    for (const pkg of plan.packages) {
      const n = nameByDest.get(pkg.destinationStationId);
      if (n) (pkg as { destinationName?: string }).destinationName = n;
    }

    return plan;
  }

  async commitPlan(payload: {
    request: unknown;
    result: unknown;
    memo?: string;
  }) {
    const row = await this.prisma.planCommit.create({
      data: {
        request: payload.request as object,
        result: payload.result as object,
        memo: payload.memo ?? null,
      },
      select: { id: true, createdAt: true },
    });
    this.logger.log(`Plan commit saved id=${row.id}`);
    return row;
  }

  async listCommits(params?: { limit?: number; offset?: number }) {
    const take = Math.min(Math.max(params?.limit ?? 25, 1), 200);
    const skip = Math.max(params?.offset ?? 0, 0);
    return await this.prisma.planCommit.findMany({
      select: { id: true, createdAt: true, memo: true },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }
}
