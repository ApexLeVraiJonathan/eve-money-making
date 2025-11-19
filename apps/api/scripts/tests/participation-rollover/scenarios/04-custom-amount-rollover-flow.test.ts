/**
 * Scenario 04: Custom Amount Rollover Flow
 *
 * Tests the CUSTOM_AMOUNT rollover type:
 * - Attempts custom amount > initial (should fail)
 * - Creates valid custom amount rollover (5B)
 * - Verifies custom amount is rolled
 * - Verifies surplus is marked for payout
 *
 * Depends on: Scenario 03 (Cycle 3 must be OPEN)
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
} from '../helpers';

export async function scenario04CustomAmountRollover(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader('🟣', 'SCENARIO 04: Custom Amount Rollover Flow');

  const apiCall = createApiCall(config);
  const testContext = { characterId: config.characterId, transactionIdCounter: ctx.transactionIdCounter };

  if (!ctx.currentOpenCycleId || ctx.cycleIds.length < 3) {
    throw new Error('❌ Scenario 04 requires Scenario 03 to run first (Cycle 3 must be OPEN)');
  }

  const cycle3Id = ctx.cycleIds[2];

  // Step 1: Generate profit in Cycle 3
  logStep('1️⃣', 'Generating profit in Cycle 3...');
  const lines = await getCycleLines(apiCall, cycle3Id);
  logInfo(`Found ${lines.length} cycle lines`);

  const sellCount = await createProfitableSells(testContext, lines, 0.75, 1.6);
  ctx.transactionIdCounter = testContext.transactionIdCounter;
  logSuccess(`Created ${sellCount} profitable sell transactions`);

  await allocateTransactions(apiCall, cycle3Id);
  logSuccess('Sales allocated');

  const overview3 = await getCycleOverview(apiCall);
  const profit = Number(overview3.current.profit.current);
  const investorProfitShare = profit * 0.5;
  const initialAmount = ctx.lastInitialAmount || 10000000000;
  const totalPayout = initialAmount + investorProfitShare;

  logInfo(`Cycle 3 Profit: ${formatIsk(profit)}`);
  logInfo(`Investor Share (50%): ${formatIsk(investorProfitShare)}`);
  logInfo(`Initial Amount: ${formatIsk(initialAmount)}`);
  logInfo(`Total Payout: ${formatIsk(totalPayout)}`);

  // Step 2: Create Cycle 4
  logStep('2️⃣', 'Creating Cycle 4...');
  const cycle4 = await createCycle(apiCall, 'Rollover Suite - Cycle 4');
  ctx.cycleIds.push(cycle4.id);
  logSuccess(`Cycle 4 created: ${cycle4.id.substring(0, 8)}`);

  // Step 3: Test custom amount validation (> initial should fail)
  logStep('3️⃣', 'Testing custom amount validation...');
  try {
    await createParticipation(apiCall, {
      cycleId: cycle4.id,
      characterName: 'Rollover Test User',
      amountIsk: (initialAmount + 1000000000).toFixed(2), // Initial + 1B
      testUserId: ctx.testUserId,
      rollover: {
        type: 'CUSTOM_AMOUNT',
        customAmountIsk: (initialAmount + 1000000000).toFixed(2),
      },
    });
    throw new Error('❌ Should have rejected custom amount > initial');
  } catch (error) {
    if (error instanceof Error && error.message.includes('initial')) {
      logSuccess('Correctly rejected custom amount > initial');
    } else if (error instanceof Error && error.message.includes('❌ Should have')) {
      throw error;
    } else {
      logSuccess('Custom amount > initial rejected with error');
    }
  }

  // Step 4: Create valid custom amount rollover (5B)
  logStep('4️⃣', 'Creating valid custom amount rollover (5B)...');
  const customAmount = 5000000000;
  const rolloverP = await createParticipation(apiCall, {
    cycleId: cycle4.id,
    characterName: 'Rollover Test User',
    amountIsk: customAmount.toFixed(2),
    testUserId: ctx.testUserId,
    rollover: {
      type: 'CUSTOM_AMOUNT',
      customAmountIsk: customAmount.toFixed(2),
    },
  });
  ctx.latestParticipationId = rolloverP.id;
  logSuccess(`Rollover participation created: ${rolloverP.id.substring(0, 8)}`);
  logInfo(`Custom amount: ${formatIsk(customAmount)}`);

  await waitForUser(
    config,
    'Verify in UI:\n   - Cycle 4 is PLANNED\n   - Rollover participation for 5B custom amount',
  );

  // Step 5: Open Cycle 4 (closes Cycle 3, processes rollover)
  logStep('5️⃣', 'Opening Cycle 4 (closes Cycle 3, processes custom rollover)...');
  await openCycle(apiCall, cycle4.id);
  ctx.currentOpenCycleId = cycle4.id;
  logSuccess('Cycle 4 opened, Cycle 3 closed');

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step 6: Verify custom amount rollover
  logStep('6️⃣', 'Verifying custom amount rollover...');
  const cycle4Participations = await getParticipations(apiCall, cycle4.id);
  const processedRollover = cycle4Participations.find((p: any) => p.id === rolloverP.id);

  if (!processedRollover) {
    throw new Error('❌ Rollover participation not found in Cycle 4');
  }

  if (processedRollover.status !== 'OPTED_IN') {
    throw new Error(`❌ Expected OPTED_IN, got ${processedRollover.status}`);
  }
  logSuccess('Auto-validated to OPTED_IN');

  const rolledAmount = Number(processedRollover.amountIsk);
  assertApproxEqual(
    rolledAmount,
    customAmount,
    1.0,
    'Rolled amount should equal custom amount',
  );
  logSuccess(`Rolled over: ${formatIsk(rolledAmount)} (custom amount)`);

  ctx.lastInitialAmount = rolledAmount;

  // Step 7: Verify surplus payout
  logStep('7️⃣', 'Verifying surplus payout...');
  const cycle3Participations = await getParticipations(apiCall, cycle3Id);
  const cycle3P = cycle3Participations.find((p: any) => p.userId === ctx.testUserId);

  if (cycle3P) {
    const payoutAmount = Number(cycle3P.payoutAmountIsk || '0');
    const expectedPayout = totalPayout - customAmount;

    logInfo(`Total payout: ${formatIsk(totalPayout)}`);
    logInfo(`Rolled over: ${formatIsk(customAmount)}`);
    logInfo(`Expected payout (surplus): ${formatIsk(expectedPayout)}`);
    logInfo(`Actual payout: ${formatIsk(payoutAmount)}`);

    assertApproxEqual(payoutAmount, expectedPayout, 1.0, 'Payout should equal total - custom amount');
    logSuccess(`Surplus ${formatIsk(payoutAmount)} correctly marked for payout`);

    if (payoutAmount > 0) {
      if (cycle3P.status === 'AWAITING_PAYOUT') {
        logSuccess(`Status: AWAITING_PAYOUT (correct)`);
      } else if (cycle3P.status === 'COMPLETED') {
        logSuccess(`Status: COMPLETED (may indicate payout already processed)`);
      } else {
        logInfo(`Status: ${cycle3P.status}`);
      }
    }
  }

  await waitForUser(
    config,
    'Verify in UI:\n   - Cycle 3 is COMPLETED with surplus payout\n   - Cycle 4 is OPEN with 5B rollover',
  );

  printScenarioComplete();
}

// Allow standalone execution for debugging (requires Scenario 03 state)
if (require.main === module) {
  console.error('❌ Scenario 04 must be run via the suite runner (requires Scenario 03 state)');
  console.log('   Use: pnpm exec ts-node scripts/tests/participation-rollover/participation-rollover.suite.ts');
  process.exit(1);
}

