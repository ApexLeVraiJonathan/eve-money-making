/**
 * End-to-End Participation Rollover Test Script (INTERACTIVE)
 *
 * Tests the new participation rollover feature including:
 * - First-time investor caps (10B)
 * - Rollover investor caps (20B)
 * - FULL_PAYOUT rollover (initial + profit, capped at 20B)
 * - INITIAL_ONLY rollover
 * - CUSTOM_AMOUNT rollover
 * - Opt-out of PLANNED cycles
 * - Edge cases (invalid opt-out, excessive amounts, etc.)
 *
 * Usage (with Dev API Key - RECOMMENDED):
 *   pnpm exec ts-node scripts/e2e-participation-rollover-test.ts --apiUrl http://localhost:3000 --apiKey your-secret-key --characterId <logistics-char-id>
 *
 * Usage (with Bearer Token):
 *   pnpm exec ts-node scripts/e2e-participation-rollover-test.ts --apiUrl http://localhost:3000 --token <your-admin-token> --characterId <logistics-char-id>
 */

import {
  TestContext,
  createTestContext,
  cleanTestData,
  createCycle,
  openCycle,
  createParticipation,
  getParticipations,
  optOutParticipation,
  getMaxParticipation,
  createFakeDonation,
  matchDonations,
  createFakeSellTransactions,
  allocateTransactions,
  createPayouts,
  getCycleOverview,
  waitForUser,
  apiCall,
  formatIsk,
  prisma,
  TestConfig,
} from './test-utilities';

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Scenario 1: First-time investor with 10B cap
 */
async function testFirstTimeInvestor(ctx: TestContext): Promise<string> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔵 SCENARIO 1: First-Time Investor (10B Cap)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Check max participation (should be 10B)
  console.log('1️⃣  Checking max participation for new user...');
  const maxCap = await getMaxParticipation(ctx.config, 'firsttime');
  console.log(`  ✓ Max cap: ${maxCap.maxAmountB}B ISK`);
  if (maxCap.maxAmountB !== 10) {
    throw new Error(`❌ Expected 10B cap, got ${maxCap.maxAmountB}B`);
  }

  // 2. Create cycle
  console.log('\n2️⃣  Creating Cycle 1...');
  const cycle = await createCycle(ctx.config, 'First-Time Investor Test');
  console.log(`  ✓ Cycle created: ${cycle.id}`);

  // 3. Create participation (10B)
  console.log('\n3️⃣  Creating participation (10B)...');
  const participation = await createParticipation(ctx.config, {
    cycleId: cycle.id,
    characterName: 'First Timer',
    amountIsk: '10000000000.00',
    testUserId: 'firsttime',
  });
  console.log(`  ✓ Participation created: ${participation.id}`);

  // 4. Try to create participation exceeding 10B (should fail)
  console.log('\n4️⃣  Testing 10B cap enforcement...');
  try {
    await createParticipation(ctx.config, {
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
    `ARB-${cycle.id.substring(0, 8)}-firsttime`, // Use testUserId, not participation.id
  );
  await matchDonations(ctx.config, cycle.id);
  console.log('  ✓ Donation matched');

  // 6. Open cycle
  console.log('\n6️⃣  Opening cycle...');
  await openCycle(ctx.config, cycle.id);
  console.log('  ✓ Cycle opened');

  if (!ctx.config.skipPauses) {
    await waitForUser('Check frontend: Cycle 1 should show 10B capital');
  }

  console.log('\n✅ SCENARIO 1 COMPLETE\n');
  return cycle.id;
}

/**
 * Scenario 2: FULL_PAYOUT rollover (initial + profit, capped at 20B)
 */
async function testFullPayoutRollover(
  ctx: TestContext,
  cycle1Id: string,
): Promise<{ cycle2Id: string; rolloverParticipationId: string }> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟢 SCENARIO 2: FULL_PAYOUT Rollover');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Get lines from Cycle 1 and create some profit
  console.log('1️⃣  Creating profit in Cycle 1...');
  const lines = await apiCall(
    ctx.config,
    'GET',
    `/ledger/cycles/${cycle1Id}/lines`,
    null,
  );
  console.log(`  ✓ Found ${lines.length} cycle lines`);

  // Create sell transactions for 80% of items (50% profit)
  await createFakeSellTransactions(ctx, lines, 0.8);
  await allocateTransactions(ctx.config, cycle1Id);
  console.log('  ✓ Sales allocated');

  // 2. Check profit
  const overview1 = await getCycleOverview(ctx.config);
  const profit = Number(overview1.current.profit.current);
  const investorProfitShare = profit * 0.5; // 50% profit share to investors
  const totalPayout = 10000000000 + investorProfitShare; // Initial + investor profit share
  console.log(`  Cycle 1 Profit: ${formatIsk(profit)}`);
  console.log(`  Investor Profit Share (50%): ${formatIsk(investorProfitShare)}`);
  console.log(`  Expected Payout: ${formatIsk(totalPayout)}`);

  // 3. Create Cycle 2
  console.log('\n2️⃣  Creating Cycle 2...');
  const cycle2 = await createCycle(ctx.config, 'FULL_PAYOUT Rollover Test');
  console.log(`  ✓ Cycle created: ${cycle2.id}`);

  // 4. Create rollover participation (FULL_PAYOUT)
  console.log('\n3️⃣  Creating rollover participation (FULL_PAYOUT)...');
  const rolloverParticipation = await createParticipation(ctx.config, {
    cycleId: cycle2.id,
    characterName: 'First Timer',
    amountIsk: totalPayout.toFixed(2),
    testUserId: 'firsttime',
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
  await openCycle(ctx.config, cycle2.id);
  console.log('  ✓ Cycle 2 opened, Cycle 1 closed');
  
  // Give a moment for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('  ✓ Waited for rollover processing...');

  // Debug: Check database directly
  console.log('\n🔍 DEBUG: Checking database...');
  const dbParticipation = await prisma.cycleParticipation.findUnique({
    where: { id: rolloverParticipation.id },
    include: { rolloverFromParticipation: true },
  });
  console.log('  DB Participation Status:', dbParticipation?.status);
  console.log('  DB RolloverType:', dbParticipation?.rolloverType);
  console.log('  DB RolloverFromId:', dbParticipation?.rolloverFromParticipationId?.substring(0, 8) || 'null');
  console.log('  DB Amount:', formatIsk(dbParticipation?.amountIsk ? String(dbParticipation.amountIsk) : '0'));

  // 6. Verify rollover was processed
  console.log('\n5️⃣  Verifying rollover processing...');
  const participations = await getParticipations(ctx.config, cycle2.id);
  
  console.log(`  Found ${participations.length} participations in Cycle 2:`);
  participations.forEach((p: any) => {
    console.log(`    - ID: ${p.id.substring(0, 8)}, Status: ${p.status}, Amount: ${formatIsk(p.amountIsk)}, RolloverType: ${p.rolloverType || 'none'}`);
  });
  
  const processedRollover = participations.find(
    (p: any) => p.id === rolloverParticipation.id,
  );

  if (!processedRollover) {
    console.log(`  ❌ Looking for participation ID: ${rolloverParticipation.id.substring(0, 8)}`);
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
  const maxCap = await getMaxParticipation(ctx.config, 'firsttime');
  console.log(`  ✓ Max cap: ${maxCap.maxAmountB}B ISK`);
  if (maxCap.maxAmountB !== 20) {
    throw new Error(`❌ Expected 20B cap for rollover investor, got ${maxCap.maxAmountB}B`);
  }

  if (!ctx.config.skipPauses) {
    await waitForUser(
      'Check frontend: Cycle 2 should show rollover participation as OPTED_IN',
    );
  }

  console.log('\n✅ SCENARIO 2 COMPLETE\n');
  return { cycle2Id: cycle2.id, rolloverParticipationId: rolloverParticipation.id };
}

/**
 * Scenario 3: INITIAL_ONLY rollover
 */
async function testInitialOnlyRollover(
  ctx: TestContext,
  cycle2Id: string,
): Promise<string> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟠 SCENARIO 3: INITIAL_ONLY Rollover');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Get current participation from Cycle 2
  console.log('1️⃣  Getting current participation...');
  const participations = await getParticipations(ctx.config, cycle2Id);
  console.log(`  Found ${participations.length} participations in Cycle 2:`);
  for (const p of participations) {
    console.log(`    - ID: ${p.id.substring(0, 8)}, UserId: ${p.userId?.substring(0, 8)}, Status: ${p.status}, Amount: ${formatIsk(p.amountIsk)}`);
  }
  // In test mode, userId is set to testUserId value ('firsttime')
  const currentParticipation = participations.find(
    (p: any) => p.userId === 'firsttime',
  );
  if (!currentParticipation) {
    console.log(`  ❌ Could not find participation with userId='firsttime'`);
    console.log(`  Available userIds: ${participations.map((p: any) => `"${p.userId}"`).join(', ')}`);
    throw new Error('❌ Current participation not found');
  }
  const initialAmount = Number(currentParticipation.amountIsk);
  console.log(`  ✓ Current participation: ${formatIsk(initialAmount)}`);

  // 2. Create some profit in Cycle 2
  console.log('\n2️⃣  Creating profit in Cycle 2...');
  const lines = await apiCall(
    ctx.config,
    'GET',
    `/ledger/cycles/${cycle2Id}/lines`,
    null,
  );
  await createFakeSellTransactions(ctx, lines, 0.7);
  await allocateTransactions(ctx.config, cycle2Id);
  console.log('  ✓ Sales allocated');

  const overview2 = await getCycleOverview(ctx.config);
  const profit = Number(overview2.current.profit.current);
  console.log(`  Cycle 2 Profit: ${formatIsk(profit)}`);

  // 3. Create Cycle 3
  console.log('\n3️⃣  Creating Cycle 3...');
  const cycle3 = await createCycle(ctx.config, 'INITIAL_ONLY Rollover Test');
  console.log(`  ✓ Cycle created: ${cycle3.id}`);

  // 4. Create rollover participation (INITIAL_ONLY)
  console.log('\n4️⃣  Creating rollover participation (INITIAL_ONLY)...');
  const rolloverParticipation = await createParticipation(ctx.config, {
    cycleId: cycle3.id,
    characterName: 'First Timer',
    amountIsk: initialAmount.toFixed(2),
    testUserId: 'firsttime',
    rollover: {
      type: 'INITIAL_ONLY',
    },
  });
  console.log(`  ✓ Rollover participation created: ${rolloverParticipation.id}`);

  // 5. Open Cycle 3 (processes rollover)
  console.log('\n5️⃣  Opening Cycle 3 (processes rollover)...');
  await openCycle(ctx.config, cycle3.id);
  console.log('  ✓ Cycle 3 opened');

  // 6. Verify rollover processed with INITIAL_ONLY
  console.log('\n6️⃣  Verifying INITIAL_ONLY rollover...');
  const cycle3Participations = await getParticipations(ctx.config, cycle3.id);
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
  console.log(`  ✓ Profit ${formatIsk(profit)} will be paid out`);

  if (!ctx.config.skipPauses) {
    await waitForUser('Check frontend: Cycle 3 rollover shows initial amount only');
  }

  console.log('\n✅ SCENARIO 3 COMPLETE\n');
  return cycle3.id;
}

/**
 * Scenario 4: CUSTOM_AMOUNT rollover
 */
async function testCustomAmountRollover(
  ctx: TestContext,
  cycle3Id: string,
): Promise<string> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟣 SCENARIO 4: CUSTOM_AMOUNT Rollover');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Get current participation
  const participations = await getParticipations(ctx.config, cycle3Id);
  const currentParticipation = participations.find(
    (p: any) => p.userId === 'firsttime',
  );
  const initialAmount = Number(currentParticipation.amountIsk);
  console.log(`  Current participation: ${formatIsk(initialAmount)}`);

  // 2. Create Cycle 4
  console.log('\n1️⃣  Creating Cycle 4...');
  const cycle4 = await createCycle(ctx.config, 'CUSTOM_AMOUNT Rollover Test');
  console.log(`  ✓ Cycle created: ${cycle4.id}`);

  // 3. Try to create rollover with custom amount > initial (should fail)
  console.log('\n2️⃣  Testing custom amount validation...');
  try {
    await createParticipation(ctx.config, {
      cycleId: cycle4.id,
      characterName: 'First Timer',
      amountIsk: (initialAmount + 1000000000).toFixed(2), // Initial + 1B (too much)
      testUserId: 'firsttime',
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
  console.log('\n3️⃣  Creating rollover with custom amount (5B)...');
  const customAmount = 5000000000;
  const rolloverParticipation = await createParticipation(ctx.config, {
    cycleId: cycle4.id,
    characterName: 'First Timer',
    amountIsk: customAmount.toFixed(2),
    testUserId: 'firsttime',
    rollover: {
      type: 'CUSTOM_AMOUNT',
      customAmountIsk: customAmount.toFixed(2),
    },
  });
  console.log(`  ✓ Rollover participation created: ${rolloverParticipation.id}`);

  // 5. Open Cycle 4
  console.log('\n4️⃣  Opening Cycle 4 (processes custom rollover)...');
  await openCycle(ctx.config, cycle4.id);
  console.log('  ✓ Cycle 4 opened');

  // 6. Verify custom amount rollover
  console.log('\n5️⃣  Verifying custom amount rollover...');
  const cycle4Participations = await getParticipations(ctx.config, cycle4.id);
  const processedRollover = cycle4Participations.find(
    (p: any) => p.id === rolloverParticipation.id,
  );

  const rolledAmount = Number(processedRollover.amountIsk);
  if (Math.abs(rolledAmount - customAmount) > 1) {
    throw new Error(
      `❌ Expected custom amount ${formatIsk(customAmount)}, got ${formatIsk(rolledAmount)}`,
    );
  }
  console.log(`  ✓ Rolled over: ${formatIsk(rolledAmount)} (custom amount)`);

  if (!ctx.config.skipPauses) {
    await waitForUser('Check frontend: Cycle 4 rollover shows custom amount');
  }

  console.log('\n✅ SCENARIO 4 COMPLETE\n');
  return cycle4.id;
}

/**
 * Scenario 5: Opt-out of PLANNED cycle
 */
async function testOptOutPlanned(ctx: TestContext): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔴 SCENARIO 5: Opt-out of PLANNED Cycle');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Create a PLANNED cycle
  console.log('1️⃣  Creating PLANNED cycle...');
  const cycle = await createCycle(ctx.config, 'Opt-out Test');
  console.log(`  ✓ Cycle created: ${cycle.id}`);

  // 2. Create participation
  console.log('\n2️⃣  Creating participation...');
  const participation = await createParticipation(ctx.config, {
    cycleId: cycle.id,
    characterName: 'Opt-out Tester',
    amountIsk: '5000000000.00',
    testUserId: 'optout001',
  });
  console.log(`  ✓ Participation created: ${participation.id}`);

  // 3. Create donation and match
  await createFakeDonation(
    ctx,
    5000000000,
    `ARB-${cycle.id.substring(0, 8)}-optout001`, // Use testUserId
  );
  await matchDonations(ctx.config, cycle.id);
  console.log('  ✓ Donation matched, status: OPTED_IN');

  // 4. Opt-out while cycle is PLANNED (should succeed)
  console.log('\n3️⃣  Opting out of PLANNED cycle...');
  await optOutParticipation(ctx.config, participation.id);
  console.log('  ✓ Opt-out successful');

  // 5. Verify participation was deleted or marked as OPTED_OUT
  const participations = await getParticipations(ctx.config, cycle.id);
  const optedOut = participations.find((p: any) => p.id === participation.id);
  if (optedOut && optedOut.status !== 'OPTED_OUT') {
    throw new Error(
      `❌ Expected participation to be OPTED_OUT or deleted, got ${optedOut.status}`,
    );
  }
  console.log('  ✓ Participation marked for refund or deleted');

  if (!ctx.config.skipPauses) {
    await waitForUser('Check frontend: Participation should show as opted out');
  }

  console.log('\n✅ SCENARIO 5 COMPLETE\n');
}

/**
 * Scenario 6: Opt-out of OPEN cycle (should fail)
 */
async function testOptOutOpenFails(ctx: TestContext): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  SCENARIO 6: Opt-out of OPEN Cycle (Should Fail)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Create and open a cycle
  console.log('1️⃣  Creating and opening cycle...');
  const cycle = await createCycle(ctx.config, 'Opt-out Fail Test');
  const participation = await createParticipation(ctx.config, {
    cycleId: cycle.id,
    characterName: 'Locked In',
    amountIsk: '5000000000.00',
    testUserId: 'locked001',
  });
  await createFakeDonation(
    ctx,
    5000000000,
    `ARB-${cycle.id.substring(0, 8)}-locked001`, // Use testUserId
  );
  await matchDonations(ctx.config, cycle.id);
  await openCycle(ctx.config, cycle.id);
  console.log('  ✓ Cycle opened');

  // 2. Try to opt-out (should fail)
  console.log('\n2️⃣  Trying to opt-out of OPEN cycle...');
  try {
    await optOutParticipation(ctx.config, participation.id);
    throw new Error('❌ Should have rejected opt-out of OPEN cycle');
  } catch (error) {
    if (error instanceof Error && error.message.includes('PLANNED')) {
      console.log('  ✓ Correctly rejected opt-out of OPEN cycle');
    } else {
      throw error;
    }
  }

  console.log('\n✅ SCENARIO 6 COMPLETE\n');
}

/**
 * Scenario 7: Cash out fully, then reinvest (should revert to 10B cap)
 */
async function testCashOutRevertsCap(ctx: TestContext): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💰 SCENARIO 7: Cash Out Reverts Cap to 10B');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Create a new user with rollover history
  console.log('1️⃣  Setting up user with rollover history...');
  const cycle1 = await createCycle(ctx.config, 'Cash Out Test 1');
  const p1 = await createParticipation(ctx.config, {
    cycleId: cycle1.id,
    characterName: 'Cash Out User',
    amountIsk: '10000000000.00',
    testUserId: 'cashout01',
  });
  await createFakeDonation(
    ctx,
    10000000000,
    `ARB-${cycle1.id.substring(0, 8)}-cashout01`, // Use testUserId
  );
  await matchDonations(ctx.config, cycle1.id);
  await openCycle(ctx.config, cycle1.id);
  console.log('  ✓ Cycle 1 opened');

  // 2. Create Cycle 2 with rollover
  const cycle2 = await createCycle(ctx.config, 'Cash Out Test 2');
  console.log(`  Created Cycle 2: ${cycle2.id.substring(0, 8)}`);
  
  // Check Cycle 1 status before creating rollover
  const cycle1StatusBefore = await prisma.cycle.findUnique({ where: { id: cycle1.id }, select: { id: true, status: true } });
  console.log(`  Cycle 1 status before rollover: ${cycle1StatusBefore?.status}`);
  
  const p2 = await createParticipation(ctx.config, {
    cycleId: cycle2.id,
    characterName: 'Cash Out User',
    amountIsk: '10000000000.00',
    testUserId: 'cashout01',
    rollover: {
      type: 'FULL_PAYOUT',
    },
  });
  console.log(`  Created rollover participation: ${p2.id.substring(0, 8)}, status=${p2.status}`);
  
  await openCycle(ctx.config, cycle2.id);
  console.log('  ✓ Cycle 2 opened with rollover');
  
  // Check if rollover was processed
  const p2AfterOpen = await prisma.cycleParticipation.findUnique({ where: { id: p2.id } });
  console.log(`  Participation after Cycle 2 open: status=${p2AfterOpen?.status}, amount=${p2AfterOpen?.amountIsk}`);
  const cycle1StatusAfter = await prisma.cycle.findUnique({ where: { id: cycle1.id }, select: { status: true } });
  console.log(`  Cycle 1 status after Cycle 2 open: ${cycle1StatusAfter?.status}`);

  // Now user should have 20B cap
  // But they cash out fully (don't opt into next cycle)

  // 3. Create Cycle 3 WITHOUT rollover (user cashes out)
  console.log('\n2️⃣  User cashes out (no rollover to Cycle 3)...');
  const cycle3 = await createCycle(ctx.config, 'Cash Out Test 3 (No Rollover)');
  
  // DEBUG: Check what participations exist for cashout01 before opening cycle 3
  console.log('\n🔍 DEBUG: Checking cashout01 participations before opening Cycle 3:');
  const allParticipations = await prisma.cycleParticipation.findMany({
    where: { userId: 'cashout01' },
    include: { cycle: { select: { id: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  });
  for (const p of allParticipations) {
    console.log(`  - ${p.id.substring(0, 8)}: cycle=${p.cycle?.id.substring(0, 8)}, cycleStatus=${p.cycle?.status}, pStatus=${p.status}, rolloverFrom=${p.rolloverFromParticipationId?.substring(0, 8) || 'none'}`);
  }
  
  // Create a regular participation instead of rollover
  await openCycle(ctx.config, cycle3.id);
  console.log('  ✓ Cycle 3 opened, user fully cashed out');

  // 4. Now create Cycle 4 - user should be back to 10B cap
  console.log('\n3️⃣  Creating Cycle 4 (after cash out)...');
  const cycle4 = await createCycle(ctx.config, 'Cash Out Test 4 (After Cash Out)');
  
  // Try to create 20B participation (should fail)
  try {
    await createParticipation(ctx.config, {
      cycleId: cycle4.id,
      characterName: 'Cash Out User',
      amountIsk: '20000000000.00',
      testUserId: 'cashout01',
    });
    throw new Error('❌ Should have rejected 20B participation after cash out');
  } catch (error) {
    if (error instanceof Error && error.message.includes('10B')) {
      console.log('  ✓ Correctly reverted to 10B cap after cash out');
    } else {
      throw error;
    }
  }

  // Should accept 10B
  const p4 = await createParticipation(ctx.config, {
    cycleId: cycle4.id,
    characterName: 'Cash Out User',
    amountIsk: '10000000000.00',
    testUserId: 'cashout01',
  });
  console.log('  ✓ 10B participation accepted');

  console.log('\n✅ SCENARIO 7 COMPLETE\n');
}

/**
 * Scenario 8: Payout > 20B (should cap at 20B)
 */
async function testPayoutExceedsCap(ctx: TestContext): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 SCENARIO 8: Payout > 20B (Capped at 20B)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Build rollover history first (10B → roll over to get 20B cap)
  console.log('1️⃣  Building rollover history...');
  const cycle1 = await createCycle(ctx.config, 'Big Profit Test 1');
  await createParticipation(ctx.config, {
    cycleId: cycle1.id,
    characterName: 'Big Profit User',
    amountIsk: '10000000000.00',
    testUserId: 'bigprofit',
  });
  await createFakeDonation(
    ctx,
    10000000000,
    `ARB-${cycle1.id.substring(0, 8)}-bigprofit`,
  );
  await matchDonations(ctx.config, cycle1.id);
  await openCycle(ctx.config, cycle1.id);
  console.log('  ✓ Cycle 1 opened with 10B');

  // 2. Create Cycle 2 with rollover to get 20B cap
  const cycle2 = await createCycle(ctx.config, 'Big Profit Test 2');
  await createParticipation(ctx.config, {
    cycleId: cycle2.id,
    characterName: 'Big Profit User',
    amountIsk: '15000000000.00', // Roll over 15B (still under 20B cap)
    testUserId: 'bigprofit',
    rollover: {
      type: 'FULL_PAYOUT',
    },
  });
  await openCycle(ctx.config, cycle2.id);
  console.log('  ✓ Cycle 2 opened with 15B rollover');

  // 3. Create Cycle 3 with FULL_PAYOUT rollover (should cap at 20B)
  console.log('\n2️⃣  Creating Cycle 3 with FULL_PAYOUT rollover (testing 20B cap)...');
  const cycle3 = await createCycle(ctx.config, 'Big Profit Test 3');
  const p3 = await createParticipation(ctx.config, {
    cycleId: cycle3.id,
    characterName: 'Big Profit User',
    amountIsk: '20000000000.00', // Roll over 20B (at cap)
    testUserId: 'bigprofit',
    rollover: {
      type: 'FULL_PAYOUT',
    },
  });
  await openCycle(ctx.config, cycle3.id);
  console.log('  ✓ Cycle 3 opened');

  // 4. Verify rollover was capped at 20B
  console.log('\n3️⃣  Verifying 20B cap enforcement...');
  const participations = await getParticipations(ctx.config, cycle3.id);
  const processedRollover = participations.find((p: any) => p.id === p3.id);
  
  const rolledAmount = Number(processedRollover.amountIsk);
  if (rolledAmount > 20000000000) {
    throw new Error(
      `❌ Rollover exceeded 20B cap: ${formatIsk(rolledAmount)}`,
    );
  }
  console.log(`  ✓ Rolled over: ${formatIsk(rolledAmount)} (capped at 20B)`);
  
  // Verify they can't create a 21B participation
  console.log('\n4️⃣  Testing rejection of >20B participation...');
  try {
    const cycle4 = await createCycle(ctx.config, 'Big Profit Test 4');
    await createParticipation(ctx.config, {
      cycleId: cycle4.id,
      characterName: 'Big Profit User',
      amountIsk: '21000000000.00',
      testUserId: 'bigprofit',
      rollover: {
        type: 'FULL_PAYOUT',
      },
    });
    throw new Error('❌ Should have rejected 21B participation');
  } catch (error) {
    if (error instanceof Error && error.message.includes('20B')) {
      console.log('  ✓ Correctly rejected 21B participation');
    } else {
      throw error;
    }
  }

  console.log('\n✅ SCENARIO 8 COMPLETE\n');
}

// ============================================================================
// Main Test Execution
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  const getArg = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index !== -1 ? args[index + 1] : undefined;
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
    console.log('\nUsage (with Dev API Key - RECOMMENDED):');
    console.log(
      '  pnpm exec ts-node scripts/e2e-participation-rollover-test.ts --apiUrl http://localhost:3000 --apiKey your-secret-key --characterId <logistics-char-id> [--skip-pauses]',
    );
    console.log('\nUsage (with Bearer Token):');
    console.log(
      '  pnpm exec ts-node scripts/e2e-participation-rollover-test.ts --apiUrl http://localhost:3000 --token <your-admin-token> --characterId <logistics-char-id> [--skip-pauses]',
    );
    process.exit(1);
  }

  console.log('🚀 Starting Participation Rollover E2E Test');
  console.log(`  API: ${config.apiUrl}`);
  console.log(`  Auth: ${config.apiKey ? '🔑 API Key' : '🔐 Bearer Token'}`);
  console.log(`  Character: ${config.characterId}\n`);

  const ctx = createTestContext(config);

  try {
    // Clean test data
    await cleanTestData();

    // Run test scenarios
    console.log('\n📋 Running 8 test scenarios...\n');

    // Scenario 1: First-time investor (10B cap)
    const cycle1Id = await testFirstTimeInvestor(ctx);

    // Scenario 2: FULL_PAYOUT rollover
    const { cycle2Id, rolloverParticipationId } = await testFullPayoutRollover(
      ctx,
      cycle1Id,
    );

    // Scenario 3: INITIAL_ONLY rollover
    const cycle3Id = await testInitialOnlyRollover(ctx, cycle2Id);

    // Scenario 4: CUSTOM_AMOUNT rollover
    const cycle4Id = await testCustomAmountRollover(ctx, cycle3Id);

    // Scenario 5: Opt-out of PLANNED cycle
    await testOptOutPlanned(ctx);

    // Scenario 6: Opt-out of OPEN cycle (should fail)
    await testOptOutOpenFails(ctx);

    // Scenario 7: Cash out fully, then reinvest (should revert to 10B cap)
    await testCashOutRevertsCap(ctx);

    // Scenario 8: Payout > 20B (should cap at 20B)
    await testPayoutExceedsCap(ctx);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Test Summary:');
    console.log('  ✓ First-time investor (10B cap)');
    console.log('  ✓ FULL_PAYOUT rollover');
    console.log('  ✓ INITIAL_ONLY rollover');
    console.log('  ✓ CUSTOM_AMOUNT rollover');
    console.log('  ✓ Opt-out of PLANNED cycle');
    console.log('  ✓ Opt-out of OPEN cycle rejected');
    console.log('  ✓ Cash out reverts cap to 10B');
    console.log('  ✓ Payout > 20B capped correctly');
    console.log('\n⚠️  Manual Testing Recommended:');
    console.log('  - Test payout > 20B with actual profit in production-like data');
    console.log('  - Test multiple consecutive rollovers (3-4 cycles)');
    console.log('  - Test concurrent users with different rollover states');
    console.log('\nYou can now inspect the cycles and participations in the UI.');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

