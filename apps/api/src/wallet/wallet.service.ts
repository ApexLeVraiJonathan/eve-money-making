import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EsiCharactersService } from '../esi/esi-characters.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly esiChars: EsiCharactersService,
    private readonly logger: Logger,
  ) {}

  async importForCharacter(characterId: number, reqId?: string) {
    // Transactions: fetch newest first, then paginate older until we reach previously seen max id
    const lastSeenMax = await this.prisma.walletTransaction.findFirst({
      where: { characterId },
      orderBy: { transactionId: 'desc' },
      select: { transactionId: true },
    });
    const stopAt = lastSeenMax ? BigInt(lastSeenMax.transactionId) : null;
    let fromId: number | undefined = undefined;
    for (;;) {
      const txs = await this.esiChars.getWalletTransactions(
        characterId,
        fromId,
        reqId,
      );
      if (!txs.length) break;
      const newTxs = stopAt
        ? txs.filter((t) => BigInt(t.transaction_id) > stopAt)
        : txs;
      if (newTxs.length) {
        await this.prisma.walletTransaction.createMany({
          data: newTxs.map((t) => ({
            characterId,
            transactionId: BigInt(t.transaction_id),
            date: new Date(t.date),
            isBuy: t.is_buy,
            locationId: t.location_id,
            typeId: t.type_id,
            clientId: t.client_id ?? null,
            quantity: t.quantity,
            unitPrice: t.unit_price,
            journalRefId: t.journal_ref_id ? BigInt(t.journal_ref_id) : null,
            createdAt: new Date(),
          })),
          skipDuplicates: true,
        });
      }
      const minId = txs.reduce(
        (acc, t) => Math.min(acc, t.transaction_id),
        txs[0].transaction_id,
      );
      if (stopAt !== null && BigInt(minId) <= stopAt) break;
      if (txs.length < 250) break;
      fromId = minId;
    }

    // Journal: iterate pages, using X-Pages when available to avoid probing empties
    let totalPages: number | undefined;
    for (let page = 1; page <= (totalPages ?? 20); page++) {
      const { rows, totalPages: tp } = await this.esiChars.getWalletJournalPage(
        characterId,
        page,
        reqId,
      );
      if (tp && !totalPages) totalPages = tp;
      if (!rows.length) break;
      await this.prisma.walletJournalEntry.createMany({
        data: rows.map((r) => ({
          characterId,
          journalId: BigInt(r.id),
          date: new Date(r.date),
          refType: r.ref_type,
          amount: r.amount,
          balance: r.balance ?? null,
          contextId: r.context_id ? BigInt(r.context_id) : null,
          contextIdType: r.context_id_type ?? null,
          description: r.description ?? null,
          firstPartyId: r.first_party_id ?? null,
          secondPartyId: r.second_party_id ?? null,
          tax: r.tax ?? null,
          taxReceiverId: r.tax_receiver_id ?? null,
          createdAt: new Date(),
        })),
        skipDuplicates: true,
      });
      if (rows.length < 250) break; // likely last page
    }

    return { ok: true };
  }

  async importAllLinked(reqId?: string) {
    const chars = await this.prisma.eveCharacter.findMany({
      select: { id: true },
    });
    for (const c of chars) {
      try {
        await this.importForCharacter(c.id, reqId);
      } catch (e) {
        this.logger.error(`Wallet import failed for ${c.id}: ${String(e)}`);
      }
    }
    return { ok: true, count: chars.length };
  }

  async listTransactions(
    characterId?: number,
    since?: Date,
    limit?: number,
    offset?: number,
  ): Promise<
    Array<{
      characterId: number;
      characterName: string | null;
      transactionId: string;
      date: Date;
      isBuy: boolean;
      locationId: number;
      stationName: string | null;
      typeId: number;
      typeName: string | null;
      quantity: number;
      unitPrice: string;
    }>
  > {
    const rows = await this.prisma.walletTransaction.findMany({
      where: {
        ...(characterId ? { characterId } : {}),
        ...(since ? { date: { gte: since } } : {}),
      },
      orderBy: { date: 'desc' },
      take: Math.min(Math.max(limit ?? 500, 1), 1000),
      skip: Math.max(offset ?? 0, 0),
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
    const typeIds = Array.from(new Set(rows.map((r) => r.typeId)));
    const stationIds = Array.from(new Set(rows.map((r) => r.locationId)));
    const charIds = Array.from(new Set(rows.map((r) => r.characterId)));

    const typesPromise: Promise<Array<{ id: number; name: string }>> =
      typeIds.length
        ? this.prisma.typeId.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]);
    const stationsPromise: Promise<Array<{ id: number; name: string }>> =
      stationIds.length
        ? this.prisma.stationId.findMany({
            where: { id: { in: stationIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]);
    const charsPromise: Promise<Array<{ id: number; name: string }>> =
      charIds.length
        ? this.prisma.eveCharacter.findMany({
            where: { id: { in: charIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve<Array<{ id: number; name: string }>>([]);
    const [types, stations, chars] = await Promise.all([
      typesPromise,
      stationsPromise,
      charsPromise,
    ]);

    const typeNameById = new Map<number, string>(
      types.map((t) => [t.id, t.name] as [number, string]),
    );
    const stationNameById = new Map<number, string>(
      stations.map((s) => [s.id, s.name] as [number, string]),
    );
    const charNameById = new Map<number, string>(
      chars.map((c) => [c.id, c.name] as [number, string]),
    );

    return rows.map((r) => ({
      characterId: r.characterId,
      characterName: charNameById.get(r.characterId) ?? null,
      transactionId: r.transactionId.toString(),
      date: r.date,
      isBuy: r.isBuy,
      locationId: r.locationId,
      stationName: stationNameById.get(r.locationId) ?? null,
      typeId: r.typeId,
      typeName: typeNameById.get(r.typeId) ?? null,
      quantity: r.quantity,
      unitPrice: r.unitPrice.toString(),
    }));
  }

  async listJournal(
    characterId?: number,
    since?: Date,
    limit?: number,
    offset?: number,
  ): Promise<
    Array<{
      characterId: number;
      journalId: string;
      date: Date;
      refType: string;
      amount: string;
      contextId: string | null;
      contextIdType: string | null;
      description: string | null;
    }>
  > {
    const rows = await this.prisma.walletJournalEntry.findMany({
      where: {
        ...(characterId ? { characterId } : {}),
        ...(since ? { date: { gte: since } } : {}),
      },
      orderBy: { date: 'desc' },
      take: Math.min(Math.max(limit ?? 500, 1), 1000),
      skip: Math.max(offset ?? 0, 0),
      select: {
        characterId: true,
        journalId: true,
        date: true,
        refType: true,
        amount: true,
        contextId: true,
        contextIdType: true,
        description: true,
      },
    });
    return rows.map((r) => ({
      characterId: r.characterId,
      journalId: r.journalId.toString(),
      date: r.date,
      refType: r.refType,
      amount: r.amount.toString(),
      contextId: r.contextId ? r.contextId.toString() : null,
      contextIdType: r.contextIdType ?? null,
      description: r.description ?? null,
    }));
  }
}
