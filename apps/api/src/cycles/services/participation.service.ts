import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CharacterService } from '../../characters/services/character.service';
import type { ParticipationStatus, Prisma } from '@eve/prisma';

/**
 * ParticipationService handles user participation in cycles.
 * Responsibilities: Participation CRUD, validation, opt-out.
 */
@Injectable()
export class ParticipationService {
  private readonly logger = new Logger(ParticipationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly characterService: CharacterService,
  ) {}

  /**
   * Create a participation (opt-in to a future cycle)
   */
  async createParticipation(input: {
    cycleId: string;
    characterName?: string;
    amountIsk: string;
    userId?: string;
  }) {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: input.cycleId },
    });
    if (!cycle) throw new Error('Cycle not found');
    if (cycle.startedAt <= new Date()) {
      throw new Error('Opt-in only allowed for planned cycles');
    }

    let characterName = input.characterName;
    if (!characterName) {
      const anyChar = await this.characterService.getAnyCharacterName();
      characterName = anyChar ?? 'Unknown';
    }

    const memo = `ARB-${cycle.id.substring(0, 8)}`;

    // Check for existing participation
    const existing = await this.prisma.cycleParticipation.findFirst({
      where: {
        cycleId: input.cycleId,
        userId: input.userId ?? null,
      },
    });
    if (existing) return existing;

    return await this.prisma.cycleParticipation.create({
      data: {
        cycleId: input.cycleId,
        userId: input.userId,
        characterName,
        amountIsk: input.amountIsk,
        memo,
        status: 'AWAITING_INVESTMENT',
      },
    });
  }

  /**
   * List participations for a cycle
   */
  async listParticipations(cycleId: string, status?: string) {
    const validStatuses: ParticipationStatus[] = [
      'AWAITING_INVESTMENT',
      'AWAITING_VALIDATION',
      'OPTED_IN',
      'OPTED_OUT',
      'COMPLETED',
      'REFUNDED',
    ];
    const where: Prisma.CycleParticipationWhereInput = {
      cycleId,
      ...(status && validStatuses.includes(status as ParticipationStatus)
        ? { status: status as ParticipationStatus }
        : {}),
    };
    return await this.prisma.cycleParticipation.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Opt out of a participation
   */
  async optOutParticipation(participationId: string) {
    const p = await this.prisma.cycleParticipation.findUnique({
      where: { id: participationId },
      include: { cycle: true },
    });
    if (!p) throw new Error('Participation not found');
    const cycle = p.cycle as { startedAt: Date };
    if (cycle.startedAt <= new Date()) {
      throw new Error('Cannot opt-out after cycle start');
    }

    // If still awaiting investment, delete
    if (p.status === 'AWAITING_INVESTMENT') {
      return await this.prisma.cycleParticipation.delete({
        where: { id: participationId },
      });
    }

    // If payment received, mark for refund
    if (p.status === 'OPTED_IN') {
      return await this.prisma.cycleParticipation.update({
        where: { id: participationId },
        data: { status: 'OPTED_OUT', optedOutAt: new Date() },
      });
    }

    throw new Error('Invalid participation status for opt-out');
  }

  /**
   * Admin validate payment for a participation
   */
  async adminValidatePayment(
    participationId: string,
    walletJournal: { characterId: number; journalId: bigint } | null,
    appendEntryFn: (entry: {
      cycleId: string;
      entryType: string;
      amountIsk: string;
      memo: string;
      participationId: string;
      planCommitId: null;
    }) => Promise<unknown>,
  ) {
    const p = await this.prisma.cycleParticipation.findUnique({
      where: { id: participationId },
    });
    if (!p) throw new Error('Participation not found');
    if (p.status === 'OPTED_IN' && p.validatedAt) return p;

    const updated = await this.prisma.cycleParticipation.update({
      where: { id: participationId },
      data: {
        status: 'OPTED_IN',
        validatedAt: new Date(),
        walletJournalId: walletJournal?.journalId ?? null,
      },
    });

    // Create deposit ledger entry
    await appendEntryFn({
      cycleId: updated.cycleId,
      entryType: 'deposit',
      amountIsk: String(updated.amountIsk),
      memo: `Participation deposit ${updated.characterName}`,
      participationId: updated.id,
      planCommitId: null,
    });

    return updated;
  }

  /**
   * Mark refund for a participation
   */
  async adminMarkRefund(input: { participationId: string; amountIsk: string }) {
    return await this.prisma.cycleParticipation.update({
      where: { id: input.participationId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        amountIsk: input.amountIsk,
      },
    });
  }

  /**
   * Get all participations
   */
  async getAllParticipations() {
    return await this.prisma.cycleParticipation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        cycle: { select: { name: true, startedAt: true, closedAt: true } },
      },
    });
  }

  /**
   * Get participation for a user in a cycle
   */
  async getMyParticipation(cycleId: string, userId: string) {
    return await this.prisma.cycleParticipation.findFirst({
      where: { cycleId, userId },
    });
  }

  /**
   * Mark payout as sent
   */
  async markPayoutAsSent(participationId: string) {
    return await this.prisma.cycleParticipation.update({
      where: { id: participationId },
      data: { status: 'COMPLETED', payoutPaidAt: new Date() },
    });
  }
}

