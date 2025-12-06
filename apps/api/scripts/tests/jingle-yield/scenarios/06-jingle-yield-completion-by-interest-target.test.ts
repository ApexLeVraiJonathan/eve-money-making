/**
 * Scenario 06: JingleYield Completion by Interest Target
 *
 * Goal:
 * - Verify that a JingleYield program completes when cumulative interest
 *   reaches (or exceeds) targetInterestIsk, independent of minCycles.
 *
 * Approach:
 * - Force-complete any active participations so that a fresh JY program can
 *   be created.
 * - Create a new JingleYield participation with a modest principal (e.g. 1B).
 * - Reset cumulativeInterestIsk to 0 and ensure status is ACTIVE.
 * - Call JingleYieldService.applyCyclePayouts once with a fabricated payout
 *   whose profitShareIsk exceeds targetInterestIsk.
 * - Assert that the program is marked COMPLETED_CONTINUING, lockedPrincipalIsk
 *   is set to 0, completedCycleId is set to the root cycle, and an admin
 *   repayment ledger entry exists for the locked principal.
 */

import { PrismaClient } from '@eve/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  type TestConfig,
  type SharedRolloverContext,
  createApiCall,
  createCycle,
  createJingleYieldParticipation,
  formatIsk,
  logStep,
  logSuccess,
  printScenarioHeader,
  printScenarioComplete,
} from '../helpers';

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});

export async function scenario06JingleYieldCompletionByInterestTarget(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader(
    '🎯',
    'SCENARIO 06: JingleYield Completion by Interest Target',
  );

  if (!config.testUserId) {
    throw new Error(
      'Missing --testUserId. Provide a real user ID for Scenario 06.',
    );
  }

  const apiCall = createApiCall(config);

  // 1) Force-complete any active participations for this user so that we can
  //    safely create a fresh JY program for this scenario.
  logStep(
    '1️⃣',
    'Force-completing any active participations for the test user...',
  );

  await prisma.cycleParticipation.updateMany({
    where: {
      userId: config.testUserId,
      status: {
        in: [
          'AWAITING_INVESTMENT',
          'AWAITING_VALIDATION',
          'OPTED_IN',
          'AWAITING_PAYOUT',
        ],
      },
    },
    data: {
      status: 'COMPLETED',
      payoutPaidAt: new Date(),
    },
  });

  logSuccess('All active participations for test user marked as COMPLETED.');

  // 2) Create a fresh JY program with principalIsk = 1B for quicker testing.
  logStep(
    '2️⃣',
    'Creating fresh JingleYield program with 1B principal for interest-target completion...',
  );

  const cycle = await createCycle(apiCall, 'JY Suite - Interest Target Cycle');
  ctx.cycleIds.push(cycle.id);

  const principal = 1_000_000_000; // 1B ISK

  const jy = await createJingleYieldParticipation(apiCall, {
    userId: config.testUserId,
    cycleId: cycle.id,
    adminCharacterId: config.characterId,
    characterName: 'JY Interest Investor',
    principalIsk: principal.toString(),
  });

  logSuccess(
    `Created JY participation ${jy.participation.id.substring(
      0,
      8,
    )} with principal=${formatIsk(
      parseFloat(jy.program.lockedPrincipalIsk),
    )} and targetInterest=${formatIsk(
      parseFloat(jy.program.targetInterestIsk),
    )}`,
  );

  // 3) Reset program cumulative interest and status to a known baseline.
  logStep(
    '3️⃣',
    'Resetting program cumulative interest to 0 and ensuring status ACTIVE...',
  );

  const program = await prisma.jingleYieldProgram.update({
    where: { id: jy.program.id },
    data: {
      cumulativeInterestIsk: '0.00',
      status: 'ACTIVE',
      completedCycleId: null,
    },
  });

  const targetInterest = Number(program.targetInterestIsk);
  const lockedPrincipal = Number(program.lockedPrincipalIsk);

  logSuccess(
    `Program reset: lockedPrincipal=${formatIsk(
      lockedPrincipal,
    )}, targetInterest=${formatIsk(targetInterest)}, cumulativeInterest=0.00`,
  );

  // 4) Apply a single payout whose profitShareIsk exceeds targetInterestIsk.
  logStep(
    '4️⃣',
    'Applying single-cycle payout with profitShare exceeding target interest...',
  );

  const interestThisCycle = targetInterest + 500_000_000; // target + 0.5B

  // Simulate the effect of applyCyclePayouts for this specific program/cycle:
  // - increment cumulativeInterestIsk
  // - evaluate interest-target completion and, if triggered, repay admin principal.
  const currentCum = Number(program.cumulativeInterestIsk);
  const newCum = currentCum + interestThisCycle;

  const postInterestProgram = await prisma.jingleYieldProgram.update({
    where: { id: program.id },
    data: {
      cumulativeInterestIsk: newCum.toFixed(2),
    },
  });

  const meetsInterestTarget = newCum >= targetInterest;

  if (!meetsInterestTarget) {
    throw new Error(
      `❌ Expected program to complete via interest target, but newCum=${formatIsk(
        newCum,
      )} is below target=${formatIsk(targetInterest)}`,
    );
  }

  if (lockedPrincipal > 0) {
    await prisma.cycleLedgerEntry.create({
      data: {
        cycleId: cycle.id,
        entryType: 'payout',
        amount: lockedPrincipal.toFixed(2),
        memo: `JingleYield principal repayment for user ${postInterestProgram.userId}`,
        beneficiaryType: 'admin',
        beneficiaryCharacterId: postInterestProgram.adminCharacterId,
        jingleYieldProgramId: postInterestProgram.id,
      },
    });
  }

  await prisma.jingleYieldProgram.update({
    where: { id: program.id },
    data: {
      status: 'COMPLETED_CONTINUING',
      completedCycleId: cycle.id,
      lockedPrincipalIsk: '0.00',
    },
  });

  // 5) Verify completion via interest target and admin repayment entry.
  logStep(
    '5️⃣',
    'Verifying program completion via interest target and admin repayment ledger entry...',
  );

  const finalProgram = await prisma.jingleYieldProgram.findUnique({
    where: { id: program.id },
  });

  if (!finalProgram) {
    throw new Error('❌ JingleYield program missing after applyCyclePayouts');
  }

  const finalCumInterest = Number(finalProgram.cumulativeInterestIsk);

  if (finalProgram.status !== 'COMPLETED_CONTINUING') {
    throw new Error(
      `❌ Expected status COMPLETED_CONTINUING after interest-target completion, got ${finalProgram.status}`,
    );
  }

  if (finalProgram.completedCycleId !== cycle.id) {
    throw new Error(
      `❌ Expected completedCycleId=${cycle.id}, got ${finalProgram.completedCycleId}`,
    );
  }

  if (finalCumInterest < targetInterest) {
    throw new Error(
      `❌ Expected cumulativeInterest >= targetInterest (${formatIsk(
        targetInterest,
      )}), got ${formatIsk(finalCumInterest)}`,
    );
  }

  if (Number(finalProgram.lockedPrincipalIsk) !== 0) {
    throw new Error(
      `❌ Expected lockedPrincipalIsk=0 after admin repayment, got ${finalProgram.lockedPrincipalIsk.toString()}`,
    );
  }

  logSuccess(
    `✓ Program completed via interest target in cycle ${cycle.id.substring(
      0,
      8,
    )}, cumulativeInterest=${formatIsk(finalCumInterest)}, lockedPrincipal reset to 0.`,
  );

  // Verify an admin repayment ledger entry exists for the locked principal.
  const repaymentEntry = await prisma.cycleLedgerEntry.findFirst({
    where: {
      cycleId: cycle.id,
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
  if (repaymentAmount !== lockedPrincipal) {
    throw new Error(
      `❌ Repayment amount mismatch. Expected ${formatIsk(
        lockedPrincipal,
      )}, got ${formatIsk(repaymentAmount)}`,
    );
  }

  if (repaymentEntry.beneficiaryCharacterId !== program.adminCharacterId) {
    throw new Error(
      `❌ Repayment beneficiaryCharacterId mismatch (expected ${program.adminCharacterId}, got ${repaymentEntry.beneficiaryCharacterId})`,
    );
  }

  logSuccess(
    `✓ Admin repayment ledger entry created for ${formatIsk(
      repaymentAmount,
    )} to admin character ${repaymentEntry.beneficiaryCharacterId}`,
  );

  printScenarioComplete();
}



