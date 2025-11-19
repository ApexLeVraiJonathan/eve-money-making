/**
 * Scenario 03: Initial Only Rollover Flow
 *
 * Tests the INITIAL_ONLY rollover type:
 * - Generates profit in Cycle 2
 * - Creates INITIAL_ONLY rollover to Cycle 3
 * - Verifies only initial amount is rolled over
 * - Verifies profit is marked for payout
 *
 * Depends on: Scenario 02 (Cycle 2 must be OPEN)
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
  allocateTransactions,
  formatIsk,
  assertApproxEqual,
  logStep,
  logSuccess,
  logInfo,
  printScenarioHeader,
  printScenarioComplete,
  waitForUser,
} from '../helpers/index';

export async function scenario03InitialOnlyRollover(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader('🟠', 'SCENARIO 03: Initial Only Rollover Flow');

  const apiCall = createApiCall(config);
  const testContext = { characterId: config.characterId, transactionIdCounter: ctx.transactionIdCounter };

  if (!ctx.currentOpenCycleId || ctx.cycleIds.length < 2) {
    throw new Error('❌ Scenario 03 requires Scenario 02 to run first (Cycle 2 must be OPEN)');
  }

  const cycle2Id = ctx.cycleIds[1];

  // Step 1: Generate profit in Cycle 2
  logStep('1️⃣', 'Generating profit in Cycle 2...');
  const lines = await getCycleLines(apiCall, cycle2Id);
  logInfo(`Found ${lines.length} cycle lines`);

  const sellCount = await createProfitableSells(testContext, lines, 0.7, 1.4);
  ctx.transactionIdCounter = testContext.transactionIdCounter;
  logSuccess(`Created ${sellCount} profitable sell transactions`);

  await allocateTransactions(apiCall, cycle2Id);
  logSuccess('Sales allocated');

  const overview2 = await getCycleOverview(apiCall);
  const profit = Number(overview2.current.profit.current);
  const investorProfitShare = profit * 0.5;
  const initialAmount = ctx.lastInitialAmount || 10000000000;
  const totalPayout = initialAmount + investorProfitShare;

  logInfo(`Cycle 2 Profit: ${formatIsk(profit)}`);
  logInfo(`Investor Share (50%): ${formatIsk(investorProfitShare)}`);
  logInfo(`Initial Amount: ${formatIsk(initialAmount)}`);
  logInfo(`Total Payout: ${formatIsk(totalPayout)}`);

  // Step 2: Create Cycle 3
  logStep('2️⃣', 'Creating Cycle 3...');
  const cycle3 = await createCycle(apiCall, 'Rollover Suite - Cycle 3');
  ctx.cycleIds.push(cycle3.id);
  logSuccess(`Cycle 3 created: ${cycle3.id.substring(0, 8)}`);

  // Step 3: Create INITIAL_ONLY rollover participation
  logStep('3️⃣', 'Creating INITIAL_ONLY rollover participation...');
  const rolloverP = await createParticipation(apiCall, {
    cycleId: cycle3.id,
    characterName: 'Rollover Test User',
    amountIsk: initialAmount.toFixed(2),
    testUserId: ctx.testUserId,
    rollover: {
      type: 'INITIAL_ONLY',
    },
  });
  ctx.latestParticipationId = rolloverP.id;
  logSuccess(`Rollover participation created: ${rolloverP.id.substring(0, 8)}`);

  await waitForUser(
    config,
    'Verify in UI:\n   - Cycle 3 is PLANNED\n   - Rollover participation for INITIAL_ONLY type',
  );

  // Step 4: Open Cycle 3 (closes Cycle 2, processes rollover)
  logStep('4️⃣', 'Opening Cycle 3 (closes Cycle 2, processes rollover)...');
  await openCycle(apiCall, cycle3.id);
  ctx.currentOpenCycleId = cycle3.id;
  logSuccess('Cycle 3 opened, Cycle 2 closed');

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step 5: Verify rollover processed with INITIAL_ONLY
  logStep('5️⃣', 'Verifying INITIAL_ONLY rollover...');
  const cycle3Participations = await getParticipations(apiCall, cycle3.id);
  const processedRollover = cycle3Participations.find((p: any) => p.id === rolloverP.id);

  if (!processedRollover) {
    throw new Error('❌ Rollover participation not found in Cycle 3');
  }

  if (processedRollover.status !== 'OPTED_IN') {
    throw new Error(`❌ Expected OPTED_IN, got ${processedRollover.status}`);
  }
  logSuccess('Auto-validated to OPTED_IN');

  // Should roll over only initial amount
  const rolledAmount = Number(processedRollover.amountIsk);
  assertApproxEqual(
    rolledAmount,
    initialAmount,
    1.0,
    'Rolled amount should equal initial investment',
  );
  logSuccess(`Rolled over: ${formatIsk(rolledAmount)} (initial only)`);

  ctx.lastInitialAmount = rolledAmount;

  // Step 6: Verify profit was marked for payout
  const cycle2Participations = await getParticipations(apiCall, cycle2Id);
  const cycle2P = cycle2Participations.find((p: any) => p.userId === ctx.testUserId);

  if (cycle2P) {
    const payoutAmount = Number(cycle2P.payoutAmountIsk || '0');
    const expectedPayout = investorProfitShare; // Only profit should be paid out

    logInfo(`Payout amount: ${formatIsk(payoutAmount)}`);
    logInfo(`Expected (profit only): ${formatIsk(expectedPayout)}`);

    assertApproxEqual(payoutAmount, expectedPayout, 1.0, 'Payout should equal profit only');
    logSuccess('Profit correctly marked for payout');

    if (payoutAmount > 0 && cycle2P.status !== 'AWAITING_PAYOUT') {
      logInfo(`Status: ${cycle2P.status} (note: expected AWAITING_PAYOUT)`);
    } else {
      logSuccess(`Status: ${cycle2P.status}`);
    }
  }

  await waitForUser(
    config,
    'Verify in UI:\n   - Cycle 2 is COMPLETED with profit payout pending\n   - Cycle 3 is OPEN with initial-only rollover',
  );

  printScenarioComplete();
}

// Allow standalone execution for debugging (requires Scenario 02 state)
if (require.main === module) {
  console.error('❌ Scenario 03 must be run via the suite runner (requires Scenario 02 state)');
  console.log('   Use: pnpm exec ts-node scripts/tests/participation-rollover/participation-rollover.suite.ts');
  process.exit(1);
}

