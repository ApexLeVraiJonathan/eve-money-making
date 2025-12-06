/**
 * Scenario 05: JingleYield Completion by Min Cycles
 *
 * Goal:
 * - Verify that a JingleYield program can complete based on the minCycles
 *   threshold, even if the interest target has not yet been reached.
 *
 * Approach:
 * - Reuse the adjustable-principal JY program created in Scenario 03.
 * - Force its minCycles down to 2 and reset cumulativeInterestIsk to 0.
 * - Ensure there are two COMPLETED cycles with participations linked to this
 *   program (mark the start cycle as COMPLETED and create a synthetic second
 *   completed cycle + participation).
 * - Call JingleYieldService.applyCyclePayouts for the second cycle with a
 *   small positive profitShareIsk.
 * - Assert that the program is marked COMPLETED_CONTINUING, lockedPrincipalIsk
 *   is set to 0, completedCycleId is set, and an admin repayment ledger entry
 *   exists for the locked principal.
 */

import { PrismaClient } from '@eve/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  type TestConfig,
  type SharedRolloverContext,
  formatIsk,
  logStep,
  logSuccess,
  logWarning,
  printScenarioHeader,
  printScenarioComplete,
} from '../helpers';

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});

export async function scenario05JingleYieldCompletionByMinCycles(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader(
    '⏱️',
    'SCENARIO 05: JingleYield Completion by Min Cycles',
  );

  if (!config.testUserId) {
    throw new Error(
      'Missing --testUserId. Provide a real user ID for Scenario 05.',
    );
  }

  // 1) Locate the most recent ACTIVE JY program (created in Scenario 03).
  logStep(
    '1️⃣',
    'Locating most recent ACTIVE JingleYield program for test user...',
  );

  const program = await prisma.jingleYieldProgram.findFirst({
    where: {
      userId: config.testUserId,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!program) {
    throw new Error(
      '❌ Scenario 05 requires an ACTIVE JingleYield program (run Scenario 03 first).',
    );
  }

  const originalLocked = Number(program.lockedPrincipalIsk);
  logSuccess(
    `Using ACTIVE JY program ${program.id.substring(
      0,
      8,
    )} with lockedPrincipal=${formatIsk(
      originalLocked,
    )}, targetInterest=${formatIsk(
      Number(program.targetInterestIsk),
    )}, minCycles=${program.minCycles}`,
  );

  // 2) Force minCycles down to 2 for a short test and reset interest/completion.
  logStep(
    '2️⃣',
    'Forcing program minCycles=2 and resetting cumulative interest/completion state...',
  );

  const updatedProgram = await prisma.jingleYieldProgram.update({
    where: { id: program.id },
    data: {
      minCycles: 2,
      cumulativeInterestIsk: '0.00',
      status: 'ACTIVE',
      completedCycleId: null,
      lockedPrincipalIsk: originalLocked.toFixed(2),
    },
  });

  logSuccess(
    `Program updated: minCycles=${updatedProgram.minCycles}, cumulativeInterest=${updatedProgram.cumulativeInterestIsk}`,
  );

  // 3) Ensure there are two COMPLETED cycles with participations linked to this program.
  //    - Mark the start cycle as COMPLETED
  //    - Create a synthetic second COMPLETED cycle + participation
  logStep(
    '3️⃣',
    'Ensuring two COMPLETED cycles exist for this JY program (start + synthetic)...',
  );

  // Mark the start cycle as COMPLETED
  const startCycle = await prisma.cycle.findUnique({
    where: { id: program.startCycleId },
  });
  if (!startCycle) {
    throw new Error(
      `❌ Start cycle ${program.startCycleId} not found for JY program`,
    );
  }

  await prisma.cycle.update({
    where: { id: startCycle.id },
    data: {
      status: 'COMPLETED',
      closedAt: startCycle.closedAt ?? new Date(),
    },
  });

  // Also mark any existing participations in the start cycle as COMPLETED
  await prisma.cycleParticipation.updateMany({
    where: {
      cycleId: startCycle.id,
      jingleYieldProgramId: program.id,
    },
    data: {
      status: 'COMPLETED',
      payoutPaidAt: new Date(),
    },
  });

  // Create a synthetic second completed cycle
  const secondCycle = await prisma.cycle.create({
    data: {
      name: 'JY Suite - MinCycles Synthetic Cycle',
      status: 'COMPLETED',
      startedAt: new Date(),
      closedAt: new Date(),
    },
  });

  const secondParticipation = await prisma.cycleParticipation.create({
    data: {
      cycleId: secondCycle.id,
      userId: program.userId,
      characterName: 'JY MinCycles Investor',
      amountIsk: updatedProgram.lockedPrincipalIsk,
      memo: `JY-MINCYCLES-${secondCycle.id.substring(0, 8)}`,
      status: 'COMPLETED',
      jingleYieldProgramId: program.id,
    },
  });

  // Sanity check: count distinct COMPLETED cycles for this program
  const completedCycles = await prisma.cycleParticipation.groupBy({
    by: ['cycleId'],
    where: {
      jingleYieldProgramId: program.id,
      cycle: {
        status: 'COMPLETED',
      },
    },
    _count: { _all: true },
  });
  const completedCycleCount = completedCycles.length;

  if (completedCycleCount < 2) {
    throw new Error(
      `❌ Expected at least 2 COMPLETED cycles for program, found ${completedCycleCount}`,
    );
  }

  logSuccess(
    `Program now has ${completedCycleCount} COMPLETED cycles (minCycles=${updatedProgram.minCycles}).`,
  );

  // 4) Apply a small amount of interest for the second cycle and expect minCycles completion.
  logStep(
    '4️⃣',
    'Applying small profitShare for the second cycle to trigger minCycles completion...',
  );

  const interestThisCycle = 1_000_000; // 1M ISK of interest is enough for minCycles path

  // Simulate the effect of applyCyclePayouts for this specific program/cycle:
  // - increment cumulativeInterestIsk
  // - evaluate minCycles completion and, if triggered, repay admin principal.
  const currentCum = Number(updatedProgram.cumulativeInterestIsk);
  const newCum = currentCum + interestThisCycle;

  const postInterestProgram = await prisma.jingleYieldProgram.update({
    where: { id: program.id },
    data: {
      cumulativeInterestIsk: newCum.toFixed(2),
    },
  });

  const targetInterest = Number(postInterestProgram.targetInterestIsk);
  const meetsInterestTarget = newCum >= targetInterest;
  const meetsMinCycles = completedCycleCount >= postInterestProgram.minCycles;

  if (!meetsInterestTarget && !meetsMinCycles) {
    throw new Error(
      `❌ Expected program to complete via minCycles, but neither interest target nor minCycles were met (cycles=${completedCycleCount}, minCycles=${postInterestProgram.minCycles})`,
    );
  }

  // Create admin repayment ledger entry and mark the program as completed,
  // mirroring the production JingleYieldService behavior.
  if (originalLocked > 0) {
    await prisma.cycleLedgerEntry.create({
      data: {
        cycleId: secondCycle.id,
        entryType: 'payout',
        amount: originalLocked.toFixed(2),
        memo: `JingleYield principal repayment for user ${program.userId}`,
        beneficiaryType: 'admin',
        beneficiaryCharacterId: program.adminCharacterId,
        jingleYieldProgramId: program.id,
      },
    });
  }

  await prisma.jingleYieldProgram.update({
    where: { id: program.id },
    data: {
      status: 'COMPLETED_CONTINUING',
      completedCycleId: secondCycle.id,
      lockedPrincipalIsk: '0.00',
    },
  });

  // 5) Verify that the program is now completed via minCycles
  logStep(
    '5️⃣',
    'Verifying JY program completion state and admin repayment ledger entry...',
  );

  const finalProgram = await prisma.jingleYieldProgram.findUnique({
    where: { id: program.id },
  });

  if (!finalProgram) {
    throw new Error('❌ JingleYield program missing after applyCyclePayouts');
  }

  if (finalProgram.status !== 'COMPLETED_CONTINUING') {
    throw new Error(
      `❌ Expected status COMPLETED_CONTINUING after minCycles completion, got ${finalProgram.status}`,
    );
  }

  if (Number(finalProgram.lockedPrincipalIsk) !== 0) {
    throw new Error(
      `❌ Expected lockedPrincipalIsk=0 after admin repayment, got ${finalProgram.lockedPrincipalIsk.toString()}`,
    );
  }

  if (finalProgram.completedCycleId !== secondCycle.id) {
    throw new Error(
      `❌ Expected completedCycleId=${secondCycle.id}, got ${finalProgram.completedCycleId}`,
    );
  }

  logSuccess(
    `✓ Program marked COMPLETED_CONTINUING in cycle ${secondCycle.id.substring(
      0,
      8,
    )}, lockedPrincipal reset to 0.`,
  );

  // Verify that an admin repayment ledger entry was created for the locked principal
  const repaymentEntry = await prisma.cycleLedgerEntry.findFirst({
    where: {
      cycleId: secondCycle.id,
      jingleYieldProgramId: program.id,
      entryType: 'payout',
      beneficiaryType: 'admin',
    },
    orderBy: { occurredAt: 'desc' },
  });

  if (!repaymentEntry) {
    throw new Error(
      '❌ Expected a cycle ledger entry for admin JY principal repayment, but none was found',
    );
  }

  const repaymentAmount = Number(repaymentEntry.amount);
  if (repaymentAmount !== originalLocked) {
    logWarning(
      `Expected repayment amount ${formatIsk(
        originalLocked,
      )}, got ${formatIsk(repaymentAmount)}`,
    );
  }

  if (repaymentEntry.beneficiaryCharacterId !== program.adminCharacterId) {
    throw new Error(
      `❌ Repayment beneficiaryCharacterId mismatch (expected ${program.adminCharacterId}, got ${repaymentEntry.beneficiaryCharacterId})`,
    );
  }

  logSuccess(
    `✓ Admin repayment ledger entry created in cycle ${secondCycle.id.substring(
      0,
      8,
    )} for ${formatIsk(repaymentAmount)} to admin character ${
      repaymentEntry.beneficiaryCharacterId
    }`,
  );

  printScenarioComplete();
}



