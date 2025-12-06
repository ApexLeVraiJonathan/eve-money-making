/**
 * Scenario 05: Excess Payout Above 20B
 *
 * Tests the 20B rollover cap:
 * - Generates massive profit to create > 20B payout
 * - Creates FULL_PAYOUT rollover
 * - Verifies rollover is capped at 20B
 * - Verifies excess is marked for payout
 *
 * Depends on: Scenario 04 (Cycle 4 must be OPEN)
 */

import {
  TestConfig,
  SharedRolloverContext,
  createApiCall,
  createCycle,
  openCycle,
  getCycleLines,
  getCycleOverview,
  createParticipation,
  getParticipations,
  createProfitableSells,
  createFakeDonation,
  matchDonations,
  allocateTransactions,
  formatIsk,
  assertApproxEqual,
  assertInRange,
  logStep,
  logSuccess,
  logWarning,
  logInfo,
  printScenarioHeader,
  printScenarioComplete,
  waitForUser,
} from '../helpers/index';

export async function scenario05ExcessPayoutAbove20B(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader('💎', 'SCENARIO 05: Excess Payout Above 20B');

  const apiCall = createApiCall(config);

  if (!ctx.currentOpenCycleId || ctx.cycleIds.length < 4) {
    throw new Error(
      '❌ Scenario 05 requires Scenario 04 to run first (Cycle 4 must be OPEN)',
    );
  }

  if (!ctx.cycle4ParticipationId) {
    throw new Error(
      '❌ Scenario 05 requires ctx.cycle4ParticipationId from Scenario 04',
    );
  }

  const cycle4Id = ctx.cycleIds[3];

  // Step 1: Artificially set Cycle 4 participation payout to 25B (deterministic >20B test)
  logStep(
    '1️⃣',
    'Setting Cycle 4 participation payout to 25B (for >20B rollover test)...',
  );

  const { PrismaClient } = await import('@eve/prisma');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const dbUrl =
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  });

  // Get the Cycle 4 participation for the test user
  const cycle4Parts = await prisma.cycleParticipation.findMany({
    where: {
      cycleId: cycle4Id,
      userId: ctx.testUserId,
    },
  });

  if (cycle4Parts.length === 0) {
    throw new Error('❌ No participation found in Cycle 4 for test user');
  }

  const cycle4Participation = cycle4Parts[0];

  // Set the payout to 25B so we can test the 20B cap
  await prisma.cycleParticipation.update({
    where: { id: cycle4Participation.id },
    data: {
      payoutAmountIsk: '25000000000.00', // 25B total payout
      status: 'AWAITING_PAYOUT',
    },
  });

  logSuccess('Cycle 4 participation payout set to 25B');
  logInfo('Expected rollover: 20B (capped), Excess payout: 5B');

  // Step 2: Create Cycle 5 with FULL_PAYOUT rollover
  logStep('2️⃣', 'Creating Cycle 5 with FULL_PAYOUT rollover...');
  const cycle5 = await createCycle(apiCall, 'Rollover Suite - Cycle 5');
  ctx.cycleIds.push(cycle5.id);
  
  // Create FULL_PAYOUT rollover participation
  const rolloverP = await createParticipation(apiCall, {
    cycleId: cycle5.id,
    characterName: 'Rollover Test User',
    amountIsk: '1.00', // Placeholder, will be auto-calculated
    testUserId: ctx.testUserId,
    rollover: {
      type: 'FULL_PAYOUT',
    },
  });
  
  logSuccess(`Cycle 5 created with FULL_PAYOUT rollover: ${cycle5.id.substring(0, 8)}`);

  // Step 3: Open Cycle 5 (closes Cycle 4, processes the 25B payout → 20B rollover + 5B excess)
  logStep('3️⃣', 'Opening Cycle 5 (closes Cycle 4, processes 20B cap)...');
  await openCycle(apiCall, cycle5.id);
  ctx.currentOpenCycleId = cycle5.id;
  logSuccess('Cycle 5 opened, Cycle 4 closed');

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step 4: Verify 20B cap and 5B excess payout
  logStep('4️⃣', 'Verifying 20B cap and 5B excess payout...');

  // Check the FULL_PAYOUT rollover participation in Cycle 5
  const cycle5Participations = await getParticipations(apiCall, cycle5.id);
  const rolloverParticipation = cycle5Participations.find(
    (p: any) =>
      p.userId === ctx.testUserId &&
      p.memo &&
      p.memo.includes('ROLLOVER') &&
      p.memo.includes('FULL'),
  );

  if (!rolloverParticipation) {
    logWarning('Rollover participation not found, dumping all cycle 5 participations:');
    console.log(JSON.stringify(cycle5Participations, null, 2));
    throw new Error('❌ Rollover participation not found in Cycle 5');
  }

  if (rolloverParticipation.status !== 'OPTED_IN') {
    throw new Error(
      `❌ Expected OPTED_IN, got ${rolloverParticipation.status}`,
    );
  }
  logSuccess('Rollover participation auto-validated to OPTED_IN');

  const rolledAmount = Number(rolloverParticipation.amountIsk);
  logInfo(`Rolled over amount: ${formatIsk(rolledAmount)}`);

  // Verify 20B cap was applied
  assertApproxEqual(
    rolledAmount,
    20000000000,
    1000,
    'Rollover amount (20B cap)',
  );
  logSuccess(`✓ Rollover correctly capped at 20B`);

  // Check original Cycle 4 participation for excess payout
  const updatedCycle4Participation = await prisma.cycleParticipation.findUnique({
    where: { id: cycle4Participation.id },
  });

  if (!updatedCycle4Participation) {
    throw new Error('❌ Original Cycle 4 participation not found');
  }

  const excessPayout = Number(updatedCycle4Participation.payoutAmountIsk || 0);
  const rolloverDeducted = Number(updatedCycle4Participation.rolloverDeductedIsk || 0);

  logInfo(
    `Original payout (25B) - Rolled over (20B) = Excess: ${formatIsk(excessPayout)}`,
  );
  logInfo(`Rollover deducted tracking: ${formatIsk(rolloverDeducted)}`);

  // Verify excess = 25B - 20B = 5B
  assertApproxEqual(excessPayout, 5000000000, 1000, 'Excess payout');
  logSuccess(`✓ Excess payout correctly set to 5B`);

  // Verify rollover deduction tracking
  assertApproxEqual(rolloverDeducted, 20000000000, 1000, 'Rollover deducted');
  logSuccess(`✓ Rollover deduction correctly tracked as 20B`);

  // Status should be AWAITING_PAYOUT since there's 5B excess to pay
  if (updatedCycle4Participation.status !== 'AWAITING_PAYOUT') {
    logWarning(
      `Expected status AWAITING_PAYOUT, got ${updatedCycle4Participation.status}`,
    );
  } else {
    logSuccess(
      '✓ Status correctly set to AWAITING_PAYOUT (5B excess needs payment)',
    );
  }

  ctx.lastInitialAmount = rolledAmount;

  await prisma.$disconnect();

  await waitForUser(
    config,
    'Verify in UI:\n   - Cycle 4 is COMPLETED with 5B excess payout\n   - Cycle 5 is OPEN with 20B rollover (capped)\n   - My Investments shows Cycle 4 profit correctly',
  );

  printScenarioComplete();
}

// Allow standalone execution for debugging (requires Scenario 04 state)
if (require.main === module) {
  console.error(
    '❌ Scenario 05 must be run via the suite runner (requires Scenario 04 state)',
  );
  console.log(
    '   Use: pnpm exec ts-node scripts/tests/participation-rollover/participation-rollover.suite.ts',
  );
  process.exit(1);
}
