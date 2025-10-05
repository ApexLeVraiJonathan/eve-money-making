import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  async listCommits(limit = 25, offset = 0) {
    return await this.prisma.planCommit.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      skip: Math.max(offset, 0),
      select: { id: true, createdAt: true, memo: true },
    });
  }

  async getCommitStatus(commitId: string) {
    const commit = await this.prisma.planCommit.findUnique({
      where: { id: commitId },
      select: { id: true, createdAt: true, memo: true },
    });
    if (!commit) throw new NotFoundException('Commit not found');

    const lines = await this.prisma.planCommitLine.findMany({
      where: { commitId },
      select: {
        typeId: true,
        sourceStationId: true,
        destinationStationId: true,
        plannedUnits: true,
        unitCost: true,
        unitProfit: true,
      },
    });

    const ledger = await this.prisma.cycleLedgerEntry.findMany({
      where: { planCommitId: commitId },
      select: {
        entryType: true,
        amount: true,
        stationId: true,
        typeId: true,
      },
    });

    // Name lookups
    const typeIds = Array.from(new Set(lines.map((l) => l.typeId)));
    const stationIds = Array.from(
      new Set(
        lines
          .flatMap((l) => [l.sourceStationId, l.destinationStationId])
          .filter((v): v is number => typeof v === 'number'),
      ),
    );
    const [types, stations] = await Promise.all([
      typeIds.length
        ? this.prisma.typeId.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]),
      stationIds.length
        ? this.prisma.stationId.findMany({
            where: { id: { in: stationIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]),
    ]);
    const typeNameById = new Map<number, string>(
      types.map((t) => [t.id, t.name] as [number, string]),
    );
    const stationNameById = new Map<number, string>(
      stations.map((s) => [s.id, s.name] as [number, string]),
    );

    // Aggregate ledger by sign and station/type
    const sum = (a: string, b: string) => (Number(a) + Number(b)).toFixed(2);
    const key = (
      stationId: number | null,
      typeId: number | null,
      side: 'buy' | 'sell',
    ) => `${stationId ?? '-'}|${typeId ?? '-'}|${side}`;
    const ledgerMap = new Map<string, string>();
    let buysTotal = '0.00';
    let sellsTotal = '0.00';
    let feesTotal = '0.00';
    for (const e of ledger) {
      const amt = e.amount.toString();
      if (e.entryType === 'fee') {
        feesTotal = sum(feesTotal, amt);
        continue;
      }
      if (e.entryType === 'execution') {
        if (Number(amt) < 0) {
          buysTotal = sum(buysTotal, amt);
          const k = key(e.stationId ?? null, e.typeId ?? null, 'buy');
          ledgerMap.set(k, sum(ledgerMap.get(k) ?? '0.00', amt));
        } else {
          sellsTotal = sum(sellsTotal, amt);
          const k = key(e.stationId ?? null, e.typeId ?? null, 'sell');
          ledgerMap.set(k, sum(ledgerMap.get(k) ?? '0.00', amt));
        }
      }
    }

    // Compute unit progression per line using wallet transactions
    const typeIdsForTx = Array.from(new Set(lines.map((l) => l.typeId)));
    const txSince = new Date(commit.createdAt.getTime() - 2 * 60 * 60 * 1000); // 2h before commit for safety
    const txs = await this.prisma.walletTransaction.findMany({
      where: { typeId: { in: typeIdsForTx }, date: { gte: txSince } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        isBuy: true,
        locationId: true,
        typeId: true,
        quantity: true,
        unitPrice: true,
      },
    });

    const linesOut = lines.map((l) => {
      const buyKey = key(l.sourceStationId, l.typeId, 'buy');
      const sellKey = key(l.destinationStationId, l.typeId, 'sell');
      const buySpend = ledgerMap.get(buyKey) ?? '0.00';
      const sellRevenue = ledgerMap.get(sellKey) ?? '0.00';

      // Units: buys within 60m of commit at source; sells at destination after commit time
      const buyWindowStart = new Date(
        commit.createdAt.getTime() - 60 * 60 * 1000,
      );
      const buyWindowEnd = new Date(
        commit.createdAt.getTime() + 60 * 60 * 1000,
      );
      let buyUnits = 0;
      let sellUnits = 0;
      for (const t of txs) {
        if (t.typeId !== l.typeId) continue;
        if (t.isBuy) {
          if (
            t.locationId === l.sourceStationId &&
            t.date >= buyWindowStart &&
            t.date <= buyWindowEnd
          ) {
            // Cap to planned units
            const canAdd = Math.max(0, l.plannedUnits - buyUnits);
            if (canAdd > 0) buyUnits += Math.min(canAdd, t.quantity);
          }
        } else {
          if (
            t.locationId === l.destinationStationId &&
            t.date >= commit.createdAt
          ) {
            // Cap to bought units (cannot sell more than bought)
            const canAdd = Math.max(
              0,
              Math.min(l.plannedUnits, buyUnits) - sellUnits,
            );
            if (canAdd > 0) sellUnits += Math.min(canAdd, t.quantity);
          }
        }
      }

      return {
        typeId: l.typeId,
        typeName: typeNameById.get(l.typeId) ?? String(l.typeId),
        sourceStationId: l.sourceStationId,
        sourceStationName:
          stationNameById.get(l.sourceStationId) ?? String(l.sourceStationId),
        destinationStationId: l.destinationStationId,
        destinationStationName:
          stationNameById.get(l.destinationStationId) ??
          String(l.destinationStationId),
        plannedUnits: l.plannedUnits,
        unitCost: l.unitCost.toString(),
        unitProfit: l.unitProfit.toString(),
        buySpendISK: buySpend,
        sellRevenueISK: sellRevenue,
        buySeen: Number(buySpend) < 0,
        sellSeen: Number(sellRevenue) > 0,
        buyUnits,
        sellUnits,
        remainingUnits: Math.max(0, l.plannedUnits - sellUnits),
      };
    });

    return {
      commit,
      totals: {
        buysISK: buysTotal,
        sellsISK: sellsTotal,
        feesISK: feesTotal,
      },
      lines: linesOut,
    };
  }
  async getCommit(id: string) {
    const commit = await this.prisma.planCommit.findUnique({ where: { id } });
    if (!commit) throw new NotFoundException('Commit not found');
    return commit;
  }

  async listLinkedEntries(commitId: string, limit?: number, offset?: number) {
    return await this.prisma.cycleLedgerEntry.findMany({
      where: { planCommitId: commitId },
      orderBy: { occurredAt: 'asc' },
      take: Math.min(Math.max(limit ?? 200, 1), 1000),
      skip: Math.max(offset ?? 0, 0),
    });
  }

  async linkEntryToCommit(entryId: string, commitId: string) {
    // Ensure both exist
    const commit = await this.prisma.planCommit.findUnique({
      where: { id: commitId },
    });
    if (!commit) throw new NotFoundException('Commit not found');
    const entry = await this.prisma.cycleLedgerEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry) throw new NotFoundException('Entry not found');
    const updated = await this.prisma.cycleLedgerEntry.update({
      where: { id: entryId },
      data: { planCommitId: commitId },
    });
    this.logger.debug(`Linked entry ${entryId} to commit ${commitId}`);
    return updated;
  }

  private async getOpenCycleIdFor(date: Date): Promise<string> {
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
      if (!latest)
        throw new NotFoundException('No cycle found. Create a Cycle first.');
      return latest.id;
    }
    return cycle.id;
  }

  private toAmountString(n: number): string {
    return n.toFixed(2);
  }

  private async linkBestCommitForExecution(entry: {
    id: string;
    occurredAt: Date;
    stationId: number | null;
    typeId: number | null;
    amount: unknown;
  }): Promise<void> {
    if (!entry.typeId || !entry.stationId) return;
    const amountNum = Number(entry.amount);
    const isSell = amountNum > 0; // sell proceeds are positive, buys negative
    type CommitLineSlim = Prisma.PlanCommitLineGetPayload<{
      select: { commit: { select: { id: true; createdAt: true } } };
    }>;
    const lines: CommitLineSlim[] = await this.prisma.planCommitLine.findMany({
      select: { commit: { select: { id: true, createdAt: true } } },
      where: {
        typeId: entry.typeId,
        ...(isSell
          ? { destinationStationId: entry.stationId }
          : { sourceStationId: entry.stationId }),
      },
      orderBy: { commit: { createdAt: 'desc' } },
      take: 50,
    });
    if (!lines.length) return;
    let best: { commitId: string; d: number } | null = null;
    const t = entry.occurredAt.getTime();
    for (const l of lines) {
      const d = Math.abs(new Date(l.commit.createdAt).getTime() - t);
      if (best === null || d < best.d) best = { commitId: l.commit.id, d };
    }
    // 21 days window
    if (best && best.d <= 21 * 24 * 3600 * 1000) {
      await this.prisma.cycleLedgerEntry.update({
        where: { id: entry.id },
        data: { planCommitId: best.commitId, matchStatus: 'linked' },
      });
    } else {
      await this.prisma.cycleLedgerEntry.update({
        where: { id: entry.id },
        data: { matchStatus: 'unlinked' },
      });
    }
  }

  async reconcileFromWallet(): Promise<{ created: number; linked: number }> {
    let created = 0;
    let linked = 0;

    // Transactions -> execution entries
    type WalletTxSlim = Prisma.WalletTransactionGetPayload<{
      select: {
        characterId: true;
        transactionId: true;
        date: true;
        isBuy: true;
        locationId: true;
        typeId: true;
        quantity: true;
        unitPrice: true;
      };
    }>;
    const txs: WalletTxSlim[] = await this.prisma.walletTransaction.findMany({
      orderBy: { date: 'asc' },
      select: {
        characterId: true,
        transactionId: true,
        date: true,
        isBuy: true,
        locationId: true,
        typeId: true,
        quantity: true,
        unitPrice: true,
      },
    });
    for (const t of txs) {
      const cycleId = await this.getOpenCycleIdFor(new Date(t.date));
      const sign = t.isBuy ? -1 : 1;
      const amount = this.toAmountString(
        sign * Number(t.unitPrice) * t.quantity,
      );
      const sourceId = `${t.characterId}:${t.transactionId}`;
      try {
        const entry = await this.prisma.cycleLedgerEntry.upsert({
          where: { source_sourceId: { source: 'wallet_tx', sourceId } },
          update: {},
          create: {
            cycleId,
            occurredAt: new Date(t.date),
            entryType: 'execution',
            amount,
            memo: null,
            planCommitId: null,
            characterId: t.characterId,
            stationId: t.locationId,
            typeId: t.typeId,
            source: 'wallet_tx',
            sourceId,
            matchStatus: null,
          },
          select: {
            id: true,
            occurredAt: true,
            stationId: true,
            typeId: true,
            amount: true,
          },
        });
        created++;
        await this.linkBestCommitForExecution(entry);
        linked++;
      } catch {
        // existing -> try linking if missing
        const existing = await this.prisma.cycleLedgerEntry.findUnique({
          where: { source_sourceId: { source: 'wallet_tx', sourceId } },
          select: {
            id: true,
            occurredAt: true,
            stationId: true,
            typeId: true,
            amount: true,
            planCommitId: true,
          },
        });
        if (existing && !existing.planCommitId) {
          await this.linkBestCommitForExecution(existing);
          linked++;
        }
      }
    }

    // Journal -> fee entries (selected types)
    const feeRefs = new Set([
      'transaction_tax',
      'brokers_fee',
      'contract_broker_fee',
      'contract_reward',
      'contract_deposit',
    ]);
    type WalletJrSlim = Prisma.WalletJournalEntryGetPayload<{
      select: {
        characterId: true;
        journalId: true;
        date: true;
        refType: true;
        amount: true;
      };
    }>;
    const jr: WalletJrSlim[] = await this.prisma.walletJournalEntry.findMany({
      orderBy: { date: 'asc' },
      select: {
        characterId: true,
        journalId: true,
        date: true,
        refType: true,
        amount: true,
      },
    });
    for (const r of jr) {
      if (!feeRefs.has(r.refType)) continue;
      const cycleId = await this.getOpenCycleIdFor(new Date(r.date));
      const amount = this.toAmountString(Number(r.amount));
      const sourceId = `${r.characterId}:${r.journalId}`;
      try {
        await this.prisma.cycleLedgerEntry.upsert({
          where: { source_sourceId: { source: 'wallet_journal', sourceId } },
          update: {},
          create: {
            cycleId,
            occurredAt: new Date(r.date),
            entryType: 'fee',
            amount,
            memo: r.refType,
            planCommitId: null,
            characterId: r.characterId,
            stationId: null,
            typeId: null,
            source: 'wallet_journal',
            sourceId,
            matchStatus: 'linked',
          },
        });
        created++;
      } catch {
        // ignore duplicates
      }
    }

    return { created, linked };
  }

  // Strict mode: write only matched rows; require an explicit cycle (or pick the latest open)
  async reconcileFromWalletStrict(
    cycleIdOrNull: string | null,
  ): Promise<{ created: number }> {
    const cycleId = cycleIdOrNull ?? (await this.getOpenCycleIdFor(new Date()));
    // Build commit lines working set for this cycle's commits
    const commits = await this.prisma.planCommit.findMany({
      where: {
        createdAt: { lte: new Date() },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const commitIds = commits.map((c) => c.id);
    const lines = await this.prisma.planCommitLine.findMany({
      where: { commitId: { in: commitIds } },
      select: {
        id: true,
        commitId: true,
        typeId: true,
        sourceStationId: true,
        destinationStationId: true,
        plannedUnits: true,
        commit: { select: { createdAt: true } },
      },
      orderBy: { commit: { createdAt: 'asc' } },
    });
    const plannedByLine = new Map<string, number>();
    const boughtUnitsByLine = new Map<string, number>();
    const soldUnitsByLine = new Map<string, number>();
    for (const l of lines) plannedByLine.set(l.id, l.plannedUnits);

    let created = 0;

    // Helper to match a buy
    const matchBuy = (t: {
      typeId: number;
      stationId: number;
      date: Date;
      quantity: number;
    }) => {
      const windowMs = 60 * 60 * 1000; // 60 minutes
      let best: { lineId: string; d: number } | null = null;
      for (const l of lines) {
        if (l.typeId !== t.typeId) continue;
        if (l.sourceStationId !== t.stationId) continue;
        const d = Math.abs(
          new Date(l.commit.createdAt).getTime() - t.date.getTime(),
        );
        if (d <= windowMs && (best === null || d < best.d))
          best = { lineId: l.id, d };
      }
      return best?.lineId ?? null;
    };

    // Helper to match a sell
    const matchSell = (t: { typeId: number; stationId: number }) => {
      for (const l of lines) {
        if (l.typeId !== t.typeId) continue;
        if (l.destinationStationId !== t.stationId) continue;
        const bought = boughtUnitsByLine.get(l.id) ?? 0;
        const sold = soldUnitsByLine.get(l.id) ?? 0;
        if (bought - sold > 0) return l.id;
      }
      return null;
    };

    // Transactions
    const rowsToInsert: Array<{
      cycleId: string;
      occurredAt: Date;
      entryType: 'execution' | 'fee';
      amount: string;
      memo: string | null;
      planCommitId: string | null;
      characterId: number | null;
      stationId: number | null;
      typeId: number | null;
      source: string;
      sourceId: string;
      matchStatus: string | null;
    }> = [];
    const txs = await this.prisma.walletTransaction.findMany({
      orderBy: { date: 'asc' },
      select: {
        characterId: true,
        transactionId: true,
        date: true,
        isBuy: true,
        locationId: true,
        typeId: true,
        quantity: true,
        unitPrice: true,
      },
    });
    for (const t of txs) {
      const stationId = t.locationId;
      if (t.isBuy) {
        const lineId = matchBuy({
          typeId: t.typeId,
          stationId,
          date: t.date,
          quantity: t.quantity,
        });
        if (!lineId) continue; // skip unmatched buys
        const planned = plannedByLine.get(lineId) ?? 0;
        const bought = boughtUnitsByLine.get(lineId) ?? 0;
        const allow = Math.max(0, planned - bought);
        const consumed = Math.min(allow, t.quantity);
        if (consumed <= 0) continue;
        rowsToInsert.push({
          cycleId,
          occurredAt: new Date(t.date),
          entryType: 'execution',
          amount: (-Number(t.unitPrice) * consumed).toFixed(2),
          memo: null,
          planCommitId: lines.find((l) => l.id === lineId)?.commitId ?? null,
          characterId: t.characterId,
          stationId,
          typeId: t.typeId,
          source: 'wallet_tx',
          sourceId: `${t.characterId}:${t.transactionId}`,
          matchStatus: 'linked',
        });
        boughtUnitsByLine.set(lineId, bought + consumed);
        created++;
      } else {
        const lineId = matchSell({ typeId: t.typeId, stationId });
        if (!lineId) continue; // skip unrelated sells
        const bought = boughtUnitsByLine.get(lineId) ?? 0;
        const sold = soldUnitsByLine.get(lineId) ?? 0;
        const allow = Math.max(0, bought - sold);
        const consumed = Math.min(allow, t.quantity);
        if (consumed <= 0) continue;
        rowsToInsert.push({
          cycleId,
          occurredAt: new Date(t.date),
          entryType: 'execution',
          amount: (Number(t.unitPrice) * consumed).toFixed(2),
          memo: null,
          planCommitId: lines.find((l) => l.id === lineId)?.commitId ?? null,
          characterId: t.characterId,
          stationId,
          typeId: t.typeId,
          source: 'wallet_tx',
          sourceId: `${t.characterId}:${t.transactionId}`,
          matchStatus: 'linked',
        });
        soldUnitsByLine.set(lineId, sold + consumed);
        created++;
      }
    }

    if (rowsToInsert.length) {
      // Batch insert with skipDuplicates (unique source/sourceId)
      // Chunk to avoid huge payloads
      const chunkSize = 500;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);

        await this.prisma.cycleLedgerEntry.createMany({
          data: chunk,
          skipDuplicates: true,
        });
      }
    }

    // Journal fees: attach only if a related execution exists near the time (simple heuristic)
    const jr = await this.prisma.walletJournalEntry.findMany({
      orderBy: { date: 'asc' },
      select: {
        characterId: true,
        journalId: true,
        date: true,
        refType: true,
        amount: true,
      },
    });
    const feeRefs = new Set([
      'transaction_tax',
      'brokers_fee',
      'contract_broker_fee',
      'contract_reward',
      'contract_deposit',
    ]);
    for (const r of jr) {
      if (!feeRefs.has(r.refType)) continue;
      // naive association: if there's any execution created within ±5m for same character, attach to its commit
      const since = new Date(r.date.getTime() - 5 * 60 * 1000);
      const until = new Date(r.date.getTime() + 5 * 60 * 1000);
      const exec = await this.prisma.cycleLedgerEntry.findFirst({
        where: {
          cycleId,
          characterId: r.characterId,
          entryType: 'execution',
          occurredAt: { gte: since, lte: until },
        },
        orderBy: { occurredAt: 'desc' },
        select: { planCommitId: true },
      });
      if (!exec?.planCommitId) continue;
      rowsToInsert.push({
        cycleId,
        occurredAt: new Date(r.date),
        entryType: 'fee',
        amount: Number(r.amount).toFixed(2),
        memo: r.refType,
        planCommitId: exec.planCommitId,
        characterId: r.characterId,
        stationId: null,
        typeId: null,
        source: 'wallet_journal',
        sourceId: `${r.characterId}:${r.journalId}`,
        matchStatus: 'linked',
      });
      created++;
    }

    // Flush any fee rows accumulated after tx loop
    if (rowsToInsert.length) {
      const chunkSize = 500;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);

        await this.prisma.cycleLedgerEntry.createMany({
          data: chunk,
          skipDuplicates: true,
        });
      }
    }

    return { created };
  }
}
