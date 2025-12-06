/**
 * Transaction Management Helper Functions
 *
 * Provides utilities for creating donations, buy/sell transactions, and allocations.
 */

import { PrismaClient } from '@eve/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});

export interface TestContext {
  characterId: number;
  transactionIdCounter: number;
}

/**
 * Create a fake donation (wallet journal entry)
 */
export async function createFakeDonation(
  ctx: TestContext,
  amountIsk: number,
  reason: string,
): Promise<void> {
  const journalId = BigInt(Date.now() * 1000 + ctx.transactionIdCounter++ * 10);
  await prisma.walletJournalEntry.create({
    data: {
      journalId,
      characterId: ctx.characterId,
      date: new Date(),
      amount: amountIsk.toString(),
      balance: '999999999999.00',
      contextId: BigInt(0),
      contextIdType: 'undefined',
      description: `Test donation - ${reason}`,
      firstPartyId: 1,
      secondPartyId: ctx.characterId,
      reason: reason, // THIS IS THE KEY FIELD FOR MATCHING!
      refType: 'player_donation',
      tax: '0.00',
      taxReceiverId: null,
    },
  });
}

/**
 * Match donations to participations for a cycle
 */
export async function matchDonations(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  cycleId: string,
): Promise<any> {
  return await apiCall(
    'POST',
    `/ledger/participations/match?cycleId=${cycleId}`,
    {},
  );
}

/**
 * Create fake sell transactions for cycle lines
 * @param lines - Cycle lines to create sells for
 * @param sellPercentage - Percentage of bought quantity to sell (0-1)
 * @param profitMultiplier - Price multiplier for profit (e.g., 1.5 = 50% profit)
 */
export async function createProfitableSells(
  ctx: TestContext,
  lines: any[],
  sellPercentage: number = 0.8,
  profitMultiplier: number = 1.5,
): Promise<number> {
  let created = 0;

  for (const line of lines) {
    // Handle both fresh buys (unitsBought) and rollover inventory (rolloverInventory)
    const availableUnits = line.unitsBought || line.rolloverInventory || 0;
    if (!availableUnits || availableUnits === 0) continue;

    const sellUnits = Math.floor(availableUnits * sellPercentage);
    if (sellUnits === 0) continue;

    // Calculate buy price from either buyCostIsk (fresh) or rolloverCostIsk (rollover)
    const totalCost = parseFloat(
      line.buyCostIsk || line.rolloverCostIsk || '0',
    );
    if (totalCost === 0) continue;

    const buyPrice = totalCost / availableUnits;
    const sellPrice = buyPrice * profitMultiplier;

    const sellTxId = BigInt(
      Date.now() * 1000 + ctx.transactionIdCounter++ * 10,
    );

    await prisma.walletTransaction.create({
      data: {
        transactionId: sellTxId,
        characterId: ctx.characterId,
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

  return created;
}

/**
 * Allocate transactions (buy/sell) to cycle lines
 */
export async function allocateTransactions(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  cycleId: string,
): Promise<any> {
  return await apiCall('POST', `/ledger/cycles/${cycleId}/allocate`, {});
}

/**
 * Create payouts for a closed cycle
 */
export async function createPayouts(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  cycleId: string,
): Promise<any> {
  // Use the admin finalize endpoint, which computes payouts and persists them.
  return await apiCall('POST', `/ledger/cycles/${cycleId}/payouts/finalize`, {
    profitSharePct: 0.5,
  });
}

/**
 * Clean all test data (cycles, participations, wallet entries)
 * WARNING: Use only in dev/test environments!
 */
export async function cleanAllTestData(): Promise<void> {
  console.log('\n🗑️  [CLEANUP] Removing all test data...');

  // Delete in correct order to avoid FK constraint violations
  await prisma.sellAllocation.deleteMany({});
  await prisma.buyAllocation.deleteMany({});
  await prisma.packageCycleLine.deleteMany({});
  await prisma.committedPackage.deleteMany({});
  await prisma.cycleLine.deleteMany({});
  await prisma.cycleFeeEvent.deleteMany({});
  await prisma.cycleSnapshot.deleteMany({});
  await prisma.cycleLedgerEntry.deleteMany({});
  // JingleYield programs reference cycle participations (root + links),
  // so they must be deleted before cycleParticipation.
  await prisma.jingleYieldProgram.deleteMany({});
  await prisma.cycleParticipation.deleteMany({});
  await prisma.cycleCapitalCache.deleteMany({});
  await prisma.cycle.deleteMany({});

  console.log('  ✓ All test data cleaned');
}
