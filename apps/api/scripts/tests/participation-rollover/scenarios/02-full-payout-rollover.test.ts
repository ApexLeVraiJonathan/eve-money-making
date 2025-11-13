/**
 * Scenario 2: FULL_PAYOUT Rollover
 *
 * Tests that a user can roll over their full payout (initial + profit) into the next cycle,
 * and that this is capped at 20B ISK.
 *
 * Flow:
 * 1. Setup: Create Cycle 1 with 10B participation and open it
 * 2. Generate profit in Cycle 1
 * 3. Create Cycle 2 with FULL_PAYOUT rollover participation
 * 4. Open Cycle 2 (closes Cycle 1, processes rollover)
 * 5. Verify rollover was auto-validated and amount is correct
 * 6. Verify max cap is now 20B (rollover investor)
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
  getMaxParticipation,
  createFakeDonation,
  matchDonations,
  createProfitableSells,
  allocateTransactions,
  formatIsk,
} from '../helpers';

const prisma = new PrismaClient();

export async function testFullPayoutRollover(
  ctx: TestContext,
): Promise<{ cycle2Id: string; rolloverParticipationId: string }> {
  const apiCall = createApiCall(ctx.config);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟢 SCENARIO 2: FULL_PAYOUT Rollover');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // SETUP: Create Cycle 1 with 10B participation
  console.log('📋 SETUP: Creating Cycle 1 with 10B participation...');
  const cycle1 = await createCycle(apiCall, 'Rollover Test - Cycle 1');
  console.log(`  ✓ Cycle 1 created: ${cycle1.id}`);

  await createParticipation(apiCall, {
    cycleId: cycle1.id,
    characterName: 'Rollover User',
    amountIsk: '10000000000.00',
    testUserId: 'rollover',
  });
  console.log('  ✓ Participation created');

  await createFakeDonation(
    ctx,
    10000000000,
    `ARB-${cycle1.id.substring(0, 8)}-rollover`,
  );
  await matchDonations(apiCall, cycle1.id);
  console.log('  ✓ Donation matched');

  // DEBUG: Check participation status BEFORE opening cycle
  const participationsBeforeOpen = await getParticipations(apiCall, cycle1.id);
  console.log(`  DEBUG: ${participationsBeforeOpen.length} participations before opening:`);
  participationsBeforeOpen.forEach((p: any) => {
    console.log(`    - userId=${p.userId}, status=${p.status}`);
  });

  await openCycle(apiCall, cycle1.id);
  console.log('  ✓ Cycle 1 opened');

  // DEBUG: Verify participation exists with correct userId
  const cycle1Participations = await getParticipations(apiCall, cycle1.id);
  const cycle1Part = cycle1Participations.find((p: any) => p.userId === 'rollover');
  if (!cycle1Part) {
    console.log('\n❌ DEBUG: Participation not found with userId=rollover');
    console.log('Available participations:', cycle1Participations.map((p: any) => ({
      id: p.id.substring(0, 8),
      userId: p.userId,
      status: p.status,
    })));
    throw new Error('Setup failed: participation not found');
  }
  console.log(`  ✓ Verified participation exists: userId=${cycle1Part.userId}, status=${cycle1Part.status}\n`);

  // 1. Create profit in Cycle 1
  console.log('1️⃣  Creating profit in Cycle 1...');
  const lines = await getCycleLines(apiCall, cycle1.id);
  console.log(`  ✓ Found ${lines.length} cycle lines`);

  // Create sell transactions for 80% of items at 1.5x price (50% profit)
  const createdSells = await createProfitableSells(ctx, lines, 0.8, 1.5);
  console.log(`  ✓ Created ${createdSells} sell transactions`);

  await allocateTransactions(apiCall, cycle1.id);
  console.log('  ✓ Sales allocated');

  // 2. Check profit
  const overview1 = await getCycleOverview(apiCall);
  const profit = Number(overview1.current.profit.current);
  const investorProfitShare = profit * 0.5; // 50% profit share to investors
  const totalPayout = 10000000000 + investorProfitShare; // Initial + investor profit share
  console.log(`  Cycle 1 Profit: ${formatIsk(profit)}`);
  console.log(`  Investor Profit Share (50%): ${formatIsk(investorProfitShare)}`);
  console.log(`  Expected Payout: ${formatIsk(totalPayout)}`);

  // 3. Create Cycle 2
  console.log('\n2️⃣  Creating Cycle 2...');
  const cycle2 = await createCycle(apiCall, 'FULL_PAYOUT Rollover Test');
  console.log(`  ✓ Cycle created: ${cycle2.id}`);

  // 4. Create rollover participation (FULL_PAYOUT)
  console.log('\n3️⃣  Creating rollover participation (FULL_PAYOUT)...');
  const rolloverParticipation = await createParticipation(apiCall, {
    cycleId: cycle2.id,
    characterName: 'Rollover User',
    amountIsk: totalPayout.toFixed(2),
    testUserId: 'rollover',
    rollover: {
      type: 'FULL_PAYOUT',
    },
  });
  console.log(`  ✓ Rollover participation created: ${rolloverParticipation.id}`);
  console.log(`  ✓ Memo: ${rolloverParticipation.memo}`);

  // Verify memo format: ROLLOVER-{cycleId:8}-{fromParticipationId:8}
  const expectedMemoPrefix = `ROLLOVER-${cycle2.id.substring(0, 8)}-`;
  if (!rolloverParticipation.memo.startsWith(expectedMemoPrefix)) {
    throw new Error(
      `❌ Invalid memo format: ${rolloverParticipation.memo} (expected prefix: ${expectedMemoPrefix})`,
    );
  }
  console.log('  ✓ Memo format correct');

  // Verify status is AWAITING_INVESTMENT (not validated yet)
  if (rolloverParticipation.status !== 'AWAITING_INVESTMENT') {
    throw new Error(
      `❌ Expected status AWAITING_INVESTMENT, got ${rolloverParticipation.status}`,
    );
  }
  console.log('  ✓ Status: AWAITING_INVESTMENT (awaiting cycle close)');

  // 5. Open Cycle 2 (closes Cycle 1, processes payouts and rollovers)
  console.log('\n4️⃣  Opening Cycle 2 (closes Cycle 1, processes rollover)...');
  await openCycle(apiCall, cycle2.id);
  console.log('  ✓ Cycle 2 opened, Cycle 1 closed');

  // Give a moment for async operations to complete
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log('  ✓ Waited for rollover processing...');

  // Debug: Check database directly
  console.log('\n🔍 DEBUG: Checking database...');
  const dbParticipation = await prisma.cycleParticipation.findUnique({
    where: { id: rolloverParticipation.id },
    include: { rolloverFromParticipation: true },
  });
  console.log('  DB Participation Status:', dbParticipation?.status);
  console.log('  DB RolloverType:', dbParticipation?.rolloverType);
  console.log(
    '  DB RolloverFromId:',
    dbParticipation?.rolloverFromParticipationId?.substring(0, 8) || 'null',
  );
  console.log(
    '  DB Amount:',
    formatIsk(dbParticipation?.amountIsk ? String(dbParticipation.amountIsk) : '0'),
  );

  // 6. Verify rollover was processed
  console.log('\n5️⃣  Verifying rollover processing...');
  const participations = await getParticipations(apiCall, cycle2.id);

  console.log(`  Found ${participations.length} participations in Cycle 2:`);
  participations.forEach((p: any) => {
    console.log(
      `    - ID: ${p.id.substring(0, 8)}, Status: ${p.status}, Amount: ${formatIsk(p.amountIsk)}, RolloverType: ${p.rolloverType || 'none'}`,
    );
  });

  const processedRollover = participations.find(
    (p: any) => p.id === rolloverParticipation.id,
  );

  if (!processedRollover) {
    console.log(
      `  ❌ Looking for participation ID: ${rolloverParticipation.id.substring(0, 8)}`,
    );
    throw new Error('❌ Rollover participation not found');
  }

  console.log(`  Status: ${processedRollover.status}`);
  console.log(`  Amount: ${formatIsk(processedRollover.amountIsk)}`);

  // Should be auto-validated (OPTED_IN)
  if (processedRollover.status !== 'OPTED_IN') {
    throw new Error(
      `❌ Expected status OPTED_IN, got ${processedRollover.status}`,
    );
  }
  console.log('  ✓ Auto-validated to OPTED_IN');

  // Amount should match payout (or be capped at 20B if payout > 20B)
  const expectedAmount = Math.min(totalPayout, 20000000000);
  const actualAmount = Number(processedRollover.amountIsk);
  if (Math.abs(actualAmount - expectedAmount) > 1) {
    throw new Error(
      `❌ Amount mismatch: expected ${formatIsk(expectedAmount)}, got ${formatIsk(actualAmount)}`,
    );
  }
  console.log(`  ✓ Amount: ${formatIsk(actualAmount)} (correct)`);

  // 7. Check that max cap is now 20B (rollover investor)
  console.log('\n6️⃣  Checking max participation cap...');
  const maxCap = await getMaxParticipation(apiCall, 'rollover');
  console.log(`  ✓ Max cap: ${maxCap.maxAmountB}B ISK`);
  if (maxCap.maxAmountB !== 20) {
    throw new Error(
      `❌ Expected 20B cap for rollover investor, got ${maxCap.maxAmountB}B`,
    );
  }

  console.log('\n✅ SCENARIO 2 COMPLETE\n');
  return { cycle2Id: cycle2.id, rolloverParticipationId: rolloverParticipation.id };
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
        '  pnpm exec ts-node scripts/tests/participation-rollover/scenarios/02-full-payout-rollover.test.ts --apiKey <key> --characterId <id>',
      );
      process.exit(1);
    }

    const ctx: TestContext = {
      config,
      characterId: config.characterId,
      transactionIdCounter: 0,
    };

    try {
      console.log('\n🚀 Running Scenario 2: FULL_PAYOUT Rollover\n');
      await testFullPayoutRollover(ctx);
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

