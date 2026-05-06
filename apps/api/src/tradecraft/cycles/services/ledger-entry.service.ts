import { Injectable } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { CAPITAL_CONSTANTS } from '../utils/capital-helpers';

export type AppendLedgerEntryInput = {
  cycleId: string;
  entryType: string;
  amountIsk: string;
  occurredAt?: Date;
  memo?: string | null;
  planCommitId?: string | null;
  participationId?: string | null;
};

@Injectable()
export class LedgerEntryService {
  constructor(private readonly prisma: PrismaService) {}

  async appendEntry(input: AppendLedgerEntryInput) {
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

  async listEntries(cycleId: string) {
    return await this.prisma.cycleLedgerEntry.findMany({
      where: { cycleId },
      orderBy: { occurredAt: 'asc' },
    });
  }

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
