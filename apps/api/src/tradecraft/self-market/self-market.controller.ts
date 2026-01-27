import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppConfig } from '@api/common/config';
import { SelfMarketCollectorService } from './self-market-collector.service';
import {
  SelfMarketDailyAggregatesQueryDto,
  SelfMarketSnapshotLatestQueryDto,
  SelfMarketStatusQueryDto,
  SelfMarketSnapshotTypeSummaryQueryDto,
} from '@api/tradecraft/market/dto/self-market.dto';

type StructureMarketOrder = {
  duration: number;
  is_buy_order: boolean;
  issued: string;
  location_id: number;
  min_volume: number;
  order_id: number;
  price: number;
  range: string;
  type_id: number;
  volume_remain: number;
  volume_total: number;
};

function utcDayStartFromYyyyMmDd(date: string): Date | null {
  // Expect YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
}

@ApiTags('admin')
@Controller('self-market')
export class SelfMarketController {
  private readonly logger = new Logger(SelfMarketController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly collector: SelfMarketCollectorService,
  ) {}

  private resolveStructureId(raw?: string): bigint | null {
    const cfg = AppConfig.marketSelfGather();
    if (raw && raw.trim()) return BigInt(raw.trim());
    return cfg.structureId;
  }

  @Get('status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Self market status (collector config + latest snapshot + latest aggregates day)',
  })
  async status(@Query() q: SelfMarketStatusQueryDto) {
    const cfg = AppConfig.marketSelfGather();
    const structureId = this.resolveStructureId(q.structureId);

    const latestSnap = structureId
      ? await this.prisma.selfMarketSnapshotLatest.findUnique({
          where: { locationId: structureId },
          select: { observedAt: true, orders: true },
        })
      : null;

    const orders = (latestSnap?.orders ??
      []) as unknown as StructureMarketOrder[];
    const orderCount = Array.isArray(orders) ? orders.length : 0;
    const buyCount = Array.isArray(orders)
      ? orders.reduce((n, o) => n + (o?.is_buy_order ? 1 : 0), 0)
      : 0;
    const sellCount = orderCount - buyCount;
    const uniqueTypes =
      Array.isArray(orders) && orders.length
        ? new Set(orders.map((o) => o.type_id)).size
        : 0;

    const latestAgg = structureId
      ? await this.prisma.selfMarketOrderTradeDaily.findFirst({
          where: { locationId: structureId },
          orderBy: { scanDate: 'desc' },
          select: { scanDate: true },
        })
      : null;

    return {
      config: {
        enabled: cfg.enabled,
        structureId: cfg.structureId?.toString() ?? null,
        characterId: cfg.characterId ?? null,
        pollMinutes: cfg.pollMinutes,
        expiryWindowMinutes: cfg.expiryWindowMinutes,
      },
      resolvedStructureId: structureId?.toString() ?? null,
      latestSnapshot: latestSnap
        ? {
            observedAt: latestSnap.observedAt.toISOString(),
            orderCount,
            buyCount,
            sellCount,
            uniqueTypes,
          }
        : null,
      latestAggregateDay: latestAgg?.scanDate
        ? latestAgg.scanDate.toISOString().slice(0, 10)
        : null,
    };
  }

  @Get('snapshot/latest')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch latest stored structure snapshot (optionally filtered)',
  })
  async snapshotLatest(@Query() q: SelfMarketSnapshotLatestQueryDto) {
    const structureId = this.resolveStructureId(q.structureId);
    if (!structureId) {
      return {
        structureId: null,
        observedAt: null,
        totalOrders: 0,
        filteredOrders: 0,
        typeNames: {} as Record<string, string>,
        orders: [] as StructureMarketOrder[],
      };
    }

    const snap = await this.prisma.selfMarketSnapshotLatest.findUnique({
      where: { locationId: structureId },
      select: { observedAt: true, orders: true },
    });

    const rawOrders = (snap?.orders ?? []) as unknown as StructureMarketOrder[];
    const list = Array.isArray(rawOrders) ? rawOrders : [];

    const wantSide = q.side ?? 'ALL';
    const wantTypeId = q.typeId;
    const limit = q.limit ?? 200;

    const matches = list.filter((o) => {
      if (!o) return false;
      if (wantTypeId && o.type_id !== wantTypeId) return false;
      if (wantSide === 'BUY' && !o.is_buy_order) return false;
      if (wantSide === 'SELL' && o.is_buy_order) return false;
      return true;
    });

    const filtered = matches.slice(0, limit);

    const typeIds = Array.from(new Set(filtered.map((o) => o.type_id)));
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
      structureId: structureId.toString(),
      observedAt: snap?.observedAt?.toISOString() ?? null,
      totalOrders: list.length,
      matchedOrders: matches.length,
      filteredOrders: filtered.length,
      typeTotalOrders: wantTypeId ? matches.length : undefined,
      typeNames,
      orders: filtered,
    };
  }

  @Get('snapshot/latest/types')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch latest snapshot grouped by typeId (type summary)',
  })
  async snapshotLatestTypes(@Query() q: SelfMarketSnapshotTypeSummaryQueryDto) {
    const structureId = this.resolveStructureId(q.structureId);
    if (!structureId) {
      return {
        structureId: null,
        observedAt: null,
        totalOrders: 0,
        matchedOrders: 0,
        uniqueTypes: 0,
        types: [] as Array<{
          typeId: number;
          typeName: string | null;
          sellCount: number;
          buyCount: number;
          bestSell: number | null;
          bestBuy: number | null;
        }>,
      };
    }

    const snap = await this.prisma.selfMarketSnapshotLatest.findUnique({
      where: { locationId: structureId },
      select: { observedAt: true, orders: true },
    });

    const rawOrders = (snap?.orders ?? []) as unknown as StructureMarketOrder[];
    const list = Array.isArray(rawOrders) ? rawOrders : [];

    const wantSide = q.side ?? 'ALL';
    const matched = list.filter((o) => {
      if (!o) return false;
      if (wantSide === 'BUY' && !o.is_buy_order) return false;
      if (wantSide === 'SELL' && o.is_buy_order) return false;
      return true;
    });

    const byType = new Map<
      number,
      {
        sellCount: number;
        buyCount: number;
        bestSell: number | null;
        bestBuy: number | null;
      }
    >();

    for (const o of matched) {
      const typeId = Number(o.type_id);
      if (!Number.isFinite(typeId)) continue;
      const entry = byType.get(typeId) ?? {
        sellCount: 0,
        buyCount: 0,
        bestSell: null,
        bestBuy: null,
      };

      const price = Number(o.price);
      if (o.is_buy_order) {
        entry.buyCount += 1;
        if (Number.isFinite(price)) {
          entry.bestBuy =
            entry.bestBuy === null ? price : Math.max(entry.bestBuy, price);
        }
      } else {
        entry.sellCount += 1;
        if (Number.isFinite(price)) {
          entry.bestSell =
            entry.bestSell === null ? price : Math.min(entry.bestSell, price);
        }
      }

      byType.set(typeId, entry);
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
          bestSell: v.bestSell,
          bestBuy: v.bestBuy,
        };
      })
      .sort((a, b) => {
        const at = a.sellCount + a.buyCount;
        const bt = b.sellCount + b.buyCount;
        if (bt !== at) return bt - at;
        return a.typeId - b.typeId;
      });

    const limitTypes = q.limitTypes ?? 200;

    return {
      structureId: structureId.toString(),
      observedAt: snap?.observedAt?.toISOString() ?? null,
      totalOrders: list.length,
      matchedOrders: matched.length,
      uniqueTypes: byType.size,
      types: types.slice(0, limitTypes),
    };
  }

  @Get('aggregates/daily')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch self-gathered daily aggregates for a structure + date',
  })
  async daily(
    @Query() q: SelfMarketDailyAggregatesQueryDto,
    @Req() req: Request,
  ) {
    const structureId = this.resolveStructureId(q.structureId);
    if (!structureId) return { structureId: null, date: null, rows: [] };

    const date = q.date ?? new Date().toISOString().slice(0, 10); // UTC date
    const scanDate = utcDayStartFromYyyyMmDd(date);
    if (!scanDate) {
      return { structureId: structureId.toString(), date, rows: [] };
    }

    // Defensive parsing: depending on global ValidationPipe settings, query params
    // may arrive as strings ("true"/"false"). Ensure "false" is treated correctly.
    const rawHasGone = (q as unknown as { hasGone?: unknown }).hasGone;
    const hasGone = parseBool(rawHasGone) ?? false;
    const side = q.side ?? 'SELL';
    const limit = q.limit ?? 500;

    if (AppConfig.env() !== 'prod') {
      const rawReqHasGone = (req.query as Record<string, unknown>)?.hasGone;
      this.logger.debug(
        `Self market daily query: date=${date} hasGone=${String(
          hasGone,
        )} (dtoRaw=${String(rawHasGone)} dtoType=${typeof rawHasGone} reqQueryHasGone=${String(
          rawReqHasGone,
        )} reqQueryType=${typeof rawReqHasGone}) side=${side} typeId=${String(
          q.typeId ?? '',
        )} limit=${String(limit)}`,
      );
    }

    const where: any = {
      locationId: structureId,
      scanDate,
      hasGone,
    };
    if (side !== 'ALL') where.isBuyOrder = side === 'BUY';
    if (q.typeId) where.typeId = q.typeId;

    const rows = await this.prisma.selfMarketOrderTradeDaily.findMany({
      where,
      orderBy: [{ iskValue: 'desc' }],
      take: limit,
      select: {
        scanDate: true,
        locationId: true,
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
      structureId: structureId.toString(),
      date,
      hasGone,
      side,
      typeNames,
      rows: rows.map((r) => ({
        scanDate: r.scanDate.toISOString().slice(0, 10),
        locationId: r.locationId.toString(),
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

  @Post('collect')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Manually trigger a single self-market collection pass (snapshot + aggregates). Useful in dev when cron jobs are off.',
  })
  async collect(@Body() body?: { forceRefresh?: boolean }) {
    try {
      const res = await this.collector.collectStructureOnce({
        forceRefresh: Boolean(body?.forceRefresh),
      });
      return {
        ok: true,
        observedAt: res.observedAt.toISOString(),
        orderCount: res.orderCount,
        tradesKeys: res.tradesKeys,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? 'unknown');
      // Treat common misconfig as a 400 for a nicer dev UX.
      if (
        msg.includes('MARKET_SELF_GATHER_STRUCTURE_ID') ||
        msg.includes('MARKET_SELF_GATHER_CHARACTER_ID')
      ) {
        throw new BadRequestException(msg);
      }
      throw e;
    }
  }

  @Post('aggregates/clear')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[Non-prod] Clear self-market daily aggregates for a UTC date so you can re-run collection in dev without confusion.',
  })
  async clearDaily(@Query() q: { date?: string; structureId?: string }) {
    if (AppConfig.env() === 'prod') {
      return { ok: false, error: 'Not allowed in prod' };
    }
    const structureId = this.resolveStructureId(q.structureId);
    if (!structureId) return { ok: false, deleted: 0, date: null };
    const date = q.date ?? new Date().toISOString().slice(0, 10);
    const scanDate = utcDayStartFromYyyyMmDd(date);
    if (!scanDate) return { ok: false, deleted: 0, date };

    const res = await this.prisma.selfMarketOrderTradeDaily.deleteMany({
      where: { locationId: structureId, scanDate },
    });
    return {
      ok: true,
      deleted: res.count,
      date,
      structureId: structureId.toString(),
    };
  }
}
