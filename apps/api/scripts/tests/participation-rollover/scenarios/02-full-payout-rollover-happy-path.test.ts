/**
 * Scenario 02: Full Payout Rollover - Happy Path
 *
 * Tests the FULL_PAYOUT rollover type:
 * - Generates profit in Cycle 1
 * - Creates rollover participation in Cycle 2
 * - Opens Cycle 2 (closes Cycle 1, processes rollover)
 * - Verifies auto-validation and 20B cap promotion
 *
 * Depends on: Scenario 01 (Cycle 1 must exist and be OPEN)
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
  getMaxParticipation,
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

export async function scenario02FullPayoutRollover(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader('🟢', 'SCENARIO 02: Full Payout Rollover - Happy Path');

  const apiCall = createApiCall(config);
  const testContext = {
    characterId: config.characterId,
    transactionIdCounter: ctx.transactionIdCounter,
  };

  if (!ctx.currentOpenCycleId || ctx.cycleIds.length === 0) {
    throw new Error(
      '❌ Scenario 02 requires Scenario 01 to run first (Cycle 1 must be OPEN)',
    );
  }

  const cycle1Id = ctx.cycleIds[0];

  // Step 1: Generate profit in Cycle 1
  logStep('1️⃣', 'Generating profit in Cycle 1...');
  const lines = await getCycleLines(apiCall, cycle1Id);
  logInfo(`Found ${lines.length} cycle lines`);

  const sellCount = await createProfitableSells(testContext, lines, 0.8, 1.5);
  ctx.transactionIdCounter = testContext.transactionIdCounter;
  logSuccess(`Created ${sellCount} profitable sell transactions`);

  await allocateTransactions(apiCall, cycle1Id);
  logSuccess('Sales allocated');

  // Check profit
  const overview1 = await getCycleOverview(apiCall);
  const profit = Number(overview1.current.profit.current);
  const investorProfitShare = profit * 0.5; // 50% to investors
  const totalPayout =
    (ctx.lastInitialAmount || 10000000000) + investorProfitShare;

  logInfo(`Cycle 1 Profit: ${formatIsk(profit)}`);
  logInfo(`Investor Share (50%): ${formatIsk(investorProfitShare)}`);
  logInfo(`Total Payout: ${formatIsk(totalPayout)}`);

  // Step 2: Create Cycle 2
  logStep('2️⃣', 'Creating Cycle 2...');
  const cycle2 = await createCycle(apiCall, 'Rollover Suite - Cycle 2');
  ctx.cycleIds.push(cycle2.id);
  logSuccess(`Cycle 2 created: ${cycle2.id.substring(0, 8)}`);

  // Step 3: Manual rollover opt-in via UI
  logStep('3️⃣', 'Manual rollover opt-in required...');
  console.log('\n📋 ACTION REQUIRED:');
  console.log(
    '   1. In the app, find Cycle: "Rollover Suite - Cycle 2" (PLANNED status)',
  );
  console.log('   2. Click "Opt In" and enter:');
  console.log('      - Character: (select your character)');
  console.log('      - CHECK "Enable automatic reinvestment" ✓');
  console.log(
    '      - Select rollover type: "Full Payout" (entire payout reinvested)',
  );
  console.log('   3. Verify:');
  console.log('      - Max participation shows 20B (increased from 10B!)');
  console.log('      - "No payment needed" message appears');
  console.log('      - Expected rollover amount: ' + formatIsk(totalPayout));
  console.log('   4. Confirm and submit\n');

  await waitForUser(
    config,
    'Once opted in with FULL_PAYOUT rollover, press ENTER to continue...',
  );

  // Verify rollover participation was created
  const participations = await getParticipations(apiCall, cycle2.id);
  const rolloverP = participations.find(
    (p: any) => p.userId === ctx.testUserId,
  );

  if (!rolloverP) {
    throw new Error('❌ No participation found for test user. Did you opt in?');
  }

  if (!rolloverP.memo.startsWith('ROLLOVER-')) {
    throw new Error(
      `❌ Invalid memo format (should start with ROLLOVER-): ${rolloverP.memo}`,
    );
  }

  if (rolloverP.status !== 'AWAITING_INVESTMENT') {
    throw new Error(`❌ Expected AWAITING_INVESTMENT, got ${rolloverP.status}`);
  }

  ctx.latestParticipationId = rolloverP.id;
  logSuccess(`Rollover participation found: ${rolloverP.id.substring(0, 8)}`);
  logSuccess(`Memo: ${rolloverP.memo}`);
  logSuccess('Status: AWAITING_INVESTMENT (awaiting cycle close)');

  // Step 4: Open Cycle 2 (closes Cycle 1, triggers processRollovers)
  logStep('4️⃣', 'Opening Cycle 2 (closes Cycle 1, processes rollover)...');
  await openCycle(apiCall, cycle2.id);
  ctx.currentOpenCycleId = cycle2.id;
  logSuccess('Cycle 2 opened, Cycle 1 closed');

  // Give backend a moment to process rollovers
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step 5: Verify rollover was processed
  logStep('5️⃣', 'Verifying rollover processing...');
  const cycle2Participations = await getParticipations(apiCall, cycle2.id);
  const processedRollover = cycle2Participations.find(
    (p: any) => p.id === rolloverP.id,
  );

  if (!processedRollover) {
    throw new Error('❌ Rollover participation not found in Cycle 2');
  }

  // Should be auto-validated to OPTED_IN
  if (processedRollover.status !== 'OPTED_IN') {
    throw new Error(`❌ Expected OPTED_IN, got ${processedRollover.status}`);
  }
  logSuccess('Auto-validated to OPTED_IN');

  // Amount should match total payout (or be capped at 20B)
  const expectedRolloverAmount = Math.min(totalPayout, 20000000000);
  const actualRolloverAmount = Number(processedRollover.amountIsk);

  assertApproxEqual(
    actualRolloverAmount,
    expectedRolloverAmount,
    1.0,
    `Rollover amount mismatch`,
  );
  logSuccess(`Rollover amount: ${formatIsk(actualRolloverAmount)}`);

  ctx.lastInitialAmount = actualRolloverAmount;
  ctx.lastPayoutAmount = totalPayout;

  // Step 6: Verify max cap is now 20B (rollover investor)
  logStep('6️⃣', 'Checking max participation cap...');
  const maxCap = await getMaxParticipation(apiCall, ctx.testUserId);
  logSuccess(`Max cap: ${maxCap.maxAmountB}B ISK`);

  if (maxCap.maxAmountB !== 20) {
    throw new Error(
      `❌ Expected 20B cap for rollover investor, got ${maxCap.maxAmountB}B`,
    );
  }
  logSuccess('Promoted to 20B cap (rollover investor status)');

  // Step 7: Verify the original Cycle 1 participation payout
  const cycle1Participations = await getParticipations(apiCall, cycle1Id);
  const originalP = cycle1Participations.find(
    (p: any) => p.userId === ctx.testUserId,
  );

  if (originalP) {
    const payoutAmount = Number(originalP.payoutAmountIsk || '0');
    const expectedPayout = totalPayout - actualRolloverAmount;

    logInfo(`Original participation payout: ${formatIsk(payoutAmount)}`);
    logInfo(`Expected payout (total - rolled): ${formatIsk(expectedPayout)}`);

    assertApproxEqual(
      payoutAmount,
      expectedPayout,
      1.0,
      'Payout amount mismatch',
    );
    logSuccess('Payout amount correctly adjusted for rollover');

    // Status should be AWAITING_PAYOUT if there's money to pay, or COMPLETED if all rolled
    if (payoutAmount > 0 && originalP.status !== 'AWAITING_PAYOUT') {
      logInfo(
        `Status: ${originalP.status} (expected AWAITING_PAYOUT for ${formatIsk(payoutAmount)} payout)`,
      );
    } else if (payoutAmount === 0 && originalP.status !== 'COMPLETED') {
      logInfo(
        `Status: ${originalP.status} (expected COMPLETED when fully rolled over)`,
      );
    } else {
      logSuccess(`Status: ${originalP.status} (correct)`);
    }
  }

  await waitForUser(
    config,
    'Verify in UI:\n   - Cycle 1 is COMPLETED\n   - Cycle 2 is OPEN with rollover participation as OPTED_IN\n   - User max cap shows 20B',
  );

  printScenarioComplete();
}

// Allow standalone execution for debugging (requires Scenario 01 state)
if (require.main === module) {
  console.error(
    '❌ Scenario 02 must be run via the suite runner (requires Scenario 01 state)',
  );
  console.log(
    '   Use: pnpm exec ts-node scripts/tests/participation-rollover/participation-rollover.suite.ts',
  );
  process.exit(1);
}
