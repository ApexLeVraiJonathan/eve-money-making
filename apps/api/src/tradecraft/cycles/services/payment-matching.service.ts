import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CharacterService } from '../../../characters/services/character.service';

/**
 * PaymentMatchingService handles fuzzy matching of wallet donations to participations.
 * Responsibilities: Auto-matching payments, finding unmatched donations.
 *
 * Complex matching logic:
 * - Exact memo matching
 * - Fuzzy memo matching (Levenshtein distance)
 * - Multiple payments with same memo (sum them)
 * - Wrong character detection (use actual payer)
 * - Partial/over payments (update to actual amount)
 */
@Injectable()
export class PaymentMatchingService {
  private readonly logger = new Logger(PaymentMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly characterService: CharacterService,
  ) {}

  /**
   * Fuzzy memo matching using Levenshtein distance
   */
  private fuzzyMatch(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Match wallet journal entries to participations
   * Returns matched/partial counts and unmatched journals
   */
  async matchParticipationPayments(
    cycleId: string | undefined,
    appendEntryFn: (entry: {
      cycleId: string;
      entryType: string;
      amountIsk: string;
      memo: string;
      participationId: string;
      planCommitId: null;
    }) => Promise<unknown>,
  ): Promise<{
    matched: number;
    partial: number;
    unmatched: Array<{
      journalId: string;
      characterId: number;
      amount: string;
      description: string | null;
      reason: string | null;
      date: Date;
    }>;
  }> {
    // Get all AWAITING_INVESTMENT participations that should be auto-matched.
    // IMPORTANT: We deliberately skip JingleYield *root* participations here,
    // because their principal is admin-funded and user-funded extra can arrive
    // separately. Mixing those flows in the generic matcher risks overwriting
    // the intended participation amount and character name when the admin
    // seed payment is detected after a user increase. Root JY participations
    // should be validated via the dedicated JY/admin flows instead.
    const participations = await this.prisma.cycleParticipation.findMany({
      where: {
        status: 'AWAITING_INVESTMENT',
        rootForJingleYieldProgram: null,
        ...(cycleId ? { cycleId } : {}),
      },
      include: {
        cycle: { select: { id: true, startedAt: true } },
      },
    });

    if (!participations.length) {
      return { matched: 0, partial: 0, unmatched: [] };
    }

    // Get logistics character IDs for filtering donations
    const logisticsIds = await this.characterService.getLogisticsCharacterIds();

    // Get all player_donation journal entries that aren't already linked
    const journals = await this.prisma.walletJournalEntry.findMany({
      where: {
        refType: 'player_donation',
        characterId: { in: logisticsIds },
      },
      orderBy: { date: 'desc' },
    });

    // Find journals already linked to participations
    const linkedJournalIds = new Set(
      (
        await this.prisma.cycleParticipation.findMany({
          where: { walletJournalId: { not: null } },
          select: { walletJournalId: true },
        })
      )
        .map((p) => p.walletJournalId)
        .filter((id): id is bigint => id !== null),
    );

    const unlinkedJournals = journals.filter(
      (j) => !linkedJournalIds.has(j.journalId),
    );

    let matched = 0;
    let partial = 0;
    const unmatchedJournals: Array<{
      journalId: string;
      characterId: number;
      amount: string;
      description: string | null;
      reason: string | null;
      date: Date;
    }> = [];

    // Try to match each participation
    for (const p of participations) {
      const expectedMemo = p.memo;
      const expectedAmount = Number(p.amountIsk);

      // Find all journals that could match this participation
      // Filter out journals already matched in this run
      const candidates = unlinkedJournals
        .filter((j) => !linkedJournalIds.has(j.journalId)) // Exclude already-matched journals
        .map((j) => {
          const memo = (j.reason || '').trim();
          let score = 0;

          // Exact memo match = highest priority
          if (memo === expectedMemo) {
            score = 1000;
          }
          // Contains memo
          else if (memo.includes(expectedMemo)) {
            score = 500;
          }
          // Fuzzy match (allow up to 3 character differences)
          else {
            const distance = this.fuzzyMatch(
              memo.toLowerCase(),
              expectedMemo.toLowerCase(),
            );
            if (distance <= 3) {
              score = 100 - distance * 10;
            }
          }

          // Boost score if amount matches exactly
          const amount = Number(j.amount);
          if (amount === expectedAmount) {
            score += 50;
          }

          return { journal: j, score, amount };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);

      if (candidates.length === 0) {
        continue;
      }

      // Filter to high-scoring matches
      const matchedJournals = candidates.filter((c) => c.score >= 100);
      const totalAmount = matchedJournals.reduce((sum, c) => sum + c.amount, 0);

      if (matchedJournals.length === 0) {
        continue;
      }

      // Use the character from the first (best) match
      const primaryJournal = matchedJournals[0].journal;

      // Get the donor's character name
      let donorName = p.characterName;
      if (primaryJournal.firstPartyId) {
        donorName =
          (await this.characterService.getCharacterName(
            primaryJournal.firstPartyId,
          )) ?? p.characterName;
      }

      // Update participation with actual amount and link to journal
      await this.prisma.cycleParticipation.update({
        where: { id: p.id },
        data: {
          amountIsk: totalAmount.toFixed(2),
          characterName: donorName,
          status: 'OPTED_IN',
          validatedAt: new Date(),
          walletJournalId: primaryJournal.journalId,
        },
      });

      // Create deposit ledger entry
      await appendEntryFn({
        cycleId: p.cycleId,
        entryType: 'deposit',
        amountIsk: totalAmount.toFixed(2),
        memo: `Participation deposit ${donorName} (auto-matched)`,
        participationId: p.id,
        planCommitId: null,
      });

      // Mark these journals as "used"
      for (const c of matchedJournals) {
        linkedJournalIds.add(c.journal.journalId);
      }

      matched++;
      if (totalAmount !== expectedAmount) {
        partial++;
      }
    }

    // Collect unmatched journals
    for (const j of unlinkedJournals) {
      if (!linkedJournalIds.has(j.journalId)) {
        unmatchedJournals.push({
          journalId: j.journalId.toString(),
          characterId: j.characterId,
          amount: j.amount.toString(),
          description: j.description,
          reason: j.reason,
          date: j.date,
        });
      }
    }

    return { matched, partial, unmatched: unmatchedJournals };
  }

  /**
   * Get unmatched donation journal entries
   */
  async getUnmatchedDonations() {
    const logisticsCharacterIds =
      await this.characterService.getLogisticsCharacters();

    const charIdMap = new Map(logisticsCharacterIds.map((c) => [c.id, c.name]));
    const charIds = logisticsCharacterIds.map((c) => c.id);

    // Get all linked journal IDs
    const linkedJournalIds = new Set(
      (
        await this.prisma.cycleParticipation.findMany({
          where: { walletJournalId: { not: null } },
          select: { walletJournalId: true },
        })
      )
        .map((p) => p.walletJournalId)
        .filter((id): id is bigint => id !== null),
    );

    // Get all donation journals
    const journals = await this.prisma.walletJournalEntry.findMany({
      where: {
        refType: 'player_donation',
        characterId: { in: charIds },
      },
      orderBy: { date: 'desc' },
    });

    // Filter to unmatched
    const unmatched = journals.filter(
      (j) => !linkedJournalIds.has(j.journalId),
    );

    return unmatched.map((j) => ({
      journalId: j.journalId.toString(),
      characterId: j.characterId,
      characterName: charIdMap.get(j.characterId) ?? `Char ${j.characterId}`,
      amount: j.amount.toString(),
      description: j.description,
      reason: j.reason,
      date: j.date,
    }));
  }
}
