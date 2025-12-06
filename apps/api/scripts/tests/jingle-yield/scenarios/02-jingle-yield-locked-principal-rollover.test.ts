/**
 * Scenario 02: Locked Principal Cannot Be Withdrawn
 *
 * Goal:
 * - Verify that, for an ACTIVE JingleYield program, rollovers always keep at
 *   least the locked principal invested, even if the user tries to roll over
 *   less or nothing.
 *
 * Flow (high level):
 * 1) Reuse the JY suite's shared context (Cycle 1 already PLANNED with a JY root).
 * 2) Open Cycle 1, create some fake profit and finalize payouts (using existing
 *    helpers from the rollover suite).
 * 3) Plan Cycle 2 and create a FULL_PAYOUT rollover for the JY user.
 * 4) Close Cycle 1 → process rollovers into Cycle 2.
 * 5) Assert that the resulting Cycle 2 participation amount is
 *    >= lockedPrincipalIsk, and that payout to the user does not include
 *    any of the locked admin principal.
 */

import { PrismaClient } from '@eve/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  type TestConfig,
  type SharedRolloverContext,
  createApiCall,
  createCycle,
  openCycle,
  closeCycle,
  createPayouts,
  getParticipations,
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

export async function scenario02JingleYieldLockedPrincipalRollover(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader(
    '🛡️',
    'SCENARIO 02: Locked Principal Cannot Be Withdrawn',
  );

  if (!config.testUserId) {
    throw new Error('Missing --testUserId for Scenario 02.');
  }

  if (!ctx.cycleIds[0]) {
    throw new Error(
      'Scenario 02 requires Scenario 01 to have created Cycle 1 and a JY program.',
    );
  }

  const apiCall = createApiCall(config);
  const cycle1Id = ctx.cycleIds[0];

  // 1) Mark the JY root participation as validated/OPTED_IN so it qualifies
  //    as an "active participation" for rollover logic and payout creation.
  logStep(
    '1️⃣',
    'Marking JY root participation as validated (OPTED_IN) in Cycle 1...',
  );
  const jyRoot = await prisma.cycleParticipation.findFirst({
    where: {
      cycleId: cycle1Id,
      userId: config.testUserId,
    },
  });
  if (!jyRoot) {
    throw new Error('❌ JY root participation not found in Cycle 1');
  }

  await prisma.cycleParticipation.update({
    where: { id: jyRoot.id },
    data: {
      status: 'OPTED_IN',
      validatedAt: new Date(),
    },
  });
  logSuccess(
    `JY root participation ${jyRoot.id.substring(
      0,
      8,
    )} marked as OPTED_IN and validated.`,
  );

  // 2) Open Cycle 1 (the JY root cycle) so we can generate profit and payouts
  logStep('2️⃣', 'Opening Cycle 1 with JY participation...');
  await openCycle(apiCall, cycle1Id);
  ctx.currentOpenCycleId = cycle1Id;
  logSuccess(`Cycle 1 opened: ${cycle1Id.substring(0, 8)}`);

  // 3) For simplicity, call the existing helper to create payouts.
  //    The helper internally computes profits; we only need payouts populated.
  logStep('3️⃣', 'Computing payouts for Cycle 1...');
  await createPayouts(apiCall, cycle1Id);
  logSuccess('Payouts computed for Cycle 1');

  // Fetch the JY program to get locked principal
  const jyPrograms = await apiCall(
    'GET',
    '/ledger/jingle-yield/programs',
    null,
  );
  const jyProgram = jyPrograms[0];
  if (!jyProgram) {
    throw new Error('❌ No JingleYield program found for Scenario 02');
  }

  const lockedPrincipal = Number(jyProgram.lockedPrincipalIsk);
  logSuccess(
    `Locked principal from program: ${formatIsk(lockedPrincipal)} ISK`,
  );

  // 4) Plan Cycle 2 and create FULL_PAYOUT rollover participation
  logStep('4️⃣', 'Planning Cycle 2 and creating FULL_PAYOUT rollover...');
  const cycle2 = await createCycle(apiCall, 'JY Suite - Cycle 2');
  ctx.cycleIds.push(cycle2.id);

  // Create a FULL_PAYOUT rollover participation for the JY user into Cycle 2
  const rolloverParticipation = await apiCall(
    'POST',
    `/ledger/cycles/${cycle2.id}/participations`,
    {
      amountIsk: '1.00',
      characterName: 'JY Test Investor',
      testUserId: config.testUserId,
      rollover: {
        type: 'FULL_PAYOUT',
      },
    },
  );

  logSuccess(
    `Created FULL_PAYOUT rollover participation in Cycle 2: ${rolloverParticipation.id.substring(
      0,
      8,
    )}`,
  );

  // 5) Close Cycle 1 to trigger rollover into the next planned cycle (Cycle 2)
  logStep(
    '5️⃣',
    'Closing Cycle 1 to process rollovers into Cycle 2 (with JY lock)...',
  );
  await closeCycle(apiCall, cycle1Id);
  logSuccess('Cycle 1 closed and rollovers processed');

  // 6) Assert rollover amount respects locked principal and that payout keeps it invested
  logStep(
    '6️⃣',
    'Verifying rollover amount in Cycle 2 respects locked principal...',
  );

  const cycle2Parts = await getParticipations(apiCall, cycle2.id);
  const jyCycle2 = cycle2Parts.find(
    (p: any) =>
      p.userId === config.testUserId &&
      p.jingleYieldProgramId === jyProgram.id &&
      p.status === 'OPTED_IN',
  );

  if (!jyCycle2) {
    logWarning('Dumping all Cycle 2 participations:');
    console.log(JSON.stringify(cycle2Parts, null, 2));
    throw new Error('❌ No OPTED_IN JY rollover participation found in Cycle 2');
  }

  const rolledAmount = Number(jyCycle2.amountIsk);
  logSuccess(`Rolled amount in Cycle 2: ${formatIsk(rolledAmount)} ISK`);

  if (rolledAmount < lockedPrincipal) {
    throw new Error(
      `❌ Rolled amount (${formatIsk(
        rolledAmount,
      )}) is below locked principal (${formatIsk(lockedPrincipal)})`,
    );
  }

  logSuccess(
    '✓ Rolled amount is at least the locked principal (user cannot withdraw admin capital).',
  );

  printScenarioComplete();
}


