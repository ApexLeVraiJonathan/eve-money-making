/**
 * Test Rollover Setup Script
 *
 * This script helps set up test data for manual rollover testing.
 * Run with: pnpm tsx scripts/test-rollover-setup.ts <step>
 *
 * Steps:
 * 1. clean - Delete all cycles and related data
 * 2. create-donation - Create fake donation for participation
 * 3. create-trades - Create fake buy/sell transactions
 */

import { PrismaClient } from '@eve/prisma';

const prisma = new PrismaClient();

async function cleanCycles() {
  console.log('🗑️  Cleaning all cycles and related data...');

  // Delete in correct order (respecting foreign keys)
  await prisma.sellAllocation.deleteMany({});
  console.log('  ✓ Deleted sell allocations');

  await prisma.buyAllocation.deleteMany({});
  console.log('  ✓ Deleted buy allocations');

  await prisma.cycleLine.deleteMany({});
  console.log('  ✓ Deleted cycle lines');

  await prisma.cycleFeeEvent.deleteMany({});
  console.log('  ✓ Deleted fee events');

  await prisma.cycleSnapshot.deleteMany({});
  console.log('  ✓ Deleted snapshots');

  await prisma.cycleLedgerEntry.deleteMany({});
  console.log('  ✓ Deleted ledger entries');

  await prisma.cycleParticipation.deleteMany({});
  console.log('  ✓ Deleted participations');

  await prisma.cycleCapitalCache.deleteMany({});
  console.log('  ✓ Deleted capital cache');

  await prisma.cycle.deleteMany({});
  console.log('  ✓ Deleted cycles');

  console.log('✅ Clean complete!\n');
}

async function createFakeDonation(opts: {
  characterId: number;
  amount: string;
  reason: string;
}) {
  console.log('💰 Creating fake donation...');

  const journalId = BigInt(Date.now()); // Use timestamp as unique ID

  const entry = await prisma.walletJournalEntry.create({
    data: {
      characterId: opts.characterId,
      journalId,
      date: new Date(),
      refType: 'player_donation',
      amount: opts.amount,
      balance: '0', // Not important for donations
      contextId: null,
      contextIdType: null,
      description: 'Test donation',
      reason: opts.reason,
      firstPartyId: 12345, // Fake donor ID
      secondPartyId: opts.characterId,
      tax: null,
      taxReceiverId: null,
    },
  });

  console.log(`✅ Created donation: ${opts.amount} ISK`);
  console.log(`   Journal ID: ${journalId}`);
  console.log(`   Reason: ${opts.reason}\n`);

  return entry;
}

async function createFakeTrades(opts: {
  cycleId: string;
  lineId: string;
  characterId: number;
  typeId: number;
  stationId: number;
  buyUnits: number;
  buyPrice: number;
  sellUnits: number; // Less than buyUnits to leave some unsold
  sellPrice: number;
}) {
  console.log('📊 Creating fake trades...');

  // Create buy transaction
  const buyTxId = BigInt(Date.now());
  const buyTx = await prisma.walletTransaction.create({
    data: {
      characterId: opts.characterId,
      transactionId: buyTxId,
      date: new Date(Date.now() - 86400000), // 1 day ago
      isBuy: true,
      locationId: opts.stationId,
      typeId: opts.typeId,
      clientId: 99999,
      quantity: opts.buyUnits,
      unitPrice: opts.buyPrice.toString(),
      journalRefId: BigInt(Date.now() + 1),
    },
  });

  console.log(
    `  ✓ Buy: ${opts.buyUnits} units @ ${opts.buyPrice} ISK = ${opts.buyUnits * opts.buyPrice} ISK total`,
  );

  // Create buy allocation
  const buyAlloc = await prisma.buyAllocation.create({
    data: {
      lineId: opts.lineId,
      walletCharacterId: opts.characterId,
      walletTransactionId: buyTxId,
      isRollover: false,
      quantity: opts.buyUnits,
      unitPrice: opts.buyPrice.toString(),
    },
  });

  // Update cycle line with buy
  await prisma.cycleLine.update({
    where: { id: opts.lineId },
    data: {
      unitsBought: opts.buyUnits,
      buyCostIsk: (opts.buyUnits * opts.buyPrice).toString(),
    },
  });

  console.log(`  ✓ Buy allocation created`);

  // Create sell transactions (only for units that sold)
  if (opts.sellUnits > 0) {
    const sellTxId = BigInt(Date.now() + 100);
    const grossRevenue = opts.sellUnits * opts.sellPrice;
    const salesTax = grossRevenue * 0.05; // 5% sales tax
    const netRevenue = grossRevenue - salesTax;

    const sellTx = await prisma.walletTransaction.create({
      data: {
        characterId: opts.characterId,
        transactionId: sellTxId,
        date: new Date(),
        isBuy: false,
        locationId: opts.stationId,
        typeId: opts.typeId,
        clientId: 88888,
        quantity: opts.sellUnits,
        unitPrice: opts.sellPrice.toString(),
        journalRefId: BigInt(Date.now() + 2),
      },
    });

    console.log(
      `  ✓ Sell: ${opts.sellUnits} units @ ${opts.sellPrice} ISK = ${grossRevenue} ISK gross`,
    );

    // Create sell allocation
    const sellAlloc = await prisma.sellAllocation.create({
      data: {
        lineId: opts.lineId,
        walletCharacterId: opts.characterId,
        walletTransactionId: sellTxId,
        isRollover: false,
        quantity: opts.sellUnits,
        unitPrice: opts.sellPrice.toString(),
        revenueIsk: netRevenue.toString(),
        taxIsk: salesTax.toString(),
      },
    });

    // Update cycle line with sell
    await prisma.cycleLine.update({
      where: { id: opts.lineId },
      data: {
        unitsSold: opts.sellUnits,
        salesGrossIsk: grossRevenue.toString(),
        salesTaxIsk: salesTax.toString(),
        salesNetIsk: netRevenue.toString(),
      },
    });

    console.log(
      `  ✓ Sell allocation created (${opts.sellUnits} sold, ${opts.buyUnits - opts.sellUnits} remaining)`,
    );
  }

  console.log(`✅ Trades created!\n`);
  console.log(
    `📦 Remaining inventory: ${opts.buyUnits - opts.sellUnits} units for rollover\n`,
  );
}

async function showInstructions() {
  console.log('📋 Manual Testing Instructions\n');
  console.log('Step 1: Clean existing data');
  console.log('  $ pnpm tsx scripts/test-rollover-setup.ts clean\n');

  console.log('Step 2: Get your logistics character ID');
  console.log(
    '  Check the database or use the API to find a LOGISTICS character\n',
  );

  console.log('Step 3: Create a cycle via API');
  console.log('  POST /ledger/cycles/plan');
  console.log(
    '  Body: { "startedAt": "2025-01-15T00:00:00Z", "name": "Test Cycle 1" }\n',
  );

  console.log('Step 4: Create a participation via API');
  console.log('  POST /ledger/cycles/{cycleId}/participations');
  console.log(
    '  Body: { "characterName": "Test User", "amountIsk": "5000000000" }\n',
  );

  console.log('Step 5: Create fake donation for the participation');
  console.log('  $ pnpm tsx scripts/test-rollover-setup.ts create-donation \\');
  console.log('      --characterId 123456 \\');
  console.log('      --amount 5000000000 \\');
  console.log('      --reason "ARB-<first-8-chars-of-cycle-id>"\n');

  console.log('Step 6: Match the donation to participation via API');
  console.log('  POST /ledger/participations/match?cycleId={cycleId}\n');

  console.log('Step 7: Open the cycle via API');
  console.log('  POST /ledger/cycles/{cycleId}/open\n');

  console.log('Step 8: Create a cycle line via API (for trading)');
  console.log('  POST /ledger/cycles/{cycleId}/lines');
  console.log('  Body: {');
  console.log('    "typeId": 34,');
  console.log('    "destinationStationId": 60003760,');
  console.log('    "plannedUnits": 100');
  console.log('  }\n');

  console.log('Step 9: Create fake trades (with some unsold)');
  console.log('  $ pnpm tsx scripts/test-rollover-setup.ts create-trades \\');
  console.log('      --cycleId <cycle-id> \\');
  console.log('      --lineId <line-id> \\');
  console.log('      --characterId 123456 \\');
  console.log('      --typeId 34 \\');
  console.log('      --stationId 60003760 \\');
  console.log('      --buyUnits 100 \\');
  console.log('      --buyPrice 50000 \\');
  console.log('      --sellUnits 60 \\');
  console.log('      --sellPrice 55000\n');

  console.log('Step 10: Close the cycle via API');
  console.log('  POST /ledger/cycles/{cycleId}/close');
  console.log('  This should trigger rollover buyback!\n');

  console.log('Step 11: Verify buyback in database');
  console.log('  Check sell_allocations for isRollover = true');
  console.log('  Check cycle_lines for unitsSold = unitsBought\n');

  console.log('Step 12: Plan next cycle');
  console.log('  POST /ledger/cycles/plan');
  console.log(
    '  Body: { "startedAt": "2025-02-01T00:00:00Z", "name": "Test Cycle 2" }\n',
  );

  console.log('Step 13: Add participation to next cycle');
  console.log('  (Repeat steps 4-6 for new cycle)\n');

  console.log('Step 14: Open next cycle');
  console.log('  POST /ledger/cycles/{newCycleId}/open');
  console.log('  This should trigger rollover purchase!\n');

  console.log('Step 15: Verify rollover in database');
  console.log(
    '  Check cycle_lines for isRollover = true, rolloverFromCycleId set',
  );
  console.log('  Check buy_allocations for isRollover = true');
  console.log('  Check buyCostIsk matches previous cycle WAC\n');
}

// Main CLI handler
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'clean':
        await cleanCycles();
        break;

      case 'create-donation': {
        const characterId = parseInt(args[args.indexOf('--characterId') + 1]);
        const amount = args[args.indexOf('--amount') + 1];
        const reason = args[args.indexOf('--reason') + 1];

        if (!characterId || !amount || !reason) {
          console.error('❌ Missing required arguments');
          console.log(
            'Usage: pnpm tsx scripts/test-rollover-setup.ts create-donation \\',
          );
          console.log('  --characterId <id> --amount <isk> --reason <memo>');
          process.exit(1);
        }

        await createFakeDonation({ characterId, amount, reason });
        break;
      }

      case 'create-trades': {
        const cycleId = args[args.indexOf('--cycleId') + 1];
        const lineId = args[args.indexOf('--lineId') + 1];
        const characterId = parseInt(args[args.indexOf('--characterId') + 1]);
        const typeId = parseInt(args[args.indexOf('--typeId') + 1]);
        const stationId = parseInt(args[args.indexOf('--stationId') + 1]);
        const buyUnits = parseInt(args[args.indexOf('--buyUnits') + 1]);
        const buyPrice = parseFloat(args[args.indexOf('--buyPrice') + 1]);
        const sellUnits = parseInt(args[args.indexOf('--sellUnits') + 1]);
        const sellPrice = parseFloat(args[args.indexOf('--sellPrice') + 1]);

        if (
          !cycleId ||
          !lineId ||
          !characterId ||
          !typeId ||
          !stationId ||
          !buyUnits ||
          !buyPrice ||
          sellUnits === undefined ||
          !sellPrice
        ) {
          console.error('❌ Missing required arguments');
          console.log(
            'Usage: pnpm tsx scripts/test-rollover-setup.ts create-trades \\',
          );
          console.log('  --cycleId <id> --lineId <id> --characterId <id> \\');
          console.log('  --typeId <id> --stationId <id> \\');
          console.log('  --buyUnits <n> --buyPrice <price> \\');
          console.log('  --sellUnits <n> --sellPrice <price>');
          process.exit(1);
        }

        await createFakeTrades({
          cycleId,
          lineId,
          characterId,
          typeId,
          stationId,
          buyUnits,
          buyPrice,
          sellUnits,
          sellPrice,
        });
        break;
      }

      case 'help':
      default:
        await showInstructions();
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
