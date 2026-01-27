import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppConfig } from '@api/common/config';
import { NpcMarketCollectorService } from './npc-market-collector.service';
import { Prisma } from '@eve/prisma';
import { JobKeys, resolveJobEnabledFlag } from '../jobs/job-keys';

function utcDayStartFromYyyyMmDd(date: string): Date | null {
  // Expect YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

@ApiTags('admin')
@Controller('npc-market')
export class NpcMarketController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collector: NpcMarketCollectorService,
  ) {}

  private resolveStationId(raw?: string): number | null {
    const cfg = AppConfig.marketNpcGather();
    if (raw && raw.trim()) {
      const n = Number(raw.trim());
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return cfg.stationId;
  }

  @Get('status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'NPC market status (collector config + resolved station + latest successful run)',
  })
  async status(@Query() q: { stationId?: string }) {
    const cfg = AppConfig.marketNpcGather();
    const stationId = this.resolveStationId(q.stationId);
    const jobsEnabled = AppConfig.jobs().enabled;
    const appEnv = AppConfig.env();
    const globalCronEnabled = appEnv === 'prod' && jobsEnabled;
    const marketJobFlag = resolveJobEnabledFlag(JobKeys.marketGathering);
    const cronEffectiveEnabled =
      globalCronEnabled && marketJobFlag.enabled && cfg.enabled;
    const station = stationId
      ? await this.prisma.stationId.findUnique({
          where: { id: stationId },
          select: {
            id: true,
            name: true,
            solarSystem: {
              select: { id: true, name: true, regionId: true },
            },
          },
        })
      : null;

    const baseline = stationId
      ? await this.prisma.npcMarketStationBaseline.findUnique({
          where: { stationId },
          select: { baselineId: true, observedAt: true, regionId: true },
        })
      : null;

    const latestSnapshot =
      stationId && baseline?.baselineId
        ? await (async () => {
            const baselineId = baseline.baselineId;
            const [buyAgg, sellAgg, uniqueTypesRows] = await Promise.all([
              this.prisma.npcMarketSnapshot.aggregate({
                where: { stationId, baselineId, isBuyOrder: true },
                _sum: { orderCount: true },
              }),
              this.prisma.npcMarketSnapshot.aggregate({
                where: { stationId, baselineId, isBuyOrder: false },
                _sum: { orderCount: true },
              }),
              this.prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
                SELECT COUNT(DISTINCT type_id)::bigint AS n
                FROM npc_market_snapshots
                WHERE station_id = ${stationId}
                  AND baseline_id = ${baselineId}
                  AND order_count > 0
              `),
            ]);
            const buyCount = Number(buyAgg._sum.orderCount ?? 0);
            const sellCount = Number(sellAgg._sum.orderCount ?? 0);
            const uniqueTypes = Number(uniqueTypesRows?.[0]?.n ?? 0);
            return {
              observedAt: baseline.observedAt.toISOString(),
              orderCount: buyCount + sellCount,
              buyCount,
              sellCount,
              uniqueTypes,
            };
          })()
        : null;

    const latestAgg = stationId
      ? await this.prisma.npcMarketOrderTradeDaily.findFirst({
          where: { stationId },
          orderBy: { scanDate: 'desc' },
          select: { scanDate: true },
        })
      : null;

    const lastRun = stationId
      ? await this.prisma.npcMarketRun.findFirst({
          where: { stationId },
          orderBy: { startedAt: 'desc' },
          select: {
            baselineId: true,
            startedAt: true,
            finishedAt: true,
            ok: true,
            typeCount: true,
            errorMessage: true,
          },
        })
      : null;

    return {
      config: {
        enabled: cfg.enabled,
        stationId: cfg.stationId,
        pollMinutes: cfg.pollMinutes,
        expiryWindowMinutes: cfg.expiryWindowMinutes,
      },
      cron: {
        appEnv,
        jobsEnabled,
        jobEnabled: marketJobFlag.enabled,
        jobEnabledSourceKey: marketJobFlag.sourceKey,
        effectiveEnabled: cronEffectiveEnabled,
      },
      resolvedStation: station
        ? {
            stationId: station.id,
            stationName: station.name,
            solarSystemId: station.solarSystem.id,
            solarSystemName: station.solarSystem.name,
            regionId: station.solarSystem.regionId,
          }
        : null,
      latestSnapshot,
      latestAggregateDay: latestAgg?.scanDate
        ? latestAgg.scanDate.toISOString().slice(0, 10)
        : null,
      activeBaseline: baseline
        ? {
            baselineId: baseline.baselineId,
            observedAt: baseline.observedAt.toISOString(),
            regionId: baseline.regionId,
          }
        : null,
      lastRun: lastRun
        ? {
            baselineId: lastRun.baselineId,
            startedAt: lastRun.startedAt.toISOString(),
            finishedAt: lastRun.finishedAt?.toISOString() ?? null,
            ok: lastRun.ok,
            typeCount: lastRun.typeCount,
            errorMessage: lastRun.errorMessage,
          }
        : null,
    };
  }

  @Post('collect')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Manually trigger one full NPC market collection pass for a station (region types + snapshots + aggregates).',
  })
  async collect(
    @Query() q: { stationId?: string },
    @Body() body?: { forceRefresh?: boolean },
  ) {
    const stationId = this.resolveStationId(q.stationId);
    if (!stationId) throw new BadRequestException('Invalid stationId');
    const res = await this.collector.collectStationOnce({
      stationId,
      forceRefresh: Boolean(body?.forceRefresh),
    });
    return res;
  }

  @Get('snapshot/latest/types')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Fetch latest NPC snapshot grouped by typeId (type summary, derived from stored snapshot stats)',
  })
  async snapshotLatestTypes(
    @Query()
    q: {
      stationId?: string;
      side?: 'ALL' | 'BUY' | 'SELL';
      limitTypes?: string;
    },
  ) {
    const stationId = this.resolveStationId(q.stationId);
    if (!stationId)
      return { stationId: null, baselineId: null, observedAt: null, types: [] };

    const baseline = await this.prisma.npcMarketStationBaseline.findUnique({
      where: { stationId },
      select: { baselineId: true, observedAt: true },
    });
    if (!baseline) {
      return { stationId, baselineId: null, observedAt: null, types: [] };
    }

    const side = q.side ?? 'ALL';
    const limitTypes = Math.min(5000, Math.max(1, Number(q.limitTypes ?? 200)));
    const where: any = { stationId, baselineId: baseline.baselineId };
    if (side !== 'ALL') where.isBuyOrder = side === 'BUY';

    const rows = await this.prisma.npcMarketSnapshot.findMany({
      where,
      select: {
        typeId: true,
        isBuyOrder: true,
        orderCount: true,
        bestPrice: true,
      },
    });

    const byType = new Map<
      number,
      {
        sellCount: number;
        buyCount: number;
        bestSell: Prisma.Decimal | null;
        bestBuy: Prisma.Decimal | null;
      }
    >();

    for (const r of rows) {
      // Ignore empty snapshots (no station orders for this type+side)
      if (!r.orderCount) continue;
      const entry = byType.get(r.typeId) ?? {
        sellCount: 0,
        buyCount: 0,
        bestSell: null,
        bestBuy: null,
      };
      if (r.isBuyOrder) {
        entry.buyCount = r.orderCount;
        entry.bestBuy = r.bestPrice ?? null;
      } else {
        entry.sellCount = r.orderCount;
        entry.bestSell = r.bestPrice ?? null;
      }
      byType.set(r.typeId, entry);
    }

    const typeIds = Array.from(byType.keys());
    const typeRows =
      typeIds.length > 0
        ? await this.prisma.typeId.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map<number, string>();
    for (const t of typeRows) nameById.set(t.id, t.name);

    const types = typeIds
      .map((typeId) => {
        const v = byType.get(typeId)!;
        return {
          typeId,
          typeName: nameById.get(typeId) ?? null,
          sellCount: v.sellCount,
          buyCount: v.buyCount,
          bestSell: v.bestSell ? Number(v.bestSell) : null,
          bestBuy: v.bestBuy ? Number(v.bestBuy) : null,
        };
      })
      .sort((a, b) => {
        const at = a.sellCount + a.buyCount;
        const bt = b.sellCount + b.buyCount;
        if (bt !== at) return bt - at;
        return a.typeId - b.typeId;
      })
      .slice(0, limitTypes);

    return {
      stationId,
      baselineId: baseline.baselineId,
      observedAt: baseline.observedAt.toISOString(),
      side,
      types,
    };
  }

  @Get('snapshot/latest')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Fetch latest stored NPC station snapshot (requires typeId; optionally filtered by side)',
  })
  async snapshotLatest(
    @Query()
    q: {
      stationId?: string;
      typeId?: string;
      side?: 'ALL' | 'BUY' | 'SELL';
      limit?: string;
    },
  ) {
    const stationId = this.resolveStationId(q.stationId);
    if (!stationId) {
      return {
        stationId: null,
        baselineId: null,
        observedAt: null,
        totalOrders: 0,
        matchedOrders: 0,
        filteredOrders: 0,
        typeNames: {} as Record<string, string>,
        orders: [] as any[],
      };
    }

    const baseline = await this.prisma.npcMarketStationBaseline.findUnique({
      where: { stationId },
      select: { baselineId: true, observedAt: true },
    });
    if (!baseline) {
      return {
        stationId,
        baselineId: null,
        observedAt: null,
        totalOrders: 0,
        matchedOrders: 0,
        filteredOrders: 0,
        typeNames: {} as Record<string, string>,
        orders: [] as any[],
      };
    }

    const typeId = q.typeId ? Number(q.typeId) : null;
    if (!typeId || !Number.isFinite(typeId) || typeId <= 0) {
      // For NPC snapshots, we require typeId to avoid returning huge payloads.
      return {
        stationId,
        baselineId: baseline.baselineId,
        observedAt: baseline.observedAt.toISOString(),
        totalOrders: 0,
        matchedOrders: 0,
        filteredOrders: 0,
        typeNames: {} as Record<string, string>,
        orders: [] as any[],
      };
    }

    const wantSide = q.side ?? 'ALL';
    const limit = Math.min(50_000, Math.max(1, Number(q.limit ?? 500)));

    const where: any = { stationId, baselineId: baseline.baselineId, typeId };
    if (wantSide === 'BUY') where.isBuyOrder = true;
    if (wantSide === 'SELL') where.isBuyOrder = false;

    const snaps = await this.prisma.npcMarketSnapshot.findMany({
      where,
      select: { orders: true },
    });

    const allOrders = snaps.flatMap((s) => {
      const list = (s.orders ?? []) as unknown as any[];
      return Array.isArray(list) ? list : [];
    });
    const filtered = allOrders.slice(0, limit);

    const typeRow = await this.prisma.typeId.findUnique({
      where: { id: typeId },
      select: { id: true, name: true },
    });
    const typeNames: Record<string, string> = {};
    if (typeRow) typeNames[String(typeRow.id)] = typeRow.name;

    return {
      stationId,
      baselineId: baseline.baselineId,
      observedAt: baseline.observedAt.toISOString(),
      totalOrders: allOrders.length,
      matchedOrders: allOrders.length,
      filteredOrders: filtered.length,
      typeNames,
      orders: filtered,
    };
  }

  @Get('aggregates/daily')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch NPC self-gathered daily aggregates for a station + date',
  })
  async daily(
    @Query()
    q: {
      stationId?: string;
      date?: string;
      hasGone?: string;
      side?: 'ALL' | 'BUY' | 'SELL';
      typeId?: string;
      limit?: string;
    },
  ) {
    const stationId = this.resolveStationId(q.stationId);
    if (!stationId) return { stationId: null, date: null, rows: [] };

    const date = q.date ?? new Date().toISOString().slice(0, 10);
    const scanDate = utcDayStartFromYyyyMmDd(date);
    if (!scanDate) return { stationId, date, rows: [] };

    const hasGone =
      (q.hasGone ?? '').toLowerCase() === 'true' || q.hasGone === '1';
    const side = q.side ?? 'SELL';
    const limit = Math.min(5000, Math.max(1, Number(q.limit ?? 500)));
    const typeId = q.typeId ? Number(q.typeId) : null;

    const where: any = { stationId, scanDate, hasGone };
    if (side !== 'ALL') where.isBuyOrder = side === 'BUY';
    if (typeId && Number.isFinite(typeId) && typeId > 0) where.typeId = typeId;

    const rows = await this.prisma.npcMarketOrderTradeDaily.findMany({
      where,
      orderBy: [{ iskValue: 'desc' }],
      take: limit,
      select: {
        scanDate: true,
        stationId: true,
        typeId: true,
        isBuyOrder: true,
        hasGone: true,
        amount: true,
        high: true,
        low: true,
        avg: true,
        orderNum: true,
        iskValue: true,
      },
    });

    const typeIds = Array.from(new Set(rows.map((r) => r.typeId)));
    const typeRows =
      typeIds.length > 0
        ? await this.prisma.typeId.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
          })
        : [];
    const typeNames: Record<string, string> = {};
    for (const t of typeRows) typeNames[String(t.id)] = t.name;

    return {
      stationId,
      date,
      hasGone,
      side,
      typeNames,
      rows: rows.map((r) => ({
        scanDate: r.scanDate.toISOString().slice(0, 10),
        stationId: r.stationId,
        typeId: r.typeId,
        isBuyOrder: r.isBuyOrder,
        hasGone: r.hasGone,
        amount: r.amount.toString(),
        orderNum: r.orderNum.toString(),
        iskValue: r.iskValue.toString(),
        high: r.high.toString(),
        low: r.low.toString(),
        avg: r.avg.toString(),
      })),
    };
  }

  @Get('compare/adam4eve')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Compare NPC self-gathered daily aggregates vs Adam4EVE-imported daily aggregates for a station over a date range.',
  })
  async compareAdam4Eve(
    @Query()
    q: {
      stationId?: string;
      startDate: string; // YYYY-MM-DD
      endDate: string; // YYYY-MM-DD
      side?: 'ALL' | 'BUY' | 'SELL';
      limit?: string;
    },
  ) {
    const stationId = this.resolveStationId(q.stationId);
    if (!stationId) throw new BadRequestException('Invalid stationId');
    const start = utcDayStartFromYyyyMmDd(q.startDate);
    const end = utcDayStartFromYyyyMmDd(q.endDate);
    if (!start || !end) throw new BadRequestException('Invalid date range');
    if (start.getTime() > end.getTime())
      throw new BadRequestException('startDate must be <= endDate');

    const side = q.side ?? 'SELL';
    const limit = Math.min(2000, Math.max(1, Number(q.limit ?? 250)));

    const station = await this.prisma.stationId.findUnique({
      where: { id: stationId },
      select: { id: true, name: true },
    });

    const whereNpc: any = { stationId, scanDate: { gte: start, lte: end } };
    const whereAdam: any = {
      locationId: stationId,
      scanDate: { gte: start, lte: end },
    };
    if (side !== 'ALL') {
      const isBuy = side === 'BUY';
      whereNpc.isBuyOrder = isBuy;
      whereAdam.isBuyOrder = isBuy;
    }

    const [npcRows, adamRows, runs] = await Promise.all([
      this.prisma.npcMarketOrderTradeDaily.findMany({
        where: whereNpc,
        select: {
          scanDate: true,
          stationId: true,
          typeId: true,
          isBuyOrder: true,
          hasGone: true,
          amount: true,
          orderNum: true,
          iskValue: true,
          high: true,
          low: true,
          avg: true,
        },
      }),
      this.prisma.marketOrderTradeDaily.findMany({
        where: whereAdam,
        select: {
          scanDate: true,
          locationId: true,
          typeId: true,
          isBuyOrder: true,
          hasGone: true,
          amount: true,
          orderNum: true,
          iskValue: true,
          high: true,
          low: true,
          avg: true,
        },
      }),
      this.prisma.npcMarketRun.findMany({
        where: {
          stationId,
          ok: true,
          startedAt: {
            gte: start,
            lte: new Date(end.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        select: { startedAt: true },
      }),
    ]);

    const keyOf = (d: Date, typeId: number, isBuy: boolean, hasGone: boolean) =>
      `${d.toISOString().slice(0, 10)}:${typeId}:${isBuy ? 'B' : 'S'}:${hasGone ? 'G1' : 'G0'}`;

    const npcByKey = new Map<string, (typeof npcRows)[number]>();
    for (const r of npcRows)
      npcByKey.set(keyOf(r.scanDate, r.typeId, r.isBuyOrder, r.hasGone), r);

    const adamByKey = new Map<string, (typeof adamRows)[number]>();
    for (const r of adamRows)
      adamByKey.set(keyOf(r.scanDate, r.typeId, r.isBuyOrder, r.hasGone), r);

    const allKeys = new Set<string>([...npcByKey.keys(), ...adamByKey.keys()]);
    const diffs: Array<{
      key: string;
      scanDate: string;
      typeId: number;
      isBuyOrder: boolean;
      hasGone: boolean;
      npc: any | null;
      adam4eve: any | null;
      diff: {
        amount: string | null;
        orderNum: string | null;
        iskValue: string | null;
        absIskValue: string | null;
      };
    }> = [];

    let missingNpc = 0;
    let missingAdam = 0;

    for (const key of allKeys) {
      const npc = npcByKey.get(key) ?? null;
      const adam = adamByKey.get(key) ?? null;
      if (!npc) missingNpc++;
      if (!adam) missingAdam++;

      // Only rank diffs where both exist; still include missing rows for diagnostics.
      const iskDiff =
        npc && adam
          ? new Prisma.Decimal(npc.iskValue.toString()).sub(
              new Prisma.Decimal(adam.iskValue.toString()),
            )
          : null;
      const absIsk = iskDiff ? iskDiff.abs() : null;

      const [scanDate, typeIdStr, sideStr, goneStr] = key.split(':');
      diffs.push({
        key,
        scanDate,
        typeId: Number(typeIdStr),
        isBuyOrder: sideStr === 'B',
        hasGone: goneStr === 'G1',
        npc: npc
          ? {
              amount: npc.amount.toString(),
              orderNum: npc.orderNum.toString(),
              iskValue: npc.iskValue.toString(),
              high: npc.high.toString(),
              low: npc.low.toString(),
              avg: npc.avg.toString(),
            }
          : null,
        adam4eve: adam
          ? {
              amount: String(adam.amount),
              orderNum: String(adam.orderNum),
              iskValue: adam.iskValue.toString(),
              high: adam.high.toString(),
              low: adam.low.toString(),
              avg: adam.avg.toString(),
            }
          : null,
        diff: {
          amount:
            npc && adam ? (npc.amount - BigInt(adam.amount)).toString() : null,
          orderNum:
            npc && adam
              ? (npc.orderNum - BigInt(adam.orderNum)).toString()
              : null,
          iskValue: iskDiff ? iskDiff.toString() : null,
          absIskValue: absIsk ? absIsk.toString() : null,
        },
      });
    }

    // Rank by absolute ISK diff, but keep missing rows at the bottom.
    diffs.sort((a, b) => {
      const aa = a.diff.absIskValue
        ? new Prisma.Decimal(a.diff.absIskValue)
        : null;
      const bb = b.diff.absIskValue
        ? new Prisma.Decimal(b.diff.absIskValue)
        : null;
      if (!aa && !bb) return 0;
      if (!aa) return 1;
      if (!bb) return -1;
      return bb.comparedTo(aa);
    });

    const runsByDay = new Map<string, number>();
    for (const r of runs) {
      const day = r.startedAt.toISOString().slice(0, 10);
      runsByDay.set(day, (runsByDay.get(day) ?? 0) + 1);
    }

    return {
      station: station
        ? { id: station.id, name: station.name }
        : { id: stationId, name: null },
      range: { startDate: q.startDate, endDate: q.endDate },
      side,
      summary: {
        npcRows: npcRows.length,
        adamRows: adamRows.length,
        unionKeys: allKeys.size,
        missingNpc,
        missingAdam,
      },
      coverage: {
        successfulNpcRunsByDay: Object.fromEntries(runsByDay.entries()),
      },
      diffs: diffs.slice(0, limit),
    };
  }
}
