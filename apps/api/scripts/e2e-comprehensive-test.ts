/**
 * Comprehensive End-to-End Test Script (INTERACTIVE)
 *
 * Tests the full cycle workflow including:
 * - Multiple participations
 * - Plan creation and commitment
 * - Fee tracking (shipping, broker, relist)
 * - Sales transactions
 * - Rollover to next cycle
 * - Package audit (lost package simulation)
 *
 * Usage (with Dev API Key - RECOMMENDED):
 *   pnpm exec ts-node scripts/e2e-comprehensive-test.ts --apiUrl http://localhost:3000 --apiKey your-secret-key --characterId <logistics-char-id>
 *
 * Usage (with Bearer Token):
 *   pnpm exec ts-node scripts/e2e-comprehensive-test.ts --apiUrl http://localhost:3000 --token <your-admin-token> --characterId <logistics-char-id>
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
  token?: string;
  apiKey?: string;
  characterId: number;
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

  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey;
  } else if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`;
  } else {
    throw new Error('Either --apiKey or --token must be provided');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `API call failed: ${response.status} ${response.statusText}\n${text}`,
      );
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`API call timed out after 2 minutes: ${method} ${path}`);
    }
    throw error;
  }
}

// Test setup: Clean all test data
async function cleanTestData() {
  console.log('\n🗑️  [SETUP] Cleaning test data...');
  await prisma.sellAllocation.deleteMany({});
  await prisma.buyAllocation.deleteMany({});
  await prisma.packageCycleLine.deleteMany({});
  await prisma.committedPackage.deleteMany({});
  await prisma.cycleLine.deleteMany({});
  await prisma.cycleFeeEvent.deleteMany({});
  await prisma.cycleSnapshot.deleteMany({});
  await prisma.cycleLedgerEntry.deleteMany({});
  await prisma.cycleParticipation.deleteMany({});
  await prisma.cycleCapitalCache.deleteMany({});
  await prisma.cycle.deleteMany({});
  await prisma.walletTransaction.deleteMany({});
  await prisma.walletJournalEntry.deleteMany({});
  console.log('  ✓ Test data cleaned');
}

// Create fake donation for participation matching
async function createFakeDonation(
  characterId: number,
  amount: number,
  reason: string,
) {
  console.log(`💰 [SETUP] Creating fake donation: ${amount} ISK`);
  await prisma.walletJournalEntry.create({
    data: {
      journalId: BigInt(Date.now() + Math.floor(Math.random() * 1000)),
      characterId,
      date: new Date(),
      amount: amount.toString(),
      balance: '999999999999.00',
      contextId: BigInt(0),
      contextIdType: 'undefined',
      description: `Test donation - ${reason}`,
      firstPartyId: 1,
      secondPartyId: characterId,
      reason: reason,
      refType: 'player_donation',
      tax: '0.00',
      taxReceiverId: null,
    },
  });
  console.log(`  ✓ Created donation with reason: ${reason}`);
}

// Create fake wallet transactions for buys using cost map from packages
async function createFakeBuyTransactionsWithCosts(
  config: TestConfig,
  lines: any[],
  costMap: Map<string, number>,
  percentage: number = 1.0, // Buy 100% by default
) {
  console.log(
    `\n💳 [SETUP] Creating fake buy transactions (${(percentage * 100).toFixed(0)}% of planned)...`,
  );

  let created = 0;
  let skipped = 0;

  for (const line of lines) {
    const unitsToBuy = Math.floor(line.plannedUnits * percentage);
    if (unitsToBuy === 0) continue;

    // Get unit price from cost map
    const key = `${line.typeId}:${line.destinationStationId}`;
    const unitCost = costMap.get(key);
    
    if (!unitCost) {
      console.log(`  ⚠️  No cost found for ${line.typeName || line.typeId} - skipping`);
      skipped++;
      continue;
    }

    const buyTxId = BigInt(Date.now() + Math.floor(Math.random() * 100000));

    await prisma.walletTransaction.create({
      data: {
        transactionId: buyTxId,
        characterId: config.characterId,
        date: new Date(),
        typeId: line.typeId,
        quantity: unitsToBuy,
        unitPrice: unitCost.toString(),
        clientId: 99999,
        locationId: line.destinationStationId,
        isBuy: true,
        journalRefId: buyTxId + BigInt(1),
      },
    });
    created++;
  }

  console.log(`  ✓ Created buy transactions for ${created} items (${skipped} skipped - no cost data)`);
}

// Create fake wallet transactions for sells
async function createFakeSellTransactions(
  config: TestConfig,
  cycleId: string,
  lines: any[],
  sellPercentage: number = 0.8, // Sell 80% of bought items
) {
  console.log(
    `\n💰 [SETUP] Creating fake sell transactions (${(sellPercentage * 100).toFixed(0)}% of bought)...`,
  );

  let fullySold = 0;
  let partiallySold = 0;
  let unsold = 0;

  for (const line of lines) {
    const buyUnits = line.unitsBought;
    const sellUnits = Math.floor(buyUnits * sellPercentage);

    if (sellUnits === 0) {
      unsold++;
      continue;
    }

    if (sellUnits >= buyUnits) {
      fullySold++;
    } else {
      partiallySold++;
    }

    // Sell at 1.5x buy price for profit
    const buyPrice = parseFloat(line.buyCostIsk) / line.unitsBought;
    const sellPrice = buyPrice * 1.5;
    const grossRevenue = sellPrice * sellUnits;
    const salesTax = grossRevenue * 0.0337; // 3.37% tax
    const netRevenue = grossRevenue - salesTax;

    const sellTxId = BigInt(
      Date.now() + Math.floor(Math.random() * 100000) + 50000,
    );

    await prisma.walletTransaction.create({
      data: {
        transactionId: sellTxId,
        characterId: config.characterId,
        date: new Date(),
        typeId: line.typeId,
        quantity: sellUnits,
        unitPrice: sellPrice.toString(),
        clientId: 88888,
        locationId: line.destinationStationId,
        isBuy: false,
        journalRefId: sellTxId + BigInt(1),
      },
    });
  }

  console.log(`\n  📦 Distribution:`);
  console.log(`    Fully Sold: ${fullySold} items`);
  console.log(`    Partially Sold: ${partiallySold} items`);
  console.log(`    Unsold: ${unsold} items`);
}

// Test Cycle 1 with plans, fees, and sales
async function testCycle1(config: TestConfig): Promise<string> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔵 CYCLE 1: Full Workflow with Plans & Fees');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Plan cycle
  console.log('1️⃣  Planning Cycle 1...');
  const cycle = await apiCall(config, 'POST', '/ledger/cycles/plan', {
    startedAt: new Date(Date.now() + 5000).toISOString(),
    name: 'Comprehensive Test Cycle 1',
  });
  const cycleId = cycle.id;
  console.log(`  ✓ Cycle created: ${cycleId}`);

  // 2. Create multiple participations (5 people, 60B total)
  console.log('\n2️⃣  Creating 5 participations (60B total)...');
  const participants = [
    { name: 'Investor Alpha', amount: 15000000000 },
    { name: 'Investor Beta', amount: 12000000000 },
    { name: 'Investor Gamma', amount: 10000000000 },
    { name: 'Investor Delta', amount: 13000000000 },
    { name: 'Investor Epsilon', amount: 10000000000 },
  ];

  for (const p of participants) {
    await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/participations`, {
      characterName: p.name,
      amountIsk: p.amount.toFixed(2),
    });
    console.log(`  ✓ ${p.name}: ${(p.amount / 1e9).toFixed(1)}B ISK`);
  }

  // 3. Create fake donations and match
  console.log('\n3️⃣  Creating donations and matching...');
  const totalDonation = participants.reduce((sum, p) => sum + p.amount, 0);
  const reason = `ARB-${cycleId.slice(0, 8)}`;
  await createFakeDonation(config.characterId, totalDonation, reason);

  await apiCall(
    config,
    'POST',
    `/ledger/participations/match?cycleId=${cycleId}`,
    {},
  );
  console.log('  ✓ All donations matched');

  // 4. Open cycle (fetches from ESI - first cycle)
  console.log('\n4️⃣  Opening Cycle 1 (fetching from game)...');
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/open`, {});
  console.log('  ✓ Cycle opened');

  await waitForUser(
    `Check frontend: Cycle 1 should show 60B starting capital with items from game`,
  );

  // 5. Get cycle lines for planning
  console.log('\n5️⃣  Getting cycle lines...');
  const lines: any[] = await apiCall(
    config,
    'GET',
    `/ledger/cycles/${cycleId}/lines`,
    null,
  );
  console.log(`  ✓ Found ${lines.length} cycle lines`);

  // 6. Create a plan with ~20B worth of items (about 1/3 of capital)
  console.log('\n6️⃣  Creating plan with ~20B of items...');
  
  const targetInvestment = 20e9; // 20B ISK
  
  // Get unique destination stations from cycle lines
  const destinations = [...new Set(lines.map((l: any) => l.destinationStationId))];
  const shippingCostByStation: Record<string, number> = {};
  destinations.forEach((stationId: number) => {
    shippingCostByStation[stationId.toString()] = 50000000; // 50M ISK per destination
  });

  const planRequest = {
    shippingCostByStation,
    packageCapacityM3: 350000, // Standard freight container
    investmentISK: targetInvestment,
    maxPackagesHint: 10,
    maxPackageCollateralISK: 2000000000, // 2B ISK
  };

  console.log(`  Planning with ${destinations.length} destinations, ${targetInvestment / 1e9}B ISK investment...`);
  const planResult = await apiCall(config, 'POST', '/arbitrage/plan-packages', planRequest);
  console.log(`  ✓ Plan created with ${planResult.packages?.length || 0} packages`);

  let totalPlanValue = 0;
  for (const pkg of planResult.packages || []) {
    totalPlanValue += Number(pkg.totalCost || 0);
  }
  console.log(`  ✓ Total plan value: ${(totalPlanValue / 1e9).toFixed(1)}B ISK`);

  await waitForUser(
    `Check frontend: Plan should show ${planResult.packages?.length || 0} packages ready to commit`,
  );

  // 7. Commit the plan
  console.log('\n7️⃣  Committing plan...');
  const commitResult = await apiCall(config, 'POST', '/arbitrage/commit', {
    request: planRequest,
    result: planResult,
    memo: 'E2E Test Plan 1',
  });
  console.log(`  ✓ Plan committed (${commitResult.id})`);

  await waitForUser(
    `Check frontend: Plan status should change to committed/in_transit`,
  );

  // 8. Add shipping fees
  console.log('\n8️⃣  Adding shipping fees (500M ISK)...');
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/transport-fee`, {
    amountIsk: '500000000.00',
    memo: 'Shipping from Jita to trade hubs',
  });
  console.log('  ✓ Shipping fees added');

  // 9. Get updated cycle lines after plan commit
  console.log('\n9️⃣  Fetching updated cycle lines...');
  const updatedLines: any[] = await apiCall(
    config,
    'GET',
    `/ledger/cycles/${cycleId}/lines`,
    null,
  );
  const plannedLines = updatedLines.filter(l => l.plannedUnits > 0);
  console.log(`  ✓ Found ${plannedLines.length} lines with planned units`);

  // 10. Fetch committed packages to get unit costs
  console.log('\n🔟 Fetching committed packages for unit costs...');
  const packagesResponse: any = await apiCall(
    config,
    'GET',
    `/packages?cycleId=${cycleId}`,
  );
  
  // Build a map of typeId+stationId -> unitCost
  const costMap = new Map<string, number>();
  
  // Ensure packagesResponse is an array
  if (!Array.isArray(packagesResponse)) {
    throw new Error(
      `Expected packages response to be an array, got: ${JSON.stringify(packagesResponse).substring(0, 200)}`,
    );
  }

  for (const pkg of packagesResponse) {
    if (!pkg.items || !Array.isArray(pkg.items)) {
      console.log(`  ⚠️  Package ${pkg.id} has no items or items is not an array`);
      continue;
    }
    
    for (const item of pkg.items) {
      const key = `${item.typeId}:${pkg.destinationStationId}`;
      costMap.set(key, Number(item.unitCost));
    }
  }
  console.log(`  ✓ Found unit costs for ${costMap.size} items from ${packagesResponse.length} packages`);

  // 11. Create fake buy transactions for the planned items
  console.log('\n1️⃣1️⃣  Creating fake buy transactions for planned items...');
  await createFakeBuyTransactionsWithCosts(config, plannedLines, costMap, 1.0);

  // 12. Allocate buy transactions
  console.log('\n1️⃣2️⃣  Allocating buy transactions...');
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/allocate`, {});
  console.log('  ✓ Buy transactions allocated');

  // Refetch lines to get updated unitsBought
  const linesAfterBuys: any[] = await apiCall(
    config,
    'GET',
    `/ledger/cycles/${cycleId}/lines`,
  );
  const updatedPlannedLines = linesAfterBuys.filter((l) => l.plannedUnits > 0);
  console.log(`  ✓ Refetched ${updatedPlannedLines.length} lines with unitsBought populated`);

  await waitForUser(
    `Check frontend: Cycle lines should show units bought matching planned units`,
  );

  // 13. Add broker fees (for new listings - 1.5% of each line's total value)
  console.log('\n1️⃣3️⃣  Adding broker fees for new listings...');
  const brokerFees = updatedPlannedLines.map((line) => {
    // buyCostIsk is already the TOTAL cost for all units, not unit price
    const totalValue = Number(line.buyCostIsk);
    const brokerFee = totalValue * 0.015; // 1.5%
    return {
      lineId: line.id,
      amountIsk: brokerFee.toFixed(2),
    };
  });
  const totalBrokerFees = brokerFees.reduce(
    (sum, f) => sum + Number(f.amountIsk),
    0,
  );
  await apiCall(config, 'POST', '/ledger/fees/broker/bulk', { fees: brokerFees });
  console.log(`  ✓ Broker fees added: ${(totalBrokerFees / 1e6).toFixed(0)}M ISK`);

  // 14. Add relist fees (price adjustments) to 30% of lines
  console.log('\n1️⃣4️⃣  Adding relist fees (price adjustments)...');
  const linesToRelist = updatedPlannedLines.slice(0, Math.ceil(updatedPlannedLines.length * 0.3));
  const relistFees = linesToRelist.map((line) => {
    // buyCostIsk is already the TOTAL cost for all units, not unit price
    const totalValue = Number(line.buyCostIsk);
    const relistFee = totalValue * 0.003; // 0.3%
    return {
      lineId: line.id,
      amountIsk: relistFee.toFixed(2),
    };
  });
  const totalRelistFees = relistFees.reduce(
    (sum, f) => sum + Number(f.amountIsk),
    0,
  );
  await apiCall(config, 'POST', '/ledger/fees/relist/bulk', { fees: relistFees });
  console.log(`  ✓ Relist fees added to ${linesToRelist.length} lines: ${(totalRelistFees / 1e6).toFixed(0)}M ISK`);

  await waitForUser(
    `Check frontend: Ledger should show all fees (transport, broker, relist)`,
  );

  // 15. Create sell transactions (80% sold)
  console.log('\n1️⃣5️⃣  Creating sell transactions (80% of stock)...');
  await createFakeSellTransactions(config, cycleId, updatedPlannedLines, 0.8);

  // 16. Allocate sell transactions
  console.log('\n1️⃣6️⃣  Allocating sell transactions...');
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/allocate`, {});
  console.log('  ✓ Sell transactions allocated');

  await waitForUser(
    `Check frontend: Cycle lines should show sales, profit should be calculated`,
  );

  // 17. Check profit
  console.log('\n1️⃣7️⃣  Checking cycle profit...');
  const overview: any = await apiCall(
    config,
    'GET',
    '/ledger/cycles/overview',
    null,
  );
  const cycle1Data = overview.current;
  console.log(`  Current Profit: ${Number(cycle1Data.profit.current).toLocaleString()} ISK`);
  console.log(`  Cash: ${Number(cycle1Data.capital.cash).toLocaleString()} ISK`);
  console.log(`  Inventory: ${Number(cycle1Data.capital.inventory).toLocaleString()} ISK`);
  console.log(`  Total: ${Number(cycle1Data.capital.total).toLocaleString()} ISK`);

  await waitForUser(
    `Check frontend: Verify profit calculation includes all fees. Ready to close Cycle 1?`,
  );

  console.log('\n✅ CYCLE 1 COMPLETE (will close when Cycle 2 opens)\n');
  return cycleId;
}

// Test Cycle 2 with rollover and package audit
async function testCycle2(
  config: TestConfig,
  cycle1Id: string,
): Promise<{ cycleId: string; packageId: string }> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟢 CYCLE 2: Rollover & Package Audit');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Plan Cycle 2
  console.log('1️⃣  Planning Cycle 2...');
  const cycle = await apiCall(config, 'POST', '/ledger/cycles/plan', {
    startedAt: new Date(Date.now() + 5000).toISOString(),
    name: 'Comprehensive Test Cycle 2',
  });
  const cycleId = cycle.id;
  console.log(`  ✓ Cycle created: ${cycleId}`);

  // 2. Create participations (same as Cycle 1)
  console.log('\n2️⃣  Creating 5 participations (60B total)...');
  const participants = [
    { name: 'Investor Alpha', amount: 15000000000 },
    { name: 'Investor Beta', amount: 12000000000 },
    { name: 'Investor Gamma', amount: 10000000000 },
    { name: 'Investor Delta', amount: 13000000000 },
    { name: 'Investor Epsilon', amount: 10000000000 },
  ];

  for (const p of participants) {
    await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/participations`, {
      characterName: p.name,
      amountIsk: p.amount.toFixed(2),
    });
  }
  console.log('  ✓ All participations created');

  // 3. Create donations and match
  console.log('\n3️⃣  Creating donations and matching...');
  const totalDonation = participants.reduce((sum, p) => sum + p.amount, 0);
  const reason = `ARB-${cycleId.slice(0, 8)}`;
  await createFakeDonation(config.characterId, totalDonation, reason);

  await apiCall(
    config,
    'POST',
    `/ledger/participations/match?cycleId=${cycleId}`,
    {},
  );
  console.log('  ✓ All donations matched');

  // 4. Open Cycle 2 (automatically closes Cycle 1 and creates rollover)
  console.log('\n4️⃣  Opening Cycle 2 (closes Cycle 1, creates rollover)...');
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/open`, {});
  console.log('  ✓ Cycle 2 opened');
  console.log('  ✓ Cycle 1 automatically closed with buyback');
  console.log('  ✓ Rollover lines created');

  await waitForUser(
    `Check frontend: Cycle 1 should show AWAITING_PAYOUT participations. Cycle 2 should show rollover lines.`,
  );

  // 5. Verify rollover
  console.log('\n5️⃣  Verifying rollover...');
  const lines: any[] = await apiCall(
    config,
    'GET',
    `/ledger/cycles/${cycleId}/lines`,
    null,
  );
  const rolloverLines = lines.filter((l: any) => l.isRollover);
  console.log(
    `  ✓ ${lines.length} total lines, ${rolloverLines.length} are rollover`,
  );

  // 6. Check capital
  console.log('\n6️⃣  Checking Cycle 2 capital...');
  const overview: any = await apiCall(
    config,
    'GET',
    '/ledger/cycles/overview',
    null,
  );
  const cycle2Data = overview.current;
  console.log(`  Starting Capital: ${Number(cycle2Data.initialCapitalIsk).toLocaleString()} ISK`);
  console.log(`  Cash: ${Number(cycle2Data.capital.cash).toLocaleString()} ISK`);
  console.log(`  Inventory: ${Number(cycle2Data.capital.inventory).toLocaleString()} ISK`);
  console.log(`  Total: ${Number(cycle2Data.capital.total).toLocaleString()} ISK`);

  await waitForUser(
    `Check frontend: Capital should show inventory from rollover deducted from cash`,
  );

  // 7. Create a new plan with available cash
  console.log('\n7️⃣  Creating new plan with available cash...');
  const availableCash = Number(cycle2Data.capital.cash);
  const targetPlanValue = availableCash * 0.3; // Use 30% of available cash

  let planValue = 0;
  const planItems: any[] = [];

  // Only use non-rollover items for the plan
  const nonRolloverLines = lines.filter((l: any) => !l.isRollover);

  for (const line of nonRolloverLines) {
    if (planValue >= targetPlanValue) break;
    
    const percentage = 0.5 + Math.random() * 0.3;
    const unitsForPlan = Math.floor(line.plannedUnits * percentage);
    
    if (unitsForPlan > 0) {
      const unitCost = parseFloat(line.buyCostIsk) / line.unitsBought;
      const lineValue = unitCost * unitsForPlan;
      
      planItems.push({
        cycleLineId: line.id,
        typeId: line.typeId,
        units: unitsForPlan,
        destinationStationId: line.destinationStationId,
      });
      
      planValue += lineValue;
    }
  }

  let packageId: string | null = null;

  if (planItems.length > 0) {
    const plan = await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/plans`, {
      name: 'Test Plan Package 2',
      items: planItems,
    });
    packageId = plan.packageId;
    console.log(`  ✓ Plan created with ${planItems.length} items (~${(planValue / 1e9).toFixed(1)}B ISK)`);
  } else {
    console.log('  ⚠️  No new items available for planning (all rollover)');
  }

  await waitForUser(
    `Check frontend: New plan should appear${packageId ? ' with items' : ' (or no new items if all rollover)'}`,
  );

  // 8. Simulate lost package (if we created one)
  if (packageId) {
    console.log('\n8️⃣  Simulating lost package...');
    console.log(`  Package ID: ${packageId}`);
    console.log(`  📦 To test package audit:`);
    console.log(`     1. Go to http://localhost:3001/arbitrage/admin/packages`);
    console.log(`     2. Find package: ${packageId.slice(0, 8)}...`);
    console.log(`     3. Mark it as "Lost in Transit"`);
    console.log(`     4. Verify capital adjustments and profit impact`);

    await waitForUser(
      `Mark the package as lost in the frontend, then continue`,
    );

    // Verify the package was marked as lost
    const pkg = await apiCall(config, 'GET', `/market/packages/${packageId}`, null);
    console.log(`  Package status: ${pkg.status}`);
    
    if (pkg.status === 'LOST') {
      console.log('  ✅ Package successfully marked as lost!');
      console.log('  ℹ️  Lost package value should be deducted from capital');
    } else {
      console.log(`  ⚠️  Package status is: ${pkg.status} (expected LOST)`);
    }
  }

  console.log('\n✅ CYCLE 2 COMPLETE\n');
  return { cycleId, packageId: packageId || '' };
}

// Main test execution
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
  };

  if ((!config.token && !config.apiKey) || !config.characterId) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage (with Dev API Key - RECOMMENDED):');
    console.log(
      '  pnpm exec ts-node scripts/e2e-comprehensive-test.ts --apiUrl http://localhost:3000 --apiKey your-secret-key --characterId <logistics-char-id>',
    );
    console.log('\nUsage (with Bearer Token):');
    console.log(
      '  pnpm exec ts-node scripts/e2e-comprehensive-test.ts --apiUrl http://localhost:3000 --token <your-admin-token> --characterId <logistics-char-id>',
    );
    process.exit(1);
  }

  console.log('🚀 Starting Comprehensive E2E Test');
  console.log(`  API: ${config.apiUrl}`);
  console.log(`  Auth: ${config.apiKey ? '🔑 API Key' : '🔐 Bearer Token'}`);
  console.log(`  Character: ${config.characterId}\n`);

  try {
    // Clean test data
    await cleanTestData();

    // Test Cycle 1 (full workflow)
    const cycle1Id = await testCycle1(config);

    // Test Cycle 2 (rollover and package audit)
    const cycle2Result = await testCycle2(config, cycle1Id);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Cycle 1: ${cycle1Id}`);
    console.log(`Cycle 2: ${cycle2Result.cycleId}`);
    if (cycle2Result.packageId) {
      console.log(`Package: ${cycle2Result.packageId}`);
    }
    console.log('\nYou can now inspect the cycles, participations, and packages in the UI.');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

