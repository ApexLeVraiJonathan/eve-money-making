/**
 * Reusable Test Utilities
 *
 * Common functions for E2E tests to reduce code duplication and improve maintainability.
 *
 * Usage:
 *   import { TestContext, createTestContext, cleanTestData, createCycle, ... } from './test-utilities';
 */

import { PrismaClient } from '@eve/prisma';
import * as readline from 'readline';

export const prisma = new PrismaClient();

export interface TestConfig {
  apiUrl: string;
  token?: string;
  apiKey?: string;
  characterId: number;
  skipPauses?: boolean;
}

export interface TestContext {
  config: TestConfig;
  transactionIdCounter: number;
}

// ============================================================================
// Test Context
// ============================================================================

export function createTestContext(config: TestConfig): TestContext {
  return {
    config,
    transactionIdCounter: 0,
  };
}

// ============================================================================
// User Interaction
// ============================================================================

export function waitForUser(message: string): Promise<void> {
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

// ============================================================================
// API Calls
// ============================================================================

export async function apiCall(
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

// ============================================================================
// Test Data Cleanup
// ============================================================================

export async function cleanTestData() {
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

// ============================================================================
// Cycle Operations
// ============================================================================

export async function createCycle(
  config: TestConfig,
  name: string,
  startedAt?: Date,
): Promise<{ id: string; name: string }> {
  const cycle = await apiCall(config, 'POST', '/ledger/cycles/plan', {
    startedAt: (startedAt || new Date(Date.now() + 5000)).toISOString(),
    name,
  });
  return cycle;
}

export async function openCycle(config: TestConfig, cycleId: string): Promise<void> {
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/open`, {});
}

export async function closeCycle(config: TestConfig, cycleId: string): Promise<void> {
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/close`, {});
}

export async function getCycleOverview(config: TestConfig): Promise<any> {
  return await apiCall(config, 'GET', '/ledger/cycles/overview', null);
}

// ============================================================================
// Participation Operations
// ============================================================================

export interface CreateParticipationOptions {
  cycleId: string;
  characterName: string;
  amountIsk: string;
  testUserId?: string;
  rollover?: {
    type: 'FULL_PAYOUT' | 'INITIAL_ONLY' | 'CUSTOM_AMOUNT';
    customAmountIsk?: string;
  };
}

export async function createParticipation(
  config: TestConfig,
  options: CreateParticipationOptions,
): Promise<any> {
  return await apiCall(
    config,
    'POST',
    `/ledger/cycles/${options.cycleId}/participations`,
    {
      characterName: options.characterName,
      amountIsk: options.amountIsk,
      testUserId: options.testUserId,
      rollover: options.rollover,
    },
  );
}

export async function getParticipations(
  config: TestConfig,
  cycleId: string,
): Promise<any[]> {
  return await apiCall(
    config,
    'GET',
    `/ledger/cycles/${cycleId}/participations`,
    null,
  );
}

export async function optOutParticipation(
  config: TestConfig,
  participationId: string,
): Promise<void> {
  await apiCall(
    config,
    'POST',
    `/ledger/participations/${participationId}/opt-out`,
    {},
  );
}

export async function getMaxParticipation(
  config: TestConfig,
  testUserId?: string,
): Promise<{
  maxAmountIsk: string;
  maxAmountB: number;
}> {
  const query = testUserId ? `?testUserId=${testUserId}` : '';
  return await apiCall(config, 'GET', `/ledger/participations/max-amount${query}`, null);
}

// ============================================================================
// Wallet Operations
// ============================================================================

export async function createFakeDonation(
  ctx: TestContext,
  amount: number,
  reason: string,
) {
  console.log(`💰 [SETUP] Creating fake donation: ${amount} ISK`);
  await prisma.walletJournalEntry.create({
    data: {
      journalId: BigInt(Date.now() * 1000 + ctx.transactionIdCounter++ * 10),
      characterId: ctx.config.characterId,
      date: new Date(),
      amount: amount.toString(),
      balance: '999999999999.00',
      contextId: BigInt(0),
      contextIdType: 'undefined',
      description: `Test donation - ${reason}`,
      firstPartyId: 1,
      secondPartyId: ctx.config.characterId,
      reason: reason,
      refType: 'player_donation',
      tax: '0.00',
      taxReceiverId: null,
    },
  });
  console.log(`  ✓ Created donation with reason: ${reason}`);
}

export async function matchDonations(
  config: TestConfig,
  cycleId: string,
): Promise<void> {
  await apiCall(
    config,
    'POST',
    `/ledger/participations/match?cycleId=${cycleId}`,
    {},
  );
}

export async function createFakeSellTransactions(
  ctx: TestContext,
  lines: any[],
  sellPercentage: number = 0.8,
) {
  console.log(
    `\n📊 [SETUP] Creating fake sell transactions (${(sellPercentage * 100).toFixed(0)}% of bought)...`,
  );

  let created = 0;
  for (const line of lines) {
    const buyUnits = line.unitsBought;
    if (!buyUnits || buyUnits === 0) continue;

    const sellUnits = Math.floor(buyUnits * sellPercentage);
    if (sellUnits === 0) continue;

    const buyPrice = parseFloat(line.buyCostIsk) / line.unitsBought;
    const sellPrice = buyPrice * 1.5; // 50% profit

    const sellTxId = BigInt(Date.now() * 1000 + ctx.transactionIdCounter++ * 10);

    await prisma.walletTransaction.create({
      data: {
        transactionId: sellTxId,
        characterId: ctx.config.characterId,
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
    created++;
  }

  console.log(`  ✓ Created sell transactions for ${created} lines`);
}

export async function allocateTransactions(
  config: TestConfig,
  cycleId: string,
): Promise<void> {
  await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/allocate`, {});
}

// ============================================================================
// Payout Operations
// ============================================================================

export async function createPayouts(
  config: TestConfig,
  cycleId: string,
  profitSharePct: number = 0.5,
): Promise<any> {
  return await apiCall(config, 'POST', `/ledger/cycles/${cycleId}/payouts`, {
    profitSharePct,
  });
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function formatIsk(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  } else if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  } else if (num >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`;
  } else {
    return `${num.toFixed(2)}`;
  }
}

export function assertApproxEqual(
  actual: number,
  expected: number,
  tolerance: number,
  message: string,
) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(
      `${message}: Expected ${expected}, got ${actual} (diff: ${diff}, tolerance: ${tolerance})`,
    );
  }
}

