import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NavTotals = {
  deposits: string;
  withdrawals: string;
  fees: string;
  executions: string;
  net: string;
};

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async createCycle(input: { name?: string | null; startedAt: Date }) {
    return await this.prisma.cycle.create({
      data: { name: input.name ?? null, startedAt: input.startedAt },
    });
  }

  async listCycles() {
    return await this.prisma.cycle.findMany({ orderBy: { startedAt: 'desc' } });
  }

  async closeCycle(cycleId: string, closedAt: Date) {
    return await this.prisma.cycle.update({
      where: { id: cycleId },
      data: { closedAt },
    });
  }

  async appendEntry(input: {
    cycleId: string;
    entryType: string;
    amountIsk: string; // use string for decimals
    occurredAt?: Date;
    memo?: string | null;
    planCommitId?: string | null;
  }) {
    return await this.prisma.cycleLedgerEntry.create({
      data: {
        cycleId: input.cycleId,
        entryType: input.entryType,
        amount: input.amountIsk,
        occurredAt: input.occurredAt ?? new Date(),
        memo: input.memo ?? null,
        planCommitId: input.planCommitId ?? null,
      },
    });
  }

  async listEntries(cycleId: string) {
    return await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  async listEntriesEnriched(cycleId: string): Promise<
    Array<{
      id: string;
      occurredAt: Date;
      entryType: string;
      amount: string;
      memo: string | null;
      planCommitId: string | null;
      characterName: string | null;
      stationName: string | null;
      typeName: string | null;
      source: string;
      matchStatus: string | null;
    }>
  > {
    const rows = await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true,
        occurredAt: true,
        entryType: true,
        amount: true,
        memo: true,
        planCommitId: true,
        characterId: true,
        stationId: true,
        typeId: true,
        source: true,
        matchStatus: true,
      },
    });

    const charIds = Array.from(
      new Set(
        rows.map((r) => r.characterId).filter((v): v is number => v !== null),
      ),
    );
    const stationIds = Array.from(
      new Set(
        rows.map((r) => r.stationId).filter((v): v is number => v !== null),
      ),
    );
    const typeIds = Array.from(
      new Set(rows.map((r) => r.typeId).filter((v): v is number => v !== null)),
    );

    const [chars, stations, types] = await Promise.all([
      charIds.length
        ? this.prisma.eveCharacter.findMany({
            where: { id: { in: charIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]),
      stationIds.length
        ? this.prisma.stationId.findMany({
            where: { id: { in: stationIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]),
      typeIds.length
        ? this.prisma.typeId.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]),
    ]);

    const charNameById = new Map<number, string>(
      chars.map((c) => [c.id, c.name] as [number, string]),
    );
    const stationNameById = new Map<number, string>(
      stations.map((s) => [s.id, s.name] as [number, string]),
    );
    const typeNameById = new Map<number, string>(
      types.map((t) => [t.id, t.name] as [number, string]),
    );

    return rows.map((r) => ({
      id: r.id,
      occurredAt: r.occurredAt,
      entryType: r.entryType,
      amount: r.amount.toString(),
      memo: r.memo ?? null,
      planCommitId: r.planCommitId ?? null,
      characterName:
        r.characterId !== null
          ? (charNameById.get(r.characterId) ?? null)
          : null,
      stationName:
        r.stationId !== null
          ? (stationNameById.get(r.stationId) ?? null)
          : null,
      typeName: r.typeId !== null ? (typeNameById.get(r.typeId) ?? null) : null,
      source: r.source,
      matchStatus: r.matchStatus ?? null,
    }));
  }

  async computeNav(cycleId: string): Promise<NavTotals> {
    const entries = await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
    });
    const zero = BigInt(0);
    const scale = 100n; // cents for Decimal(28,2)
    const toInt = (s: string) => BigInt(s.replace(/\./, ''));

    let deposits = zero;
    let withdrawals = zero;
    let fees = zero;
    let executions = zero;

    for (const e of entries) {
      const v = toInt(e.amount.toString());
      switch (e.entryType) {
        case 'deposit':
          deposits += v;
          break;
        case 'withdrawal':
          withdrawals += v;
          break;
        case 'fee':
          fees += v;
          break;
        case 'execution':
          executions += v;
          break;
        default:
          executions += v;
      }
    }

    const fmt = (n: bigint) => (Number(n) / Number(scale)).toFixed(2);
    const net = deposits + executions - withdrawals - fees;
    return {
      deposits: fmt(deposits),
      withdrawals: fmt(withdrawals),
      fees: fmt(fees),
      executions: fmt(executions),
      net: fmt(net),
    };
  }
}
