/**
 * Scenario 01: First-Time Investor Baseline
 *
 * Tests the fundamental first-time investor behavior:
 * - New investor is capped at 10B ISK
 * - Attempts above 10B are rejected
 * - Successfully creates participation, matches donation, opens cycle
 *
 * This scenario sets up the baseline state for subsequent scenarios.
 */

import {
  TestConfig,
  SharedRolloverContext,
  createApiCall,
  createCycle,
  openCycle,
  createParticipation,
  getMaxParticipation,
  createFakeDonation,
  matchDonations,
  getParticipations,
  formatIsk,
  logStep,
  logSuccess,
  logWarning,
  printScenarioHeader,
  printScenarioComplete,
  waitForUser,
} from '../helpers/index';

export async function scenario01FirstTimeInvestor(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader('🔵', 'SCENARIO 01: First-Time Investor Baseline');

  const apiCall = createApiCall(config);
  const testContext = {
    characterId: config.characterId,
    transactionIdCounter: ctx.transactionIdCounter,
  };

  // Step 1: Note about first-time investor cap
  logStep('1️⃣', 'First-time investor baseline...');
  logSuccess('Will verify 10B cap during UI opt-in');

  // Step 2: Create Cycle 1
  logStep('2️⃣', 'Creating Cycle 1...');
  const cycle1 = await createCycle(apiCall, 'Rollover Suite - Cycle 1');
  ctx.cycleIds.push(cycle1.id);
  logSuccess(`Cycle 1 created: ${cycle1.id.substring(0, 8)}`);

  // Step 3: Manual opt-in via UI
  logStep('3️⃣', 'Manual opt-in required...');
  console.log('\n📋 ACTION REQUIRED:');
  console.log('   1. Log in to the app as your test user');
  console.log('   2. Navigate to the cycles page');
  console.log('   3. Find Cycle: "Rollover Suite - Cycle 1" (PLANNED status)');
  console.log('   4. Click "Opt In" and enter:');
  console.log('      - Character: (select your character)');
  console.log('      - Amount: 10000000000.00 (10B ISK)');
  console.log('      - Do NOT check "Enable automatic reinvestment"');
  console.log('   5. Verify:');
  console.log('      - Max participation shows 10B');
  console.log('      - If you try 15B, it should be rejected');
  console.log('   6. Submit with 10B\n');

  await waitForUser(
    config,
    'Once opted in, press ENTER to continue verification...',
  );

  // Verify participation was created
  const participations = await getParticipations(apiCall, cycle1.id);

  if (participations.length === 0) {
    throw new Error('❌ No participation found. Did you opt in?');
  }

  // Get the most recent participation (should be yours)
  const participation = participations[participations.length - 1];

  ctx.testUserId = participation.userId; // Store user ID for subsequent scenarios
  ctx.latestParticipationId = participation.id;
  ctx.lastInitialAmount = parseFloat(participation.amountIsk);

  logSuccess(`Participation found: ${participation.id.substring(0, 8)}`);
  logSuccess(`User ID: ${participation.userId}`);
  logSuccess(`Amount: ${(ctx.lastInitialAmount / 1e9).toFixed(2)}B ISK`);
  logSuccess(`Memo: ${participation.memo}`);

  // Step 4: Create and match donation
  logStep('4️⃣', 'Creating donation and matching...');
  await createFakeDonation(
    testContext,
    ctx.lastInitialAmount,
    participation.memo,
  );
  ctx.transactionIdCounter = testContext.transactionIdCounter;
  logSuccess('Fake donation created');

  const matchResult = await matchDonations(apiCall, cycle1.id);
  logSuccess(`Matched ${matchResult.matched} donations`);

  // Verify participation status changed to OPTED_IN
  const participationsAfterMatch = await getParticipations(apiCall, cycle1.id);
  const matched = participationsAfterMatch.find(
    (p: any) => p.id === participation.id,
  );
  if (matched?.status !== 'OPTED_IN') {
    logWarning(`Expected status OPTED_IN, got ${matched?.status}`);
  } else {
    logSuccess('Participation validated to OPTED_IN');
  }

  // Step 5: Open Cycle 1
  logStep('5️⃣', 'Opening Cycle 1...');
  await openCycle(apiCall, cycle1.id);
  ctx.currentOpenCycleId = cycle1.id;
  logSuccess('Cycle 1 opened');
  logSuccess(
    `Capital: ${formatIsk(ctx.lastInitialAmount)} (from participation)`,
  );

  // Interactive pause for UI verification
  await waitForUser(
    config,
    'Verify in UI:\n   - Cycle 1 is now OPEN with ' +
      (ctx.lastInitialAmount / 1e9).toFixed(2) +
      'B capital\n   - Your participation shows as OPTED_IN',
  );

  printScenarioComplete();
}

// Allow standalone execution for debugging
if (require.main === module) {
  const { PrismaClient } = require('@eve/prisma');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const dbUrl =
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  });

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
      interactive: args.includes('--interactive'),
    };

    if ((!config.token && !config.apiKey) || !config.characterId) {
      console.error('❌ Missing required arguments');
      console.log('\nUsage:');
      console.log(
        '  pnpm exec ts-node scripts/tests/participation-rollover/scenarios/01-first-time-investor-baseline.test.ts --apiKey <key> --characterId <id> [--interactive]',
      );
      process.exit(1);
    }

    const { cleanAllTestData, createSharedContext } = await import(
      '../helpers/index.js'
    );

    // Clean test data first
    await cleanAllTestData();

    const ctx = createSharedContext('rollover-test-user');

    try {
      console.log('\n🚀 Running Scenario 01: First-Time Investor Baseline\n');
      await scenario01FirstTimeInvestor(config, ctx);
      console.log('\n✅ Scenario 01 passed!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Scenario 01 failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
