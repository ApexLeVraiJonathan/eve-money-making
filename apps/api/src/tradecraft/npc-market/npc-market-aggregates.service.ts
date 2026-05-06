import { Injectable } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { Prisma } from '@eve/prisma';
import { NpcMarketDailyAggregatesQueryDto } from './dto/npc-market.dto';
import { utcDayStartFromYyyyMmDd } from './npc-market-date';

@Injectable()
export class NpcMarketAggregatesService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyAggregates(
    q: NpcMarketDailyAggregatesQueryDto,
    stationId: number | null,
  ) {
    if (!stationId) return { stationId: null, date: null, rows: [] };

    const date = q.date ?? new Date().toISOString().slice(0, 10);
    const scanDate = utcDayStartFromYyyyMmDd(date);
    if (!scanDate) return { stationId, date, rows: [] };

    const hasGone =
      (q.hasGone ?? '').toLowerCase() === 'true' || q.hasGone === '1';
    const side = q.side ?? 'SELL';
    const limit = q.limit ?? 500;
    const typeId = q.typeId ?? null;

    const where: Prisma.NpcMarketOrderTradeDailyWhereInput = {
      stationId,
      scanDate,
      hasGone,
    };
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
}
