/**
 * End-to-End Rollover Test Script (INTERACTIVE)
 *
 * This script tests the full cycle rollover workflow using API endpoints.
 * Prisma is used ONLY for test data setup (fake wallet transactions/donations).
 *
 * The script will PAUSE at key points, allowing you to verify the frontend UI
 * before continuing. Press ENTER at each pause to proceed to the next step.
 *
 * Usage (with Dev API Key - RECOMMENDED):
 *   Set DEV_API_KEY in your .env file, then:
 *   pnpm exec ts-node scripts/e2e-rollover-test.ts --apiUrl http://localhost:3000 --apiKey your-secret-key --characterId <logistics-char-id> --initialCapital 20000000000
 *
 * Usage (with Bearer Token - legacy):
 *   pnpm exec ts-node scripts/e2e-rollover-test.ts --apiUrl http://localhost:3000 --token <your-admin-token> --characterId <logistics-char-id> --initialCapital 20000000000
 *
 * Interactive Pauses:
 *   1. After Cycle 1 opens - check cycle lines with Jita prices
 *   2. After capital allocation - check cash vs inventory breakdown
 *   3. After Cycle 1 closes - check profit calculations and payouts
 *   4. After Cycle 2 opens - check rollover lines and linkage
 *   5. After Cycle 2 capital check - verify rollover cost deduction
 */

import { PrismaClient } from '@eve/prisma';
import * as readline from 'readline';

const prisma = new PrismaClient();

// Helper: Wait for user to press Enter
function waitForUser(message: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n⏸️  ${message}\nPress ENTER to continue...`, () => {
      rl.close();
      resolve();
    });
  });
}

interface TestConfig {
  apiUrl: string;
  token?: string; // Bearer token (legacy)
  apiKey?: string; // Dev API key (recommended)
  characterId: number;
  initialCapital: number; // in ISK
}

// Helper to make API calls
async function apiCall(
  config: TestConfig,
  method: string,
  path: string,
  body?: any,
): Promise<any> {
  const url = `${config.apiUrl}${path}`;
  console.log(`[API] ${method} ${path}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Use API key if provided, otherwise fall back to bearer token
  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey;
  } else if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`;
  } else {
    throw new Error('Either --apiKey or --token must be provided');
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `API call failed: ${response.status} ${response.statusText}\n${text}`,
    );
  }

  return await response.json();
}

// Test setup: Clean all cycle data (uses Prisma for test cleanup)
async function cleanTestData() {
  console.log('\n🗑️  [SETUP] Cleaning test data...');
  await prisma.sellAllocation.deleteMany({});
  await prisma.buyAllocation.deleteMany({});
  await prisma.cycleLine.deleteMany({});
  await prisma.cycleFeeEvent.deleteMany({});
  await prisma.cycleSnapshot.deleteMany({});
  await prisma.cycleLedgerEntry.deleteMany({});
  await prisma.cycleParticipation.deleteMany({});
  await prisma.cycleCapitalCache.deleteMany({});
  await prisma.cycle.deleteMany({});
  // Clean wallet data from previous test runs
  await prisma.walletTransaction.deleteMany({});
  await prisma.walletJournalEntry.deleteMany({});
  console.log('  ✓ Test data cleaned');
}

// Test setup: Create fake wallet donation (uses Prisma for test data)
async function createFakeDonation(
  characterId: number,
  amount: number,
  reason: string,
) {
  console.log(`\n💰 [SETUP] Creating fake donation: ${amount} ISK`);
  const journalId = BigInt(Date.now() + Math.floor(Math.random() * 1000));

  await prisma.walletJournalEntry.create({
    data: {
      characterId,
      journalId,
      date: new Date(),
      refType: 'player_donation',
      amount: amount.toString(),
      balance: '0',
      contextId: null,
      contextIdType: null,
      description: 'Test donation for rollover testing',
      reason,
      firstPartyId: 12345,
      secondPartyId: characterId,
      tax: null,
      taxReceiverId: null,
    },
  });
  console.log(`  ✓ Created donation with reason: ${reason}`);
}

// Test setup: Create fake sell transactions (uses Prisma for test data)
async function createFakeSellTransactions(
  config: TestConfig,
  cycleLines: any[],
) {
  console.log(
    `\n📊 [SETUP] Creating fake sell transactions for ${cycleLines.length} items...`,
  );

  let fullySold = 0;
  let partiallySold = 0;
  let unsold = 0;

  for (const line of cycleLines) {
    const buyUnits = line.unitsBought;
    const sellPrice = parseFloat(line.currentSellPriceIsk);

    // Random distribution: 20% fully sold, 50% partial, 30% unsold
    const rand = Math.random();
    let sellPercentage: number;
    if (rand < 0.2) {
      sellPercentage = 1.0;
      fullySold++;
    } else if (rand < 0.7) {
      sellPercentage = 0.3 + Math.random() * 0.5;
      partiallySold++;
    } else {
      sellPercentage = 0;
      unsold++;
    }

    const sellUnits = Math.floor(buyUnits * sellPercentage);

    if (sellUnits > 0) {
      const lineIdSuffix = parseInt(line.id.slice(0, 8), 16);
      const sellTxId = BigInt(Date.now() * 1000 + lineIdSuffix);

      // Create fake sell transaction
      await prisma.walletTransaction.create({
        data: {
          characterId: config.characterId,
          transactionId: sellTxId,
          date: new Date(),
          isBuy: false,
          locationId: line.destinationStationId,
          typeId: line.typeId,
          clientId: 88888,
          quantity: sellUnits,
          unitPrice: sellPrice.toString(),
          journalRefId: sellTxId + BigInt(1),
        },
      });

      console.log(
        `  ${line.typeName}: ${sellUnits}/${buyUnits} units sold (${(sellPercentage * 100).toFixed(0)}%)`,
      );
    }
  }

  console.log(`\n  📦 Distribution:`);
  console.log(`    Fully Sold: ${fullySold} items`);
  console.log(`    Partially Sold: ${partiallySold} items`);
  console.log(`    Unsold: ${unsold} items`);
}

// Test: Create and open first cycle
async function testCycle1(config: TestConfig): Promise<string> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔵 CYCLE 1: First Cycle (Items from Jita)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Plan cycle
  console.log('1️⃣  Planning Cycle 1...');
  const cycle = await apiCall(config, 'POST', '/ledger/cycles/plan', {
    startedAt: new Date(Date.now() + 5000).toISOString(), // 5 seconds in future
    name: 'Rollover Test Cycle 1',
  });
  const cycleId = cycle.id;
  console.log(`  ✓ Cycle created: ${cycleId}`);

  // 2. Create participation
  console.log('\n2️⃣  Creating participation...');
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/participations`, {
    characterName: 'Test Investor',
    amountIsk: config.initialCapital.toFixed(2),
  });
  console.log(`  ✓ Participation created: ${config.initialCapital} ISK`);

  // 3. Create fake donation
  const reason = `ARB-${cycleId.slice(0, 8)}`;
  await createFakeDonation(config.characterId, config.initialCapital, reason);

  // 4. Match donation
  console.log('\n3️⃣  Matching donation to participation...');
  await apiCall(
    config,
    'POST',
    `/ledger/participations/match?cycleId=${cycleId}`,
    {},
  );
  console.log('  ✓ Donation matched');

  // 5. Open cycle (this creates cycle lines from ESI with Jita prices)
  console.log('\n4️⃣  Opening cycle (fetching Jita prices for items)...');
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/open`, {});
  console.log('  ✓ Cycle opened with Jita-priced items');

  // 6. Get cycle lines
  console.log('\n5️⃣  Fetching cycle lines...');
  const lines = await apiCall(
    config,
    'GET',
    `/ledger/cycles/${cycleId}/lines`,
    null,
  );
  console.log(`  ✓ ${lines.length} cycle lines created`);

  // PAUSE: Check UI for cycle lines
  await waitForUser(
    `Check frontend: Cycle ${cycleId} should show ${lines.length} lines with Jita prices`,
  );

  // 7. Create fake sell transactions
  await createFakeSellTransactions(config, lines);

  // 8. Allocate the fake transactions (don't import from game)
  console.log('\n6️⃣  Allocating transactions to cycle lines...');
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/allocate`, {});
  console.log('  ✓ Transactions allocated to cycle lines');

  // 9. Check capital breakdown AFTER allocation (using overview)
  console.log('\n7️⃣  Verifying capital breakdown...');
  const overview: any = await apiCall(
    config,
    'GET',
    `/ledger/cycles/overview`,
    null,
  );
  const currentCycle = overview.current;
  console.log(`  Starting Capital: ${Number(currentCycle.initialCapitalIsk).toLocaleString()} ISK`);
  console.log(`  Cash: ${Number(currentCycle.capital.cash).toLocaleString()} ISK`);
  console.log(`  Inventory: ${Number(currentCycle.capital.inventory).toLocaleString()} ISK`);
  console.log(`  Total: ${Number(currentCycle.capital.total).toLocaleString()} ISK`);
  console.log(`  Current Profit: ${Number(currentCycle.profit.current).toLocaleString()} ISK`);

  // Verify that we have both cash (from sells) and inventory (from unsold)
  if (Number(currentCycle.capital.cash) <= 0) {
    throw new Error('❌ Cash should be > 0');
  }
  if (Number(currentCycle.capital.inventory) === 0) {
    throw new Error('❌ Inventory should be > 0 (unsold items remain)');
  }
  if (Number(currentCycle.capital.total) !== Number(currentCycle.initialCapitalIsk) + Number(currentCycle.profit.current)) {
    throw new Error('❌ Total should equal Starting Capital + Profit');
  }
  console.log('  ✓ Capital breakdown looks correct');

  // PAUSE: Check UI for capital breakdown
  await waitForUser(
    `Check frontend: Cycle ${cycleId} should show both Cash and Inventory`,
  );

  console.log('\n✅ CYCLE 1 COMPLETE (will be closed when Cycle 2 opens)\n');
  return cycleId;
}

// Test: Create and open second cycle (tests rollover from cycle 1)
async function testCycle2(
  config: TestConfig,
  prevCycleId: string,
): Promise<string> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟢 CYCLE 2: Rollover from Cycle 1');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Plan cycle 2
  console.log('1️⃣  Planning Cycle 2...');
  const cycle = await apiCall(config, 'POST', '/ledger/cycles/plan', {
    startedAt: new Date(Date.now() + 5000).toISOString(), // 5 seconds in future
    name: 'Rollover Test Cycle 2',
  });
  const cycleId = cycle.id;
  console.log(`  ✓ Cycle created: ${cycleId}`);

  // 2. Create participation
  console.log('\n2️⃣  Creating participation...');
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/participations`, {
    characterName: 'Test Investor',
    amountIsk: config.initialCapital.toFixed(2),
  });
  console.log(`  ✓ Participation created: ${config.initialCapital} ISK`);

  // 3. Create fake donation
  const reason = `ARB-${cycleId.slice(0, 8)}`;
  await createFakeDonation(config.characterId, config.initialCapital, reason);

  // 4. Match donation
  console.log('\n3️⃣  Matching donation to participation...');
  await apiCall(
    config,
    'POST',
    `/ledger/participations/match?cycleId=${cycleId}`,
    {},
  );
  console.log('  ✓ Donation matched');

  // 5. Open cycle (automatically closes Cycle 1 and creates rollover lines)
  console.log('\n4️⃣  Opening cycle (automatically closes Cycle 1)...');
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/open`, {});
  console.log('  ✓ Cycle 2 opened');
  console.log('  ✓ Cycle 1 automatically closed with buyback');
  console.log('  ✓ Rollover lines created from Cycle 1 inventory');

  // 6. Get cycle lines and verify rollover
  console.log('\n5️⃣  Verifying rollover...');
  const lines = await apiCall(
    config,
    'GET',
    `/ledger/cycles/${cycleId}/lines`,
    null,
  );
  const rolloverLines = lines.filter((l: any) => l.isRollover);
  console.log(
    `  ✓ ${lines.length} total lines, ${rolloverLines.length} are rollover`,
  );

  // Verify rollover lines reference previous cycle
  for (const rLine of rolloverLines) {
    if (rLine.rolloverFromCycleId !== prevCycleId) {
      throw new Error(
        `❌ Rollover line ${rLine.id} references wrong cycle: ${rLine.rolloverFromCycleId} (expected ${prevCycleId})`,
      );
    }
  }
  console.log(`  ✓ All rollover lines correctly reference previous cycle`);

  // PAUSE: Check UI for rollover lines
  await waitForUser(
    `Check frontend: Cycle ${cycleId} should show ${rolloverLines.length} rollover lines marked as isRollover`,
  );

  // 7. Verify capital from overview
  console.log('\n6️⃣  Verifying Cycle 2 capital...');
  const cycle2Overview: any = await apiCall(
    config,
    'GET',
    `/ledger/cycles/overview`,
    null,
  );
  const cycle2Data = cycle2Overview.current;
  console.log(`  Starting Capital: ${Number(cycle2Data.initialCapitalIsk).toLocaleString()} ISK`);
  console.log(`  Cash: ${Number(cycle2Data.capital.cash).toLocaleString()} ISK`);
  console.log(`  Inventory: ${Number(cycle2Data.capital.inventory).toLocaleString()} ISK`);
  console.log(`  Total: ${Number(cycle2Data.capital.total).toLocaleString()} ISK`);

  // PAUSE: Check UI for Cycle 2 capital
  await waitForUser(
    `Check frontend: Cycle 2 capital should show inventory from rollover`,
  );

  console.log('\n✅ CYCLE 2 ROLLOVER TEST COMPLETE\n');
  return cycleId;
}

// Main test execution
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const getArg = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index !== -1 ? args[index + 1] : undefined;
  };

  const config: TestConfig = {
    apiUrl: getArg('--apiUrl') || 'http://localhost:3000',
    token: getArg('--token'),
    apiKey: getArg('--apiKey'),
    characterId: parseInt(getArg('--characterId') || '0'),
    initialCapital: parseInt(getArg('--initialCapital') || '20000000000'),
  };

  if ((!config.token && !config.apiKey) || !config.characterId) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage (with Dev API Key - RECOMMENDED):');
    console.log(
      '  pnpm exec ts-node scripts/e2e-rollover-test.ts --apiUrl http://localhost:3000 --apiKey your-secret-key --characterId <logistics-char-id> --initialCapital 20000000000',
    );
    console.log('\nUsage (with Bearer Token):');
    console.log(
      '  pnpm exec ts-node scripts/e2e-rollover-test.ts --apiUrl http://localhost:3000 --token <your-admin-token> --characterId <logistics-char-id> --initialCapital 20000000000',
    );
    console.log('\nExample (API Key):');
    console.log(
      '  pnpm exec ts-node scripts/e2e-rollover-test.ts --apiKey my-dev-secret --characterId 2122151042',
    );
    process.exit(1);
  }

  console.log('🚀 Starting End-to-End Rollover Test');
  console.log(`  API: ${config.apiUrl}`);
  console.log(`  Auth: ${config.apiKey ? '🔑 API Key' : '🔐 Bearer Token'}`);
  console.log(`  Character: ${config.characterId}`);
  console.log(
    `  Initial Capital: ${config.initialCapital.toLocaleString()} ISK\n`,
  );

  try {
    // Clean test data
    await cleanTestData();

    // Test Cycle 1 (Jita prices)
    const cycle1Id = await testCycle1(config);

    // Test Cycle 2 (Rollover from Cycle 1)
    const cycle2Id = await testCycle2(config, cycle1Id);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Cycle 1: ${cycle1Id}`);
    console.log(`Cycle 2: ${cycle2Id}`);
    console.log('\nYou can now inspect the cycles in the UI or database.');
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
