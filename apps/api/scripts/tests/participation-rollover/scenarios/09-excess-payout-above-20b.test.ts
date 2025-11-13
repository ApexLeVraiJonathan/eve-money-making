/**
 * Scenario 9: Excess Payout Above 20B
 * 
 * Tests that when a user's payout exceeds 20B, the rollover is capped at 20B
 * and the excess amount is correctly marked for payout.
 * 
 * Flow:
 * 1. User starts with 10B participation
 * 2. Generates significant profit (e.g., 15B profit → 25B total payout)
 * 3. Rolls over with FULL_PAYOUT
 * 4. Verify: 20B rolled over, 5B marked for payout
 */

import { PrismaClient } from '@eve/prisma';
import {
  TestConfig,
  TestContext,
  createApiCall,
  createCycle,
  openCycle,
  getCycleLines,
  getCycleOverview,
  createParticipation,
  getParticipations,
  createFakeDonation,
  matchDonations,
  createProfitableSells,
  allocateTransactions,
  formatIsk,
  assertApproxEqual,
  logStep,
  logSuccess,
  logWarning,
  logInfo,
  printScenarioHeader,
  printScenarioComplete,
} from '../helpers';

const prisma = new PrismaClient();

export async function testExcessPayoutAbove20B(
  config: TestConfig,
  ctx: TestContext,
): Promise<void> {
  printScenarioHeader('💎', 'SCENARIO 9: Excess Payout Above 20B');

  const apiCall = createApiCall(config);

  // Step 1: Create first cycle with 10B participation
  logStep('1️⃣', 'Creating Cycle 1 with 10B participation...');
  const cycle1 = await createCycle(apiCall, 'Excess Payout Test - Cycle 1');
  
  await createParticipation(apiCall, {
    cycleId: cycle1.id,
    characterName: 'Excess Payout User',
    amountIsk: '10000000000.00',
    testUserId: 'excess_user',
  });

  await createFakeDonation(
    ctx,
    10000000000,
    `ARB-${cycle1.id.substring(0, 8)}-excess_user`,
  );
  await matchDonations(apiCall, cycle1.id);
  logSuccess('Donation matched');
  
  await openCycle(apiCall, cycle1.id);
  logSuccess('Cycle 1 opened');
  
  // Verify participation is OPTED_IN
  const cycle1Participations = await getParticipations(apiCall, cycle1.id);
  const cycle1P = cycle1Participations.find((p: any) => p.userId === 'excess_user');
  logInfo(`Cycle 1 participation status: ${cycle1P?.status || 'NOT FOUND'}`);

  // Step 2: Build rollover history (get 20B cap)
  logStep('2️⃣', 'Creating Cycle 2 with rollover to establish 20B cap...');
  const cycle2 = await createCycle(apiCall, 'Excess Payout Test - Cycle 2');
  
  // Create rollover participation BEFORE opening Cycle 2
  await createParticipation(apiCall, {
    cycleId: cycle2.id,
    characterName: 'Excess Payout User',
    amountIsk: '10000000000.00', // Placeholder, will be replaced by payout
    testUserId: 'excess_user',
    rollover: {
      type: 'FULL_PAYOUT',
    },
  });
  logSuccess('Rollover participation created in Cycle 2');

  // Now open Cycle 2 (closes Cycle 1, processes rollover)
  await openCycle(apiCall, cycle2.id);
  logSuccess('Cycle 2 opened (Cycle 1 closed, rollover processed - user now has 20B cap)');

  // Step 3: Generate huge profit in Cycle 2 to get >20B payout
  logStep('3️⃣', 'Generating massive profit in Cycle 2 (target: >20B payout)...');
  
  const lines = await getCycleLines(apiCall, cycle2.id);
  logInfo(`Found ${lines.length} cycle lines`);

  // Create highly profitable sell transactions (80% sold at 400% profit)
  console.log('\n📊 [SETUP] Creating highly profitable sell transactions...');
  const createdSells = await createProfitableSells(
    ctx,
    lines,
    0.8,  // Sell 80% of inventory
    4.0,  // Sell at 4x the buy price (300% profit)
  );
  logSuccess(`Created ${createdSells} highly profitable sell transactions`);

  await allocateTransactions(apiCall, cycle2.id);
  logSuccess('Sales allocated');

  // Check the actual profit generated
  const overview = await getCycleOverview(apiCall);
  const profit = Number(overview.current.profit.current);
  const investorProfitShare = profit * 0.5; // 50% goes to investors
  const cycle2Investment = 10000000000; // Initial 10B from Cycle 1
  const totalPayout = cycle2Investment + investorProfitShare;

  console.log(`\n  📊 Profit Analysis:`);
  console.log(`    Cycle Profit: ${formatIsk(profit)}`);
  console.log(`    Investor Share (50%): ${formatIsk(investorProfitShare)}`);
  console.log(`    Initial Investment: ${formatIsk(cycle2Investment)}`);
  console.log(`    Total Payout: ${formatIsk(totalPayout)}`);

  if (totalPayout <= 20000000000) {
    logWarning(
      `Payout is ${formatIsk(totalPayout)} (≤20B). This scenario requires >20B to fully validate excess handling.`,
    );
    logWarning('Continuing test anyway to verify logic handles this case correctly...');
  } else {
    logSuccess(`Payout is ${formatIsk(totalPayout)} (>20B) - perfect for testing!`);
  }

  // Step 4: Create Cycle 3 with FULL_PAYOUT rollover
  logStep('4️⃣', 'Creating Cycle 3 with FULL_PAYOUT rollover...');
  const cycle3 = await createCycle(apiCall, 'Excess Payout Test - Cycle 3');
  
  const p3 = await createParticipation(apiCall, {
    cycleId: cycle3.id,
    characterName: 'Excess Payout User',
    amountIsk: '10000000000.00', // Placeholder, will be replaced by actual payout
    testUserId: 'excess_user',
    rollover: {
      type: 'FULL_PAYOUT',
    },
  });
  logSuccess(`Rollover participation created: ${p3.id.substring(0, 8)}`);

  // Step 5: Open Cycle 3 (closes Cycle 2, processes rollover)
  await openCycle(apiCall, cycle3.id);
  logSuccess('Cycle 3 opened (Cycle 2 closed, rollover processed)');

  // Step 6: Verify rollover was capped at 20B and excess was paid out
  logStep('5️⃣', 'Verifying 20B cap and excess payout...');
  
  const cycle3Participations = await getParticipations(apiCall, cycle3.id);
  const rolloverParticipation = cycle3Participations.find(
    (p: any) => p.id === p3.id,
  );

  if (!rolloverParticipation) {
    throw new Error('❌ Rollover participation not found in Cycle 3');
  }

  const rolledAmount = Number(rolloverParticipation.amountIsk);
  console.log(`  Rolled over amount: ${formatIsk(rolledAmount)}`);

  // Verify rollover didn't exceed 20B
  if (rolledAmount > 20000000000) {
    throw new Error(
      `❌ Rollover exceeded 20B cap: ${formatIsk(rolledAmount)}`,
    );
  }
  logSuccess(`Rollover capped at: ${formatIsk(rolledAmount)}`);

  // Calculate expected rollover and payout
  const expectedRollover = Math.min(totalPayout, 20000000000);
  const expectedExcess = totalPayout - expectedRollover;

  // Verify the rollover amount matches expectations
  assertApproxEqual(
    rolledAmount,
    expectedRollover,
    1.00, // Allow 1 ISK tolerance for rounding
    `Rollover amount mismatch`,
  );
  logSuccess(`Rollover amount correct: ${formatIsk(rolledAmount)}`);

  // Check the previous cycle's participation for payout amount
  const cycle2Participations = await getParticipations(apiCall, cycle2.id);
  const cycle2Participation = cycle2Participations.find(
    (p: any) => p.userId === 'excess_user',
  );

  if (!cycle2Participation) {
    throw new Error('❌ Cycle 2 participation not found');
  }

  const paidOutAmount = Number(cycle2Participation.payoutAmountIsk || '0');
  console.log(`\n  💰 Payout Breakdown:`);
  console.log(`    Total Payout: ${formatIsk(totalPayout)}`);
  console.log(`    Rolled Over: ${formatIsk(rolledAmount)}`);
  console.log(`    Paid Out: ${formatIsk(paidOutAmount)}`);
  console.log(`    Expected Excess: ${formatIsk(expectedExcess)}`);

  // Verify excess was correctly calculated
  assertApproxEqual(
    paidOutAmount,
    expectedExcess,
    1.00, // Allow 1 ISK tolerance
    `Excess payout amount mismatch`,
  );

  if (totalPayout > 20000000000) {
    logSuccess(
      `Correctly handled >20B payout: ${formatIsk(rolledAmount)} rolled over, ${formatIsk(paidOutAmount)} paid out`,
    );
  } else {
    logSuccess(
      `Logic correctly handled ${formatIsk(totalPayout)} payout (under 20B cap)`,
    );
  }

  printScenarioComplete();
}

// Allow running this test standalone
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const getArg = (name: string) => {
      const index = args.indexOf(name);
      return index >= 0 ? args[index + 1] : undefined;
    };

    const config: TestConfig = {
      apiUrl: getArg('--apiUrl') || 'http://localhost:3000',
      token: getArg('--token'),
      apiKey: getArg('--apiKey'),
      characterId: parseInt(getArg('--characterId') || '0'),
      skipPauses: args.includes('--skip-pauses'),
    };

    const ctx: TestContext = {
      characterId: config.characterId,
      transactionIdCounter: 0,
    };

    try {
      console.log('\n🧪 Running Scenario 9: Excess Payout Above 20B\n');
      await testExcessPayoutAbove20B(config, ctx);
      console.log('\n✅ Test passed!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}

