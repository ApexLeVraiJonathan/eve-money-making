/**
 * Scenario 3: INITIAL_ONLY Rollover
 *
 * Tests that a user can roll over only their initial investment amount,
 * with profit being paid out.
 *
 * Flow:
 * 1. Setup: Create and complete Cycle 1 with profit
 * 2. Setup: Create Cycle 2 with FULL_PAYOUT rollover
 * 3. Generate profit in Cycle 2
 * 4. Create Cycle 3 with INITIAL_ONLY rollover
 * 5. Open Cycle 3 (closes Cycle 2, processes rollover)
 * 6. Verify only initial amount was rolled over
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
} from '../helpers';

const prisma = new PrismaClient();

export async function testInitialOnlyRollover(
  ctx: TestContext,
): Promise<string> {
  const apiCall = createApiCall(ctx.config);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟠 SCENARIO 3: INITIAL_ONLY Rollover');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // SETUP: Create Cycle 1 with 10B participation and complete it
  console.log('📋 SETUP: Creating Cycle 1 with 10B participation...');
  const cycle1 = await createCycle(apiCall, 'Initial Only Test - Cycle 1');
  await createParticipation(apiCall, {
    cycleId: cycle1.id,
    characterName: 'Initial User',
    amountIsk: '10000000000.00',
    testUserId: 'initial',
  });
  await createFakeDonation(
    ctx,
    10000000000,
    `ARB-${cycle1.id.substring(0, 8)}-initial`,
  );
  await matchDonations(apiCall, cycle1.id);
  await openCycle(apiCall, cycle1.id);
  console.log('  ✓ Cycle 1 opened\n');

  // SETUP: Create Cycle 2 with FULL_PAYOUT rollover
  console.log('📋 SETUP: Creating Cycle 2 with FULL_PAYOUT rollover...');
  const cycle2 = await createCycle(apiCall, 'Initial Only Test - Cycle 2');
  await createParticipation(apiCall, {
    cycleId: cycle2.id,
    characterName: 'Initial User',
    amountIsk: '10000000000.00',
    testUserId: 'initial',
    rollover: {
      type: 'FULL_PAYOUT',
    },
  });
  await openCycle(apiCall, cycle2.id);
  console.log('  ✓ Cycle 2 opened with FULL_PAYOUT rollover\n');

  // 1. Get current participation from Cycle 2
  console.log('1️⃣  Getting current participation amount...');
  const participations = await getParticipations(apiCall, cycle2.id);
  const currentParticipation = participations.find(
    (p: any) => p.userId === 'initial',
  );
  if (!currentParticipation) {
    throw new Error('❌ Current participation not found');
  }
  const initialAmount = Number(currentParticipation.amountIsk);
  console.log(`  ✓ Current participation: ${formatIsk(initialAmount)}`);

  // 2. Create some profit in Cycle 2
  console.log('\n2️⃣  Creating profit in Cycle 2...');
  const lines = await getCycleLines(apiCall, cycle2.id);
  await createProfitableSells(ctx, lines, 0.7, 1.5);
  await allocateTransactions(apiCall, cycle2.id);
  console.log('  ✓ Sales allocated');

  const overview2 = await getCycleOverview(apiCall);
  const profit = Number(overview2.current.profit.current);
  console.log(`  Cycle 2 Profit: ${formatIsk(profit)}`);

  // 3. Create Cycle 3
  console.log('\n3️⃣  Creating Cycle 3...');
  const cycle3 = await createCycle(apiCall, 'INITIAL_ONLY Rollover Test');
  console.log(`  ✓ Cycle created: ${cycle3.id}`);

  // 4. Create rollover participation (INITIAL_ONLY)
  console.log('\n4️⃣  Creating rollover participation (INITIAL_ONLY)...');
  const rolloverParticipation = await createParticipation(apiCall, {
    cycleId: cycle3.id,
    characterName: 'Initial User',
    amountIsk: initialAmount.toFixed(2),
    testUserId: 'initial',
    rollover: {
      type: 'INITIAL_ONLY',
    },
  });
  console.log(`  ✓ Rollover participation created: ${rolloverParticipation.id}`);

  // 5. Open Cycle 3 (processes rollover)
  console.log('\n5️⃣  Opening Cycle 3 (processes rollover)...');
  await openCycle(apiCall, cycle3.id);
  console.log('  ✓ Cycle 3 opened');

  // 6. Verify rollover processed with INITIAL_ONLY
  console.log('\n6️⃣  Verifying INITIAL_ONLY rollover...');
  const cycle3Participations = await getParticipations(apiCall, cycle3.id);
  const processedRollover = cycle3Participations.find(
    (p: any) => p.id === rolloverParticipation.id,
  );

  if (!processedRollover) {
    throw new Error('❌ Rollover participation not found');
  }

  // Should roll over only initial amount
  const rolledAmount = Number(processedRollover.amountIsk);
  if (Math.abs(rolledAmount - initialAmount) > 1) {
    throw new Error(
      `❌ Expected initial amount ${formatIsk(initialAmount)}, got ${formatIsk(rolledAmount)}`,
    );
  }
  console.log(`  ✓ Rolled over: ${formatIsk(rolledAmount)} (initial only)`);
  console.log(`  ✓ Profit will be paid out separately`);

  console.log('\n✅ SCENARIO 3 COMPLETE\n');
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
        '  pnpm exec ts-node scripts/tests/participation-rollover/scenarios/03-initial-only-rollover.test.ts --apiKey <key> --characterId <id>',
      );
      process.exit(1);
    }

    const ctx: TestContext = {
      config,
      characterId: config.characterId,
      transactionIdCounter: 0,
    };

    try {
      console.log('\n🚀 Running Scenario 3: INITIAL_ONLY Rollover\n');
      await testInitialOnlyRollover(ctx);
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

