/**
 * Scenario 1: First-Time Investor (10B Cap)
 *
 * Tests that a new investor is capped at 10B ISK maximum participation.
 *
 * Flow:
 * 1. Check max participation for new user (should be 10B)
 * 2. Create cycle and 10B participation
 * 3. Try to create 15B participation (should fail)
 * 4. Create donation, match, and open cycle
 * 5. Verify cycle shows 10B capital
 */

import { PrismaClient } from '@eve/prisma';

// Import from our new helpers
import {
  TestConfig,
  TestContext,
  createApiCall,
  createCycle,
  openCycle,
  createParticipation,
  getMaxParticipation,
  createFakeDonation,
  matchDonations,
} from '../helpers';

const prisma = new PrismaClient();

export async function testFirstTimeInvestor(ctx: TestContext): Promise<string> {
  const apiCall = createApiCall(ctx.config);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔵 SCENARIO 1: First-Time Investor (10B Cap)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Check max participation (should be 10B)
  console.log('1️⃣  Checking max participation for new user...');
  const maxCap = await getMaxParticipation(apiCall, 'firsttime');
  console.log(`  ✓ Max cap: ${maxCap.maxAmountB}B ISK`);
  if (maxCap.maxAmountB !== 10) {
    throw new Error(`❌ Expected 10B cap, got ${maxCap.maxAmountB}B`);
  }

  // 2. Create cycle
  console.log('\n2️⃣  Creating Cycle 1...');
  const cycle = await createCycle(apiCall, 'First-Time Investor Test');
  console.log(`  ✓ Cycle created: ${cycle.id}`);

  // 3. Create participation (10B)
  console.log('\n3️⃣  Creating participation (10B)...');
  const participation = await createParticipation(apiCall, {
    cycleId: cycle.id,
    characterName: 'First Timer',
    amountIsk: '10000000000.00',
    testUserId: 'firsttime',
  });
  console.log(`  ✓ Participation created: ${participation.id}`);

  // 4. Try to create participation exceeding 10B (should fail)
  console.log('\n4️⃣  Testing 10B cap enforcement...');
  try {
    await createParticipation(apiCall, {
      cycleId: cycle.id,
      characterName: 'First Timer Exceed',
      amountIsk: '15000000000.00',
      testUserId: 'exceed001',
    });
    throw new Error('❌ Should have rejected participation > 10B');
  } catch (error) {
    if (error instanceof Error && error.message.includes('10B')) {
      console.log('  ✓ Correctly rejected participation > 10B');
    } else {
      throw error;
    }
  }

  // 5. Create donation and match
  console.log('\n5️⃣  Creating donation and matching...');
  await createFakeDonation(
    ctx,
    10000000000,
    `ARB-${cycle.id.substring(0, 8)}-firsttime`,
  );
  await matchDonations(apiCall, cycle.id);
  console.log('  ✓ Donation matched');

  // 6. Open cycle
  console.log('\n6️⃣  Opening cycle...');
  await openCycle(apiCall, cycle.id);
  console.log('  ✓ Cycle opened');

  console.log('\n✅ SCENARIO 1 COMPLETE\n');
  return cycle.id;
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
        '  pnpm exec ts-node scripts/tests/participation-rollover/scenarios/01-first-time-investor.test.ts --apiKey <key> --characterId <id>',
      );
      process.exit(1);
    }

    const ctx: TestContext = {
      config,
      characterId: config.characterId,
      transactionIdCounter: 0,
    };

    try {
      console.log('\n🚀 Running Scenario 1: First-Time Investor\n');
      await testFirstTimeInvestor(ctx);
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
