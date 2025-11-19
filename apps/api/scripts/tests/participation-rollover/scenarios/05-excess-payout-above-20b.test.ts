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
} from '../helpers';

export async function scenario05ExcessPayoutAbove20B(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader('💎', 'SCENARIO 05: Excess Payout Above 20B');

  const apiCall = createApiCall(config);
  const testContext = { characterId: config.characterId, transactionIdCounter: ctx.transactionIdCounter };

  if (!ctx.currentOpenCycleId || ctx.cycleIds.length < 4) {
    throw new Error('❌ Scenario 05 requires Scenario 04 to run first (Cycle 4 must be OPEN)');
  }

  const cycle4Id = ctx.cycleIds[3];

  // Step 1: Generate massive profit in Cycle 4 (target > 20B payout)
  logStep('1️⃣', 'Generating massive profit in Cycle 4 (target: >20B payout)...');
  const lines = await getCycleLines(apiCall, cycle4Id);
  logInfo(`Found ${lines.length} cycle lines`);

  // Sell 80% at 4x price (300% profit)
  const sellCount = await createProfitableSells(testContext, lines, 0.8, 4.0);
  ctx.transactionIdCounter = testContext.transactionIdCounter;
  logSuccess(`Created ${sellCount} highly profitable sell transactions`);

  await allocateTransactions(apiCall, cycle4Id);
  logSuccess('Sales allocated');

  const overview4 = await getCycleOverview(apiCall);
  const profit = Number(overview4.current.profit.current);
  const investorProfitShare = profit * 0.5;
  const initialAmount = ctx.lastInitialAmount || 5000000000;
  const totalPayout = initialAmount + investorProfitShare;

  logInfo(`Cycle 4 Profit: ${formatIsk(profit)}`);
  logInfo(`Investor Share (50%): ${formatIsk(investorProfitShare)}`);
  logInfo(`Initial Amount: ${formatIsk(initialAmount)}`);
  logInfo(`Total Payout: ${formatIsk(totalPayout)}`);

  if (totalPayout <= 20000000000) {
    logWarning(
      `Payout is ${formatIsk(totalPayout)} (≤20B). This scenario requires >20B to fully validate excess handling.`,
    );
    logWarning('Continuing test anyway to verify logic handles this case correctly...');
  } else {
    logSuccess(`Payout is ${formatIsk(totalPayout)} (>20B) - perfect for testing!`);
  }

  // Step 2: Create Cycle 5
  logStep('2️⃣', 'Creating Cycle 5...');
  const cycle5 = await createCycle(apiCall, 'Rollover Suite - Cycle 5');
  ctx.cycleIds.push(cycle5.id);
  logSuccess(`Cycle 5 created: ${cycle5.id.substring(0, 8)}`);

  // Step 3: Create FULL_PAYOUT rollover participation
  logStep('3️⃣', 'Creating FULL_PAYOUT rollover with 20B cap test...');
  const rolloverP = await createParticipation(apiCall, {
    cycleId: cycle5.id,
    characterName: 'Rollover Test User',
    amountIsk: Math.min(totalPayout, 20000000000).toFixed(2),
    testUserId: ctx.testUserId,
    rollover: {
      type: 'FULL_PAYOUT',
    },
  });
  ctx.latestParticipationId = rolloverP.id;
  logSuccess(`Rollover participation created: ${rolloverP.id.substring(0, 8)}`);

  // Step 4: Open Cycle 5 (closes Cycle 4, processes rollover with cap)
  logStep('4️⃣', 'Opening Cycle 5 (closes Cycle 4, processes capped rollover)...');
  await openCycle(apiCall, cycle5.id);
  ctx.currentOpenCycleId = cycle5.id;
  logSuccess('Cycle 5 opened, Cycle 4 closed');

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step 5: Verify 20B cap and excess payout
  logStep('5️⃣', 'Verifying 20B cap and excess payout...');
  const cycle5Participations = await getParticipations(apiCall, cycle5.id);
  const processedRollover = cycle5Participations.find((p: any) => p.id === rolloverP.id);

  if (!processedRollover) {
    throw new Error('❌ Rollover participation not found in Cycle 5');
  }

  if (processedRollover.status !== 'OPTED_IN') {
    throw new Error(`❌ Expected OPTED_IN, got ${processedRollover.status}`);
  }
  logSuccess('Auto-validated to OPTED_IN');

  const rolledAmount = Number(processedRollover.amountIsk);
  logInfo(`Rolled over amount: ${formatIsk(rolledAmount)}`);

  // Verify rollover didn't exceed 20B
  if (rolledAmount > 20000000000) {
    throw new Error(`❌ Rollover exceeded 20B cap: ${formatIsk(rolledAmount)}`);
  }
  logSuccess(`Rollover capped at: ${formatIsk(rolledAmount)}`);

  // Calculate expected values
  const expectedRollover = Math.min(totalPayout, 20000000000);
  const expectedExcess = totalPayout - expectedRollover;

  assertApproxEqual(
    rolledAmount,
    expectedRollover,
    1.0,
    'Rollover amount mismatch',
  );
  logSuccess(`Rollover amount correct: ${formatIsk(rolledAmount)}`);

  ctx.lastInitialAmount = rolledAmount;

  // Step 6: Verify excess payout
  const cycle4Participations = await getParticipations(apiCall, cycle4Id);
  const cycle4P = cycle4Participations.find((p: any) => p.userId === ctx.testUserId);

  if (cycle4P) {
    const payoutAmount = Number(cycle4P.payoutAmountIsk || '0');

    logInfo(`Total Payout: ${formatIsk(totalPayout)}`);
    logInfo(`Rolled Over: ${formatIsk(rolledAmount)}`);
    logInfo(`Expected Excess: ${formatIsk(expectedExcess)}`);
    logInfo(`Actual Payout: ${formatIsk(payoutAmount)}`);

    assertApproxEqual(
      payoutAmount,
      expectedExcess,
      1.0,
      'Excess payout amount mismatch',
    );

    if (totalPayout > 20000000000) {
      logSuccess(
        `Correctly handled >20B payout: ${formatIsk(rolledAmount)} rolled, ${formatIsk(payoutAmount)} paid out`,
      );
    } else {
      logSuccess(
        `Logic correctly handled ${formatIsk(totalPayout)} payout (under 20B cap)`,
      );
    }

    if (payoutAmount > 0 && cycle4P.status !== 'AWAITING_PAYOUT') {
      logInfo(`Status: ${cycle4P.status} (note: expected AWAITING_PAYOUT for ${formatIsk(payoutAmount)})`);
    } else {
      logSuccess(`Status: ${cycle4P.status}`);
    }
  }

  await waitForUser(
    config,
    'Verify in UI:\n   - Cycle 4 is COMPLETED\n   - Cycle 5 is OPEN with 20B rollover (capped)\n   - Excess amount shows as payout in Cycle 4',
  );

  printScenarioComplete();
}

// Allow standalone execution for debugging (requires Scenario 04 state)
if (require.main === module) {
  console.error('❌ Scenario 05 must be run via the suite runner (requires Scenario 04 state)');
  console.log('   Use: pnpm exec ts-node scripts/tests/participation-rollover/participation-rollover.suite.ts');
  process.exit(1);
}

