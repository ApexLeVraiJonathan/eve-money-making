import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';

type ComputedPayout = {
  participationId: string;
  profitShareIsk: string;
  totalPayoutIsk: string;
};

/**
 * JingleYieldService encapsulates lifecycle logic for JingleYield programs:
 * - Track cumulative interest earned per cycle
 * - Count completed cycles for a program
 * - Trigger admin repayments when completion criteria are met
 */
@Injectable()
export class JingleYieldService {
  private readonly logger = new Logger(JingleYieldService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply computed payouts for a cycle to any linked JingleYield programs.
   * This updates cumulative interest and increments the logical cycle counter.
   *
   * IMPORTANT: This should be called after payouts are computed for a cycle.
   */
  async applyCyclePayouts(
    cycleId: string,
    payouts: ComputedPayout[],
  ): Promise<void> {
    if (!payouts.length) return;

    // Map participationId -> payout
    const payoutByParticipation = new Map<string, ComputedPayout>();
    for (const p of payouts) {
      payoutByParticipation.set(p.participationId, p);
    }

    // Fetch participations that belong to active JingleYield programs
    const jyParticipations = await this.prisma.cycleParticipation.findMany({
      where: {
        id: { in: payouts.map((p) => p.participationId) },
        jingleYieldProgramId: { not: null },
      },
      select: {
        id: true,
        jingleYieldProgramId: true,
        jingleYieldProgram: {
          select: {
            id: true,
            status: true,
            cumulativeInterestIsk: true,
            targetInterestIsk: true,
            minCycles: true,
          },
        },
      },
    });

    if (!jyParticipations.length) return;

    this.logger.log(
      `[applyCyclePayouts] Processing ${jyParticipations.length} JY-linked participations for cycle ${cycleId.substring(0, 8)}`,
    );

    // Aggregate interest per program for this cycle
    const interestByProgram = new Map<string, number>();
    for (const p of jyParticipations) {
      const payout = payoutByParticipation.get(p.id);
      if (!payout) continue;

      const interest = Number(payout.profitShareIsk);
      if (!Number.isFinite(interest) || interest <= 0) continue;

      const programId = p.jingleYieldProgramId!;
      interestByProgram.set(
        programId,
        (interestByProgram.get(programId) ?? 0) + interest,
      );
    }

    if (interestByProgram.size === 0) return;

    // Update cumulative interest and then evaluate completion criteria.
    for (const [programId, interestThisCycle] of interestByProgram.entries()) {
      await this.prisma.$transaction(async (tx) => {
        const program = await tx.jingleYieldProgram.findUnique({
          where: { id: programId },
        });
        if (!program || program.status !== 'ACTIVE') return;

        const currentCum = Number(program.cumulativeInterestIsk);
        const newCum = currentCum + interestThisCycle;

        const updated = await tx.jingleYieldProgram.update({
          where: { id: programId },
          data: {
            cumulativeInterestIsk: newCum.toFixed(2),
          },
        });

        // Evaluate completion:
        // - Interest target: cumulativeInterestIsk ≥ targetInterestIsk
        // - OR minimum cycles: number of completed cycles ≥ minCycles
        const target = Number(updated.targetInterestIsk);
        const meetsInterestTarget = newCum >= target;

        let meetsMinCycles = false;
        if (updated.minCycles && updated.minCycles > 0) {
          // Count COMPLETED cycles that have at least one participation
          // linked to this JingleYield program. We approximate this by
          // grouping participations by cycleId and counting the groups.
          const completedCycles = await tx.cycleParticipation.groupBy({
            by: ['cycleId'],
            where: {
              jingleYieldProgramId: programId,
              cycle: {
                status: 'COMPLETED',
              },
            },
            _count: { _all: true },
          });

          meetsMinCycles = completedCycles.length >= updated.minCycles;
        }

        const shouldComplete = meetsInterestTarget || meetsMinCycles;

        if (!shouldComplete) return;

        this.logger.log(
          `[applyCyclePayouts] JingleYield program ${programId.substring(
            0,
            8,
          )} reached completion via ${
            meetsInterestTarget ? 'interest target' : 'minCycles'
          } (interest=${newCum.toFixed(2)} / target=${target.toFixed(
            2,
          )}, minCycles=${updated.minCycles}), marking as completed and creating admin repayment ledger entry.`,
        );

        // Create a ledger entry to represent repayment of locked principal
        const repaymentAmount = Number(program.lockedPrincipalIsk);
        if (repaymentAmount > 0) {
          await tx.cycleLedgerEntry.create({
            data: {
              cycleId,
              entryType: 'payout',
              amount: repaymentAmount.toFixed(2),
              memo: `JingleYield principal repayment for user ${program.userId}`,
              beneficiaryType: 'admin',
              beneficiaryCharacterId: program.adminCharacterId,
              jingleYieldProgramId: program.id,
            },
          });
        }

        await tx.jingleYieldProgram.update({
          where: { id: programId },
          data: {
            status: 'COMPLETED_CONTINUING',
            completedCycleId: cycleId,
            lockedPrincipalIsk: '0.00',
          },
        });
      });
    }
  }

  /**
   * List all JingleYield programs with basic aggregate metrics for admin UI.
   */
  async listPrograms() {
    const programs = await this.prisma.jingleYieldProgram.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        startCycle: {
          select: {
            id: true,
            name: true,
            startedAt: true,
          },
        },
        completedCycle: {
          select: {
            id: true,
            name: true,
            closedAt: true,
          },
        },
      },
    });

    // Compute cyclesCompleted as number of completed participations per program
    const counts = await this.prisma.cycleParticipation.groupBy({
      by: ['jingleYieldProgramId'],
      where: {
        jingleYieldProgramId: {
          in: programs.map((p) => p.id),
        },
        cycle: {
          status: 'COMPLETED',
        },
      },
      _count: { _all: true },
    });
    const countMap = new Map<string, number>();
    for (const c of counts) {
      if (c.jingleYieldProgramId) {
        countMap.set(c.jingleYieldProgramId, c._count._all);
      }
    }

    return programs.map((p) => ({
      id: p.id,
      userId: p.userId,
      adminCharacterId: p.adminCharacterId,
      lockedPrincipalIsk: String(p.lockedPrincipalIsk),
      cumulativeInterestIsk: String(p.cumulativeInterestIsk),
      targetInterestIsk: String(p.targetInterestIsk),
      status: p.status,
      minCycles: p.minCycles,
      cyclesCompleted: countMap.get(p.id) ?? 0,
      startCycle: p.startCycle && {
        id: p.startCycle.id,
        name: p.startCycle.name,
        startedAt: p.startCycle.startedAt.toISOString(),
      },
      completedCycle: p.completedCycle && {
        id: p.completedCycle.id,
        name: p.completedCycle.name,
        closedAt: p.completedCycle.closedAt
          ? p.completedCycle.closedAt.toISOString()
          : null,
      },
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  /**
   * Get a single JingleYield program with enriched history for admin view.
   */
  async getProgramById(id: string) {
    const program = await this.prisma.jingleYieldProgram.findUnique({
      where: { id },
      include: {
        startCycle: {
          select: { id: true, name: true, startedAt: true },
        },
        completedCycle: {
          select: { id: true, name: true, closedAt: true },
        },
        participations: {
          include: {
            cycle: {
              select: {
                id: true,
                name: true,
                status: true,
                startedAt: true,
                closedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        ledgerEntries: {
          orderBy: { occurredAt: 'asc' },
        },
      },
    });
    if (!program) {
      throw new Error('JingleYield program not found');
    }

    return program;
  }

  /**
   * Get the current user's active JingleYield status, if any.
   */
  async getMyStatus(userId: string) {
    const program = await this.prisma.jingleYieldProgram.findFirst({
      where: {
        userId,
        status: {
          in: ['ACTIVE', 'COMPLETED_CONTINUING'],
        },
      },
      include: {
        startCycle: {
          select: { id: true, name: true, startedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!program) return null;

    const cyclesCompleted = await this.prisma.cycleParticipation.count({
      where: {
        jingleYieldProgramId: program.id,
        cycle: { status: 'COMPLETED' },
      },
    });

    return {
      id: program.id,
      userId: program.userId,
      status: program.status,
      lockedPrincipalIsk: String(program.lockedPrincipalIsk),
      cumulativeInterestIsk: String(program.cumulativeInterestIsk),
      targetInterestIsk: String(program.targetInterestIsk),
      minCycles: program.minCycles,
      cyclesCompleted,
      startCycle: program.startCycle && {
        id: program.startCycle.id,
        name: program.startCycle.name,
        startedAt: program.startCycle.startedAt.toISOString(),
      },
      createdAt: program.createdAt.toISOString(),
      updatedAt: program.updatedAt.toISOString(),
    };
  }
}
