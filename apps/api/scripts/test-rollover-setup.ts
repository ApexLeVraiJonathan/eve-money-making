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

interface CycleLineInput {
  id: string;
  typeId: number;
  typeName: string;
  destinationStationId: number;
  destinationStationName: string;
  plannedUnits: number;
  unitsBought: number;
  buyCostIsk: string;
  currentSellPriceIsk: string;
}

async function createBulkTrades(opts: {
  characterId: number;
  cycleLines: CycleLineInput[];
  sellPercentage?: number; // If provided, uses this percentage for ALL items (for testing)
  skipBuys?: boolean; // Skip buy transactions to test Jita fallback (default false)
}) {
  const skipBuys = opts.skipBuys ?? false;
  const fixedPercentage = opts.sellPercentage;

  console.log(`📦 Creating bulk trades for ${opts.cycleLines.length} items...`);
  if (fixedPercentage !== undefined) {
    console.log(
      `   Selling ${fixedPercentage}% of units for all items (fixed)`,
    );
  } else {
    console.log(
      `   Selling varied percentages: ~20% fully sold, ~50% partial, ~30% unsold`,
    );
  }
  if (skipBuys) {
    console.log(
      `   ⚠️  SKIPPING BUY TRANSACTIONS - Testing Jita price fallback\n`,
    );
  } else {
    console.log('');
  }

  let totalBuyCost = 0;
  let totalSellRevenue = 0;
  let totalUnsoldUnits = 0;
  let fullySoldCount = 0;
  let partiallySoldCount = 0;
  let unsoldCount = 0;

  for (const line of opts.cycleLines) {
    const buyUnits = line.unitsBought;
    const sellPrice = parseFloat(line.currentSellPriceIsk);

    // Use the EXISTING buyCostIsk from the cycle line (already set from Jita/previous cycle)
    const existingBuyCost = parseFloat(line.buyCostIsk);
    const buyPrice = existingBuyCost > 0 ? existingBuyCost / buyUnits : 0;

    if (buyPrice === 0) {
      console.log(`\n⚠️  Skipping ${line.typeName} - no buy cost set`);
      continue;
    }

    // Determine sell percentage based on fixed value or random distribution
    let sellPercentage: number;
    if (fixedPercentage !== undefined) {
      // Use fixed percentage for all items
      sellPercentage = fixedPercentage / 100;
    } else {
      // Random distribution for realistic scenarios
      const rand = Math.random();
      if (rand < 0.2) {
        // 20% of items: fully sold (100%)
        sellPercentage = 1.0;
        fullySoldCount++;
      } else if (rand < 0.7) {
        // 50% of items: partially sold (30-80%)
        sellPercentage = 0.3 + Math.random() * 0.5;
        partiallySoldCount++;
      } else {
        // 30% of items: not sold at all (0%)
        sellPercentage = 0;
        unsoldCount++;
      }
    }

    const sellUnits = Math.floor(buyUnits * sellPercentage);
    const buyCost = existingBuyCost;

    console.log(`\n${line.typeName} (${line.typeId})`);
    console.log(`  Station: ${line.destinationStationName}`);
    console.log(
      `  Sell %: ${(sellPercentage * 100).toFixed(1)}% → ${sellUnits}/${buyUnits} units`,
    );

    // Use line ID as part of unique transaction ID
    const lineIdSuffix = parseInt(line.id.slice(0, 8), 16);
    const buyTxId = BigInt(Date.now() * 1000 + lineIdSuffix);

    // Create buy transactions and allocations (unless testing Jita fallback)
    if (!skipBuys) {
      totalBuyCost += buyCost;

      // Create buy transaction
      await prisma.walletTransaction.create({
        data: {
          characterId: opts.characterId,
          transactionId: buyTxId,
          date: new Date(Date.now() - 86400000), // 1 day ago
          isBuy: true,
          locationId: line.destinationStationId,
          typeId: line.typeId,
          clientId: 99999,
          quantity: buyUnits,
          unitPrice: buyPrice.toString(),
          journalRefId: buyTxId + BigInt(1),
        },
      });

      // Create buy allocation
      await prisma.buyAllocation.create({
        data: {
          lineId: line.id,
          walletCharacterId: opts.characterId,
          walletTransactionId: buyTxId,
          isRollover: false,
          quantity: buyUnits,
          unitPrice: buyPrice.toString(),
        },
      });

      console.log(
        `  ✓ Buy: ${buyUnits} units @ ${buyPrice.toLocaleString()} ISK = ${buyCost.toLocaleString()} ISK`,
      );
      // Note: buyCostIsk already set correctly from cycle opening (Jita/previous cycle)
    } else {
      console.log(
        `  ⊗ Skipped buy transaction (buyCostIsk remains from cycle opening)`,
      );
    }

    // Create sell transactions for sold units
    if (sellUnits > 0) {
      const sellTxId = buyTxId + BigInt(100);
      const grossRevenue = sellUnits * sellPrice;
      const salesTax = grossRevenue * 0.05; // 5% sales tax
      const netRevenue = grossRevenue - salesTax;

      totalSellRevenue += netRevenue;

      await prisma.walletTransaction.create({
        data: {
          characterId: opts.characterId,
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

      await prisma.sellAllocation.create({
        data: {
          lineId: line.id,
          walletCharacterId: opts.characterId,
          walletTransactionId: sellTxId,
          isRollover: false,
          quantity: sellUnits,
          unitPrice: sellPrice.toString(),
          revenueIsk: netRevenue.toString(),
          taxIsk: salesTax.toString(),
        },
      });

      await prisma.cycleLine.update({
        where: { id: line.id },
        data: {
          unitsSold: sellUnits,
          salesGrossIsk: grossRevenue.toString(),
          salesTaxIsk: salesTax.toString(),
          salesNetIsk: netRevenue.toString(),
        },
      });

      const unsoldUnits = buyUnits - sellUnits;
      totalUnsoldUnits += unsoldUnits;

      console.log(
        `  ✓ Sell: ${sellUnits} units @ ${sellPrice.toLocaleString()} ISK = ${netRevenue.toLocaleString()} ISK (net)`,
      );
      console.log(`  📦 Unsold: ${unsoldUnits} units for rollover`);
    } else {
      totalUnsoldUnits += buyUnits;
      console.log(`  📦 All ${buyUnits} units unsold (for rollover)`);
    }
  }

  console.log(`\n✅ Bulk trades complete!`);
  console.log(`\n📊 Summary:`);
  console.log(`  Total Buy Cost: ${totalBuyCost.toLocaleString()} ISK`);
  console.log(
    `  Total Sell Revenue (net): ${totalSellRevenue.toLocaleString()} ISK`,
  );
  console.log(
    `  Total Profit: ${(totalSellRevenue - totalBuyCost).toLocaleString()} ISK`,
  );
  console.log(
    `  Total Unsold Units: ${totalUnsoldUnits} (across ${opts.cycleLines.length} items)`,
  );

  if (fixedPercentage === undefined) {
    console.log(`\n📦 Item Distribution:`);
    console.log(`  Fully Sold (100%): ${fullySoldCount} items`);
    console.log(`  Partially Sold (30-80%): ${partiallySoldCount} items`);
    console.log(`  Unsold (0%): ${unsoldCount} items`);
  }

  console.log(`\n🎯 Ready for cycle closure and rollover testing!\n`);
}

async function showInstructions() {
  console.log('📋 Test Rollover Setup - Available Commands\n');

  console.log('Commands:');
  console.log('  clean                - Delete all cycles and related data');
  console.log('  create-donation      - Create a fake wallet donation');
  console.log('  create-trades        - Create fake trades for a single item');
  console.log(
    '  create-bulk-trades   - Create fake trades for multiple items from JSON\n',
  );

  console.log('═══════════════════════════════════════════════════\n');
  console.log('🧹 Clean Command:');
  console.log('  pnpm exec ts-node scripts/test-rollover-setup.ts clean\n');

  console.log('💰 Create Donation Command:');
  console.log(
    '  pnpm exec ts-node scripts/test-rollover-setup.ts create-donation --characterId 123456 --amount 5000000000 --reason "ARB-12345678"\n',
  );

  console.log('📊 Create Single Trade Command:');
  console.log(
    '  pnpm exec ts-node scripts/test-rollover-setup.ts create-trades --cycleId <id> --lineId <id> --characterId 123456 --typeId 34 --stationId 60003760 --buyUnits 100 --buyPrice 50000 --sellUnits 60 --sellPrice 55000\n',
  );

  console.log('📦 Create Bulk Trades Command (NEW!):');
  console.log(
    '  pnpm exec ts-node scripts/test-rollover-setup.ts create-bulk-trades --characterId 123456 --jsonFile docs/current.md',
  );
  console.log(
    '  - Reads cycle lines from JSON file (from /ledger/cycles/{id}/lines endpoint)',
  );
  console.log('  - Creates buy transactions at 88% of sell price');
  console.log(
    '  - By default: varies sales (20% fully sold, 50% partial, 30% unsold)',
  );
  console.log(
    '  - Optional --sellPercentage <0-100> to use fixed percentage for all items',
  );
  console.log(
    '  - Optional --skipBuys to skip buy transactions (tests Jita price fallback)\n',
  );

  console.log('═══════════════════════════════════════════════════\n');
  console.log('📋 Manual Testing Flow:\n');

  console.log(
    '1. Clean data: pnpm exec ts-node scripts/test-rollover-setup.ts clean',
  );
  console.log('2. Create cycle via API: POST /ledger/cycles/plan');
  console.log(
    '3. Create participation: POST /ledger/cycles/{cycleId}/participations',
  );
  console.log('4. Create donation: use create-donation command');
  console.log(
    '5. Match donation: POST /ledger/participations/match?cycleId={cycleId}',
  );
  console.log('6. Open cycle: POST /ledger/cycles/{cycleId}/open');
  console.log('   (This imports ESI sell orders as cycle lines)');
  console.log('7. Get cycle lines: GET /ledger/cycles/{cycleId}/lines');
  console.log('   Save response to docs/current.md');
  console.log('8. Create bulk trades: use create-bulk-trades command');
  console.log('9. Close cycle: POST /ledger/cycles/{cycleId}/close');
  console.log('   (This triggers rollover buyback)');
  console.log('10. Verify buyback in database (check sell_allocations)');
  console.log('11. Create next cycle and participation (repeat 2-5)');
  console.log('12. Open next cycle: POST /ledger/cycles/{newCycleId}/open');
  console.log('    (This triggers rollover purchase)');
  console.log('13. Verify rollover (check cycle_lines, buy_allocations)\n');
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
            'Usage: pnpm exec ts-node scripts/test-rollover-setup.ts create-donation --characterId <id> --amount <isk> --reason <memo>',
          );
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
            'Usage: pnpm exec ts-node scripts/test-rollover-setup.ts create-trades --cycleId <id> --lineId <id> --characterId <id> --typeId <id> --stationId <id> --buyUnits <n> --buyPrice <price> --sellUnits <n> --sellPrice <price>',
          );
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

      case 'create-bulk-trades': {
        const characterId = parseInt(args[args.indexOf('--characterId') + 1]);
        const jsonFile = args[args.indexOf('--jsonFile') + 1];
        const sellPercentageIdx = args.indexOf('--sellPercentage');
        const sellPercentage =
          sellPercentageIdx !== -1
            ? parseInt(args[sellPercentageIdx + 1])
            : undefined; // undefined = use varied distribution
        const skipBuys = args.includes('--skipBuys');

        if (!characterId || !jsonFile) {
          console.error('❌ Missing required arguments');
          console.log(
            'Usage: pnpm exec ts-node scripts/test-rollover-setup.ts create-bulk-trades --characterId <id> --jsonFile <path> [--sellPercentage <0-100>] [--skipBuys]',
          );
          console.log(
            '\nExample: pnpm exec ts-node scripts/test-rollover-setup.ts create-bulk-trades --characterId 123456 --jsonFile docs/current.md --sellPercentage 65',
          );
          console.log(
            '\nWith --skipBuys flag: Items will have no buy cost, testing Jita price fallback',
          );
          process.exit(1);
        }

        // Read and parse JSON file
        const fs = require('fs');
        const fileContent = fs.readFileSync(jsonFile, 'utf-8');
        const cycleLines = JSON.parse(fileContent) as CycleLineInput[];

        console.log(
          `📖 Loaded ${cycleLines.length} cycle lines from ${jsonFile}`,
        );

        await createBulkTrades({
          characterId,
          cycleLines,
          sellPercentage,
          skipBuys,
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
