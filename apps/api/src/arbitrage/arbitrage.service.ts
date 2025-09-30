import { Injectable, Logger } from '@nestjs/common';
import { LiquidityService } from '../liquidity/liquidity.service';
import { PrismaService } from '../prisma/prisma.service';
import { EsiService } from '../esi/esi.service';
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
    // Use ESI: /latest/markets/{region_id}/orders/ with sell orders, then filter by location_id == stationId
    // First resolve region from station
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

    let page = 1;
    let totalPages: number | null = null;
    let cheapest: number | null = null;
    // Iterate all pages for this type within the region and track min price at station
    for (;;) {
      try {
        const { data, meta } = await this.esi.fetchJson<
          Array<{
            order_id: number;
            type_id: number;
            is_buy_order: boolean;
            price: number;
            volume_remain: number;
            location_id: number;
          }>
        >(`/latest/markets/${regionId}/orders/`, {
          query: { order_type: 'sell', type_id: typeId, page },
          // prefer headers so X-Pages can be read even on 304
          preferHeaders: true,
        });
        if (meta?.headers && typeof meta.headers['x-pages'] === 'string') {
          const xp = Number(meta.headers['x-pages']);
          if (!Number.isNaN(xp) && xp > 0) totalPages = xp;
        }
        if (!Array.isArray(data) || data.length === 0) break;
        for (const o of data) {
          if (o.location_id === stationId && !o.is_buy_order) {
            cheapest =
              cheapest === null ? o.price : Math.min(cheapest, o.price);
          }
        }
        if (totalPages !== null && page >= totalPages) break;
        page++;
      } catch (err: unknown) {
        const status =
          typeof err === 'object' && err !== null && 'response' in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined;
        if (status === 404) break; // no such page; stop paging
        throw err;
      }
    }
    return cheapest;
  }

  async check(params?: {
    sourceStationId?: number;
    arbitrageMultiplier?: number;
    marginValidateThreshold?: number;
    minTotalProfitISK?: number;
    stationConcurrency?: number;
    itemConcurrency?: number;
    salesTaxPercent?: number; // default 3.37
    brokerFeePercent?: number; // default 1.5
    esiMaxConcurrency?: number; // optional override for ESI client
  }): Promise<Record<string, DestinationGroup>> {
    const sourceStationId = params?.sourceStationId ?? 60003760; // Jita IV-4
    const arbitrageMultiplier = params?.arbitrageMultiplier ?? 5;
    const marginValidateThreshold = params?.marginValidateThreshold ?? 50; // percent
    const minTotalProfitISK = params?.minTotalProfitISK ?? 1_000_000;
    const stationConcurrency = Math.max(1, params?.stationConcurrency ?? 4);
    const itemConcurrency = Math.max(1, params?.itemConcurrency ?? 20);
    const salesTaxPercent = params?.salesTaxPercent ?? 3.37;
    const brokerFeePercent = params?.brokerFeePercent ?? 1.5;
    const totalSellFeePct = salesTaxPercent + brokerFeePercent; // applied on sell only

    // Get liquidity for all tracked stations with defaults
    const liquidity = await this.liquidity.runCheck();

    const result: Record<string, DestinationGroup> = {};

    // memoize source prices per type to avoid refetching for each station
    const sourcePriceCache = new Map<number, number | null>();
    const sourcePriceInFlight = new Map<number, Promise<number | null>>();
    const getSourcePrice = async (typeId: number): Promise<number | null> => {
      if (sourcePriceCache.has(typeId)) {
        return sourcePriceCache.get(typeId) ?? null;
      }
      const inflight = sourcePriceInFlight.get(typeId);
      if (inflight) return inflight;
      const promise = this.fetchCheapestSellAtStation(typeId, sourceStationId)
        .then((price) => {
          sourcePriceCache.set(typeId, price);
          return price;
        })
        .finally(() => {
          sourcePriceInFlight.delete(typeId);
        });
      sourcePriceInFlight.set(typeId, promise);
      return promise;
    };

    const startedAt = Date.now();
    const stations = Object.entries(liquidity);
    const desiredEsiConc =
      params?.esiMaxConcurrency ?? Math.max(1, itemConcurrency * 4);
    this.logger.log(
      `Arbitrage start: src=${sourceStationId} mult=${arbitrageMultiplier} validate>${marginValidateThreshold}% minProfit=${minTotalProfitISK} stationConc=${stationConcurrency} itemConc=${itemConcurrency} stations=${stations.length} esiConc=${desiredEsiConc}`,
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
              const [srcPrice, dstPriceFromEsi] = await Promise.all([
                getSourcePrice(item.typeId),
                this.fetchCheapestSellAtStation(
                  item.typeId,
                  destinationStationId,
                ),
              ]);

              const recentDailyVolume = item.avgDailyAmount;
              const arbitrageQuantity = recentDailyVolume * arbitrageMultiplier;

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

              // Apply sell-side fees (tax + broker) to destination price only
              const effectiveDestPrice =
                destinationPrice !== null
                  ? destinationPrice * (1 - totalSellFeePct / 100)
                  : null;

              const netProfitISK =
                srcPrice !== null && effectiveDestPrice !== null
                  ? effectiveDestPrice - srcPrice
                  : 0;
              // Margin as percent gain over cost: ((sell_net - buy)/buy)*100
              const margin =
                srcPrice !== null && effectiveDestPrice !== null && srcPrice > 0
                  ? ((effectiveDestPrice - srcPrice) / srcPrice) * 100
                  : 0;
              const totalCostISK =
                srcPrice !== null ? srcPrice * arbitrageQuantity : 0;
              const totalProfitISK = netProfitISK * arbitrageQuantity;

              const round2 = (n: number) => Math.round(n * 100) / 100;
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
          const round2 = (n: number) => Math.round(n * 100) / 100;
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
            `Arb station ${destinationStationId}: items=${itemsOut.length} cost=${round2(
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
      `Arbitrage completed in ${Date.now() - startedAt}ms (stations=${stations.length})`,
    );
    return result;
  }

  async planPackages(params: {
    shippingCostByStation: Record<number, number>;
    packageCapacityM3: number;
    investmentISK: number;
    perDestinationMaxBudgetSharePerItem?: number;
    maxPackagesHint?: number;
    destinationCaps?: Record<number, { maxShare?: number; maxISK?: number }>;
    allocation?: {
      mode?: 'best' | 'targetWeighted' | 'roundRobin';
      targets?: Record<number, number>;
      spreadBias?: number;
    };
  }): Promise<PlanResult> {
    // Build DestinationConfig[] from arbitrage check results
    const arbitrage = await this.check();
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

    return this.packager.planMultiDestination(destinations, opts);
  }
}
