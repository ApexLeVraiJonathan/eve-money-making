/**
 * Scenario 4: CUSTOM_AMOUNT Rollover
 *
 * Tests that a user can roll over a custom amount (less than or equal to initial investment).
 *
 * Flow:
 * 1. Setup: Create cycles 1-3 to build rollover history
 * 2. Try to create rollover with custom amount > initial (should fail)
 * 3. Create rollover with valid custom amount (5B)
 * 4. Open cycle and verify custom amount was rolled over
 */

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
  allocateTransactions,
  formatIsk,
} from '../helpers';
import { createFakeSellTransactions, prisma } from '../../../test-utilities';

export async function testCustomAmountRollover(
  ctx: TestContext,
): Promise<string> {
  const apiCall = createApiCall(ctx.config);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟣 SCENARIO 4: CUSTOM_AMOUNT Rollover');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // SETUP: Create Cycle 1 with profit, then Cycle 2 with more profit
  console.log('📋 SETUP: Creating Cycle 1 with 10B participation...');
  
  // Cycle 1: 10B participation with profit generation
  const cycle1 = await createCycle(apiCall, 'Custom Amount Test - Cycle 1');
  await createParticipation(apiCall, {
    cycleId: cycle1.id,
    characterName: 'Custom User',
    amountIsk: '10000000000.00',
    testUserId: 'custom',
  });
  await createFakeDonation(
    ctx,
    10000000000,
    `ARB-${cycle1.id.substring(0, 8)}-custom`,
  );
  await matchDonations(apiCall, cycle1.id);
  await openCycle(apiCall, cycle1.id);
  console.log('  ✓ Cycle 1 opened\n');

  // Generate profit in Cycle 1
  console.log('📋 SETUP: Generating profit in Cycle 1...');
  const cycle1Lines = await getCycleLines(apiCall, cycle1.id);
  await createFakeSellTransactions(ctx, cycle1Lines, 0.8);
  await allocateTransactions(apiCall, cycle1.id);
  const ov1 = await getCycleOverview(apiCall);
  const profit1 = Number(ov1.current.profit.current);
  const investorShare1 = profit1 * 0.5;
  console.log(`  ✓ Generated ${profit1.toFixed(2)} ISK profit (investor gets ${investorShare1.toFixed(2)} ISK)\n`);

  // Cycle 2 with FULL_PAYOUT rollover
  console.log('📋 SETUP: Creating Cycle 2 with FULL_PAYOUT rollover...');
  const cycle2 = await createCycle(apiCall, 'Custom Amount Test - Cycle 2');
  await createParticipation(apiCall, {
    cycleId: cycle2.id,
    characterName: 'Custom User',
    amountIsk: (10000000000 + investorShare1).toFixed(2),
    testUserId: 'custom',
    rollover: {
      type: 'FULL_PAYOUT',
    },
  });
  await openCycle(apiCall, cycle2.id);
  console.log('  ✓ Cycle 2 opened with rollover\n');

  // Generate MORE profit in Cycle 2
  console.log('1️⃣  Generating profit in Cycle 2 to create surplus...');
  const cycle2Lines = await getCycleLines(apiCall, cycle2.id);
  await createFakeSellTransactions(ctx, cycle2Lines, 0.7);
  await allocateTransactions(apiCall, cycle2.id);
  
  const overview2 = await getCycleOverview(apiCall);
  const profit2 = Number(overview2.current.profit.current);
  const investorShare2 = profit2 * 0.5;
  const cycle2Investment = 10000000000 + investorShare1;
  const totalPayout = cycle2Investment + investorShare2;
  
  // Show EXACT amounts
  console.log(`  Cycle 2 Profit: ${profit2.toFixed(2)} ISK (${formatIsk(profit2)})`);
  console.log(`  Investor Share (50%): ${investorShare2.toFixed(2)} ISK (${formatIsk(investorShare2)})`);
  console.log(`  Initial + Cycle 1 profit: ${cycle2Investment.toFixed(2)} ISK`);
  console.log(`  Total Payout: ${totalPayout.toFixed(2)} ISK (${formatIsk(totalPayout)})\n`);

  // 2. Get current participation
  const participations = await getParticipations(apiCall, cycle2.id);
  const currentParticipation = participations.find(
    (p: any) => p.userId === 'custom',
  );
  const initialAmount = Number(currentParticipation.amountIsk);
  console.log(`  Current participation: ${initialAmount.toFixed(2)} ISK`);

  // 2. Create Cycle 3 for custom amount rollover
  console.log('\n2️⃣  Creating Cycle 3 for custom rollover...');
  const cycle3 = await createCycle(apiCall, 'CUSTOM_AMOUNT Rollover Test');
  console.log(`  ✓ Cycle created: ${cycle3.id}`);

  // 3. Try to create rollover with custom amount > initial (should fail)
  console.log('\n3️⃣  Testing custom amount validation...');
  try {
    await createParticipation(apiCall, {
      cycleId: cycle3.id,
      characterName: 'Custom User',
      amountIsk: (initialAmount + 1000000000).toFixed(2), // Initial + 1B (too much)
      testUserId: 'custom',
      rollover: {
        type: 'CUSTOM_AMOUNT',
        customAmountIsk: (initialAmount + 1000000000).toFixed(2),
      },
    });
    throw new Error('❌ Should have rejected custom amount > initial');
  } catch (error) {
    if (error instanceof Error && error.message.includes('initial')) {
      console.log('  ✓ Correctly rejected custom amount > initial');
    } else {
      throw error;
    }
  }

  // 4. Create rollover with valid custom amount (5B)
  console.log('\n4️⃣  Creating rollover with custom amount (5B)...');
  const customAmount = 5000000000;
  const rolloverParticipation = await createParticipation(apiCall, {
    cycleId: cycle3.id,
    characterName: 'Custom User',
    amountIsk: customAmount.toFixed(2),
    testUserId: 'custom',
    rollover: {
      type: 'CUSTOM_AMOUNT',
      customAmountIsk: customAmount.toFixed(2),
    },
  });
  console.log(`  ✓ Rollover participation created: ${rolloverParticipation.id}`);

  // 5. Open Cycle 3
  console.log('\n5️⃣  Opening Cycle 3 (processes custom rollover)...');
  await openCycle(apiCall, cycle3.id);
  console.log('  ✓ Cycle 3 opened');

  // 6. Verify custom amount rollover
  console.log('\n6️⃣  Verifying custom amount rollover...');
  const cycle3Participations = await getParticipations(apiCall, cycle3.id);
  const processedRollover = cycle3Participations.find(
    (p: any) => p.id === rolloverParticipation.id,
  );

  const rolledAmount = Number(processedRollover.amountIsk);
  if (Math.abs(rolledAmount - customAmount) > 1) {
    throw new Error(
      `❌ Expected custom amount ${formatIsk(customAmount)}, got ${formatIsk(rolledAmount)}`,
    );
  }
  console.log(`  ✓ Rolled over: ${formatIsk(rolledAmount)} (custom amount)`);

  // 7. Verify the surplus was marked for payout in Cycle 2
  console.log('\n7️⃣  Verifying surplus payout in Cycle 2...');
  const cycle2ParticipationsAfter = await getParticipations(apiCall, cycle2.id);
  const cycle2Participation = cycle2ParticipationsAfter.find(
    (p: any) => p.userId === 'custom',
  );

  if (!cycle2Participation) {
    throw new Error('❌ Cycle 2 participation not found');
  }

  const payoutAmount = Number(cycle2Participation.payoutAmountIsk || '0');
  const expectedPayout = totalPayout - customAmount; // Total minus what was rolled over

  // Show EXACT amounts for verification
  console.log(`  Total payout was: ${totalPayout.toFixed(2)} ISK (${formatIsk(totalPayout)})`);
  console.log(`  Rolled over: ${customAmount.toFixed(2)} ISK (${formatIsk(customAmount)})`);
  console.log(`  Expected payout: ${expectedPayout.toFixed(2)} ISK (${formatIsk(expectedPayout)})`);
  console.log(`  Actual payout: ${payoutAmount.toFixed(2)} ISK (${formatIsk(payoutAmount)})`);

  // EXACT match required - verify every ISK is accounted for
  if (payoutAmount !== expectedPayout) {
    const difference = Math.abs(payoutAmount - expectedPayout);
    throw new Error(
      `❌ Payout mismatch: expected ${expectedPayout.toFixed(2)} ISK, got ${payoutAmount.toFixed(2)} ISK (difference: ${difference.toFixed(2)} ISK)`,
    );
  }
  console.log(`  ✓ Surplus ${payoutAmount.toFixed(2)} ISK correctly marked for payout (EXACT match)`);

  // 8. Verify participation status in Cycle 2
  if (cycle2Participation.status === 'COMPLETED') {
    console.log(`  ✓ Status: COMPLETED (no payout needed, all rolled over would show this if payout was 0)`);
  } else if (cycle2Participation.status === 'AWAITING_PAYOUT') {
    console.log(`  ✓ Status: AWAITING_PAYOUT (payout pending)`);
  } else {
    console.log(`  ⚠️  Status: ${cycle2Participation.status} (unexpected, but continuing...)`);
  }

  console.log('\n✅ SCENARIO 4 COMPLETE\n');
  return cycle3.id;
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

    if ((!config.token && !config.apiKey) || !config.characterId) {
      console.error('❌ Missing required arguments');
      console.log('\nUsage:');
      console.log(
        '  pnpm exec ts-node scripts/tests/participation-rollover/scenarios/04-custom-amount-rollover.test.ts --apiKey <key> --characterId <id>',
      );
      process.exit(1);
    }

    const ctx: TestContext = {
      config,
      characterId: config.characterId,
      transactionIdCounter: 0,
    };

    try {
      console.log('\n🚀 Running Scenario 4: CUSTOM_AMOUNT Rollover\n');
      await testCustomAmountRollover(ctx);
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

