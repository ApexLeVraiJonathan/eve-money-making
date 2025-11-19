/**
 * Scenario 06: Opt-out of PLANNED Cycle
 *
 * Tests opt-out functionality:
 * - Creates a new PLANNED cycle
 * - Creates participation and matches donation
 * - Opts out while cycle is still PLANNED
 * - Attempts opt-out of OPEN cycle (should fail)
 * - Verifies correct status transitions
 *
 * Depends on: Scenario 05 (Cycle 5 must be OPEN)
 */

import {
  TestConfig,
  SharedRolloverContext,
  createApiCall,
  createCycle,
  createParticipation,
  getParticipations,
  optOutParticipation,
  createFakeDonation,
  matchDonations,
  formatIsk,
  logStep,
  logSuccess,
  logInfo,
  logWarning,
  printScenarioHeader,
  printScenarioComplete,
  waitForUser,
} from '../helpers/index';

export async function scenario06OptOutPlanned(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader('🔴', 'SCENARIO 06: Opt-out of PLANNED Cycle');

  const apiCall = createApiCall(config);
  const testContext = { characterId: config.characterId, transactionIdCounter: ctx.transactionIdCounter };

  if (ctx.cycleIds.length < 5) {
    throw new Error('❌ Scenario 06 requires Scenario 05 to run first');
  }

  // Step 1: Create a new PLANNED cycle (Cycle 6) for opt-out testing
  logStep('1️⃣', 'Creating Cycle 6 (for opt-out testing)...');
  const cycle6 = await createCycle(apiCall, 'Rollover Suite - Cycle 6 (Opt-out Test)');
  ctx.cycleIds.push(cycle6.id);
  logSuccess(`Cycle 6 created: ${cycle6.id.substring(0, 8)}`);

  // Step 2: Create participation in PLANNED cycle
  logStep('2️⃣', 'Creating participation in PLANNED cycle...');
  const participation = await createParticipation(apiCall, {
    cycleId: cycle6.id,
    characterName: 'Opt-out Test User',
    amountIsk: '5000000000.00',
    testUserId: 'opt-out-test-user',
  });
  logSuccess(`Participation created: ${participation.id.substring(0, 8)}`);
  logInfo(`Initial status: ${participation.status}`);

  // Step 3: Test opt-out while AWAITING_INVESTMENT (should delete)
  logStep('3️⃣', 'Testing opt-out while AWAITING_INVESTMENT...');
  await optOutParticipation(apiCall, participation.id);
  logSuccess('Opt-out successful while AWAITING_INVESTMENT');

  const participationsAfterOptOut = await getParticipations(apiCall, cycle6.id);
  const deleted = !participationsAfterOptOut.find((p: any) => p.id === participation.id);

  if (deleted) {
    logSuccess('Participation was deleted (correct for AWAITING_INVESTMENT)');
  } else {
    logWarning('Participation still exists (may be marked OPTED_OUT)');
  }

  // Step 4: Create another participation, match it, then opt-out
  logStep('4️⃣', 'Creating and matching another participation...');
  const participation2 = await createParticipation(apiCall, {
    cycleId: cycle6.id,
    characterName: 'Opt-out Test User 2',
    amountIsk: '3000000000.00',
    testUserId: 'opt-out-test-user2',
  });
  logSuccess(`Participation created: ${participation2.id.substring(0, 8)}`);

  await createFakeDonation(
    testContext,
    3000000000,
    `ARB-${cycle6.id.substring(0, 8)}-opt-out-test-user2`,
  );
  ctx.transactionIdCounter = testContext.transactionIdCounter;
  logSuccess('Donation created');

  await matchDonations(apiCall, cycle6.id);
  logSuccess('Donation matched');

  // Verify status changed to OPTED_IN
  const participationsAfterMatch = await getParticipations(apiCall, cycle6.id);
  const matched = participationsAfterMatch.find((p: any) => p.id === participation2.id);

  if (matched?.status === 'OPTED_IN') {
    logSuccess('Participation validated to OPTED_IN');
  } else {
    logInfo(`Status: ${matched?.status} (expected OPTED_IN)`);
  }

  await waitForUser(
    config,
    'Verify in UI:\n   - Cycle 6 is PLANNED\n   - One participation is OPTED_IN',
  );

  // Step 5: Opt-out while OPTED_IN (should mark as OPTED_OUT)
  logStep('5️⃣', 'Testing opt-out while OPTED_IN...');
  await optOutParticipation(apiCall, participation2.id);
  logSuccess('Opt-out successful while OPTED_IN');

  const participationsAfterOptOut2 = await getParticipations(apiCall, cycle6.id);
  const optedOut = participationsAfterOptOut2.find((p: any) => p.id === participation2.id);

  if (optedOut?.status === 'OPTED_OUT') {
    logSuccess('Participation marked as OPTED_OUT (correct for paid participation)');
    if (optedOut.optedOutAt) {
      logSuccess(`optedOutAt timestamp set: ${new Date(optedOut.optedOutAt).toISOString()}`);
    }
  } else if (!optedOut) {
    logWarning('Participation was deleted (acceptable alternative)');
  } else {
    logWarning(`Status: ${optedOut.status} (expected OPTED_OUT or deleted)`);
  }

  // Step 6: Attempt opt-out of OPEN cycle (should fail)
  logStep('6️⃣', 'Testing opt-out of OPEN cycle (should fail)...');

  if (ctx.currentOpenCycleId) {
    // Get any participation in the open cycle
    const openCycleParticipations = await getParticipations(apiCall, ctx.currentOpenCycleId);
    const openParticipation = openCycleParticipations.find((p: any) => p.userId === ctx.testUserId);

    if (openParticipation) {
      try {
        await optOutParticipation(apiCall, openParticipation.id);
        throw new Error('❌ Should have rejected opt-out of OPEN cycle');
      } catch (error) {
        if (error instanceof Error && error.message.includes('PLANNED')) {
          logSuccess('Correctly rejected opt-out of OPEN cycle');
        } else if (error instanceof Error && error.message.includes('❌ Should have')) {
          throw error;
        } else {
          logSuccess('Opt-out of OPEN cycle rejected with error');
        }
      }
    } else {
      logInfo('No participation found in OPEN cycle to test rejection');
    }
  }

  await waitForUser(
    config,
    'Verify in UI:\n   - Opted-out participation shows correct status\n   - OPEN cycle participations cannot be opted out',
  );

  printScenarioComplete();
}

// Allow standalone execution for debugging (requires Scenario 05 state)
if (require.main === module) {
  console.error('❌ Scenario 06 must be run via the suite runner (requires Scenario 05 state)');
  console.log('   Use: pnpm exec ts-node scripts/tests/participation-rollover/participation-rollover.suite.ts');
  process.exit(1);
}

