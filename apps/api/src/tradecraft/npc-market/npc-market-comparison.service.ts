import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { Prisma } from '@eve/prisma';
import { NpcMarketCompareAdam4EveQueryDto } from './dto/npc-market.dto';
import { utcDayStartFromYyyyMmDd } from './npc-market-date';

@Injectable()
export class NpcMarketComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  async compareAdam4Eve(
    q: NpcMarketCompareAdam4EveQueryDto,
    stationId: number | null,
  ) {
    if (!stationId) throw new BadRequestException('Invalid stationId');
    const start = utcDayStartFromYyyyMmDd(q.startDate);
    const end = utcDayStartFromYyyyMmDd(q.endDate);
    if (!start || !end) throw new BadRequestException('Invalid date range');
    if (start.getTime() > end.getTime())
      throw new BadRequestException('startDate must be <= endDate');

    const side = q.side ?? 'SELL';
    const limit = q.limit ?? 250;

    const station = await this.prisma.stationId.findUnique({
      where: { id: stationId },
      select: { id: true, name: true },
    });

    const whereNpc: Prisma.NpcMarketOrderTradeDailyWhereInput = {
      stationId,
      scanDate: { gte: start, lte: end },
    };
    const whereAdam: Prisma.MarketOrderTradeDailyWhereInput = {
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
      npc: Record<string, string> | null;
      adam4eve: Record<string, string> | null;
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
