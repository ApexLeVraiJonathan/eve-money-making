#!/usr/bin/env tsx
/**
 * Consolidate Duplicate Cycle Lines Script
 * 
 * This script fixes duplicate cycle lines that were created due to the planner bug
 * where items split across multiple packages to the same destination created
 * separate cycle lines instead of being consolidated.
 * 
 * What it does:
 * 1. Finds groups of cycle lines with the same (cycleId, typeId, destinationStationId)
 * 2. For each group with duplicates:
 *    - Consolidates all data into one "primary" line
 *    - Sums: plannedUnits, unitsBought, buyCostIsk, unitsSold, salesGrossIsk, salesTaxIsk, salesNetIsk, relistFeesIsk
 *    - DIVIDES: brokerFeesIsk by the number of duplicates (fixes the sell-appraiser multiplication bug)
 *    - Finds: currentSellPriceIsk from whichever line has it (only one will be non-null)
 *    - Keeps: isRollover and rollover fields from first line (all will be the same)
 *    - Migrates all related records (buyAllocations, sellAllocations, packageLinks) to the primary line
 *    - Deletes the duplicate lines
 * 3. Validates and fixes broker fees on cycle lines that have broker fees > 0:
 *    - Uses unitsBought (if > 0) or plannedUnits for the quantity
 *    - Expected broker fee = units × currentSellPriceIsk × 0.015 (1.5%)
 *    - Fixes any lines that have incorrect broker fees (e.g. from manual consolidation)
 *    - Skips lines with brokerFeesIsk = 0 (not yet listed)
 * 
 * Usage:
 *   # Dry run (preview what will be consolidated)
 *   npx tsx scripts/consolidate-duplicate-cycle-lines.ts
 * 
 *   # Actually perform the consolidation
 *   npx tsx scripts/consolidate-duplicate-cycle-lines.ts --execute
 * 
 *   # Consolidate without broker fee validation
 *   npx tsx scripts/consolidate-duplicate-cycle-lines.ts --execute --skip-broker-validation
 * 
 *   # Consolidate only a specific cycle
 *   npx tsx scripts/consolidate-duplicate-cycle-lines.ts --cycle-id=<cycleId> --execute
 */

import { PrismaClient } from '@eve/prisma';

const prisma = new PrismaClient();

interface DuplicateGroup {
  cycleId: string;
  typeId: number;
  destinationStationId: number;
  lines: Array<{
    id: string;
    plannedUnits: number;
    unitsBought: number;
    buyCostIsk: number;
    unitsSold: number;
    salesGrossIsk: number;
    salesTaxIsk: number;
    salesNetIsk: number;
    brokerFeesIsk: number;
    relistFeesIsk: number;
    currentSellPriceIsk: number | null;
    isRollover: boolean;
    rolloverFromCycleId: string | null;
    rolloverFromLineId: string | null;
  }>;
}

async function findDuplicateGroups(cycleIdFilter?: string): Promise<DuplicateGroup[]> {
  console.log('🔍 Searching for duplicate cycle lines...\n');

  const whereClause = cycleIdFilter ? { cycleId: cycleIdFilter } : {};

  const allLines = await prisma.cycleLine.findMany({
    where: whereClause,
    select: {
      id: true,
      cycleId: true,
      typeId: true,
      destinationStationId: true,
      plannedUnits: true,
      unitsBought: true,
      buyCostIsk: true,
      unitsSold: true,
      salesGrossIsk: true,
      salesTaxIsk: true,
      salesNetIsk: true,
      brokerFeesIsk: true,
      relistFeesIsk: true,
      currentSellPriceIsk: true,
      isRollover: true,
      rolloverFromCycleId: true,
      rolloverFromLineId: true,
    },
    orderBy: [
      { cycleId: 'asc' },
      { typeId: 'asc' },
      { destinationStationId: 'asc' },
      { createdAt: 'asc' }, // Primary will be the oldest
    ],
  });

  // Group by cycleId + typeId + destinationStationId
  const groupMap = new Map<string, DuplicateGroup>();

  for (const line of allLines) {
    const key = `${line.cycleId}|${line.typeId}|${line.destinationStationId}`;
    
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        cycleId: line.cycleId,
        typeId: line.typeId,
        destinationStationId: line.destinationStationId,
        lines: [],
      });
    }

    const group = groupMap.get(key)!;
    group.lines.push({
      id: line.id,
      plannedUnits: line.plannedUnits,
      unitsBought: line.unitsBought,
      buyCostIsk: Number(line.buyCostIsk),
      unitsSold: line.unitsSold,
      salesGrossIsk: Number(line.salesGrossIsk),
      salesTaxIsk: Number(line.salesTaxIsk),
      salesNetIsk: Number(line.salesNetIsk),
      brokerFeesIsk: Number(line.brokerFeesIsk),
      relistFeesIsk: Number(line.relistFeesIsk),
      currentSellPriceIsk: line.currentSellPriceIsk ? Number(line.currentSellPriceIsk) : null,
      isRollover: line.isRollover,
      rolloverFromCycleId: line.rolloverFromCycleId,
      rolloverFromLineId: line.rolloverFromLineId,
    });
  }

  // Filter to only groups with duplicates (more than 1 line)
  const duplicateGroups = Array.from(groupMap.values()).filter(g => g.lines.length > 1);

  return duplicateGroups;
}

async function getTypeNames(typeIds: number[]): Promise<Map<number, string>> {
  const types = await prisma.typeId.findMany({
    where: { id: { in: typeIds } },
    select: { id: true, name: true },
  });

  return new Map(types.map(t => [t.id, t.name]));
}

async function consolidateGroup(group: DuplicateGroup, execute: boolean): Promise<void> {
  const { cycleId, typeId, destinationStationId, lines } = group;
  const duplicateCount = lines.length;

  // Primary line is the first one (will be kept)
  const primaryLine = lines[0];
  const duplicateLines = lines.slice(1);

  // Find the line that has the currentSellPriceIsk (if any)
  // Since only one line will have the price, the others will be null
  const lineWithPrice = lines.find(l => l.currentSellPriceIsk !== null);
  const currentSellPriceIsk = lineWithPrice?.currentSellPriceIsk ?? null;

  // Calculate consolidated values
  const consolidated = {
    plannedUnits: lines.reduce((sum, l) => sum + l.plannedUnits, 0),
    unitsBought: lines.reduce((sum, l) => sum + l.unitsBought, 0),
    buyCostIsk: lines.reduce((sum, l) => sum + l.buyCostIsk, 0),
    unitsSold: lines.reduce((sum, l) => sum + l.unitsSold, 0),
    salesGrossIsk: lines.reduce((sum, l) => sum + l.salesGrossIsk, 0),
    salesTaxIsk: lines.reduce((sum, l) => sum + l.salesTaxIsk, 0),
    salesNetIsk: lines.reduce((sum, l) => sum + l.salesNetIsk, 0),
    relistFeesIsk: lines.reduce((sum, l) => sum + l.relistFeesIsk, 0),
    // IMPORTANT: Divide broker fees by duplicate count to fix the multiplication bug
    brokerFeesIsk: lines.reduce((sum, l) => sum + l.brokerFeesIsk, 0) / duplicateCount,
    // Use the currentSellPriceIsk from whichever line has it (only one will be non-null)
    currentSellPriceIsk: currentSellPriceIsk,
    // Keep rollover info from primary (all duplicates will have same values since bug doesn't affect rollover)
    isRollover: primaryLine.isRollover,
    rolloverFromCycleId: primaryLine.rolloverFromCycleId,
    rolloverFromLineId: primaryLine.rolloverFromLineId,
  };

  if (!execute) {
    // Dry run - just display what would happen
    console.log(`  Primary Line ID: ${primaryLine.id.slice(0, 8)}...`);
    console.log(`  Duplicate Line IDs: ${duplicateLines.map(l => l.id.slice(0, 8) + '...').join(', ')}`);
    console.log(`  Consolidated Values:`);
    console.log(`    - plannedUnits: ${lines.map(l => l.plannedUnits).join(' + ')} = ${consolidated.plannedUnits}`);
    console.log(`    - unitsBought: ${lines.map(l => l.unitsBought).join(' + ')} = ${consolidated.unitsBought}`);
    console.log(`    - buyCostIsk: ${lines.map(l => l.buyCostIsk.toFixed(2)).join(' + ')} = ${consolidated.buyCostIsk.toFixed(2)} ISK`);
    console.log(`    - unitsSold: ${lines.map(l => l.unitsSold).join(' + ')} = ${consolidated.unitsSold}`);
    console.log(`    - salesGrossIsk: ${lines.map(l => l.salesGrossIsk.toFixed(2)).join(' + ')} = ${consolidated.salesGrossIsk.toFixed(2)} ISK`);
    console.log(`    - salesTaxIsk: ${lines.map(l => l.salesTaxIsk.toFixed(2)).join(' + ')} = ${consolidated.salesTaxIsk.toFixed(2)} ISK`);
    console.log(`    - salesNetIsk: ${lines.map(l => l.salesNetIsk.toFixed(2)).join(' + ')} = ${consolidated.salesNetIsk.toFixed(2)} ISK`);
    console.log(`    - brokerFeesIsk: (${lines.map(l => l.brokerFeesIsk.toFixed(2)).join(' + ')}) / ${duplicateCount} = ${consolidated.brokerFeesIsk.toFixed(2)} ISK`);
    console.log(`    - relistFeesIsk: ${lines.map(l => l.relistFeesIsk.toFixed(2)).join(' + ')} = ${consolidated.relistFeesIsk.toFixed(2)} ISK`);
    if (consolidated.currentSellPriceIsk !== null) {
      console.log(`    - currentSellPriceIsk: ${consolidated.currentSellPriceIsk.toFixed(2)} ISK (from line with non-null value)`);
    }
    return;
  }

  // Execute consolidation in a transaction
  await prisma.$transaction(async (tx) => {
    // 1. Update the primary line with consolidated values
    await tx.cycleLine.update({
      where: { id: primaryLine.id },
      data: {
        plannedUnits: consolidated.plannedUnits,
        unitsBought: consolidated.unitsBought,
        buyCostIsk: consolidated.buyCostIsk.toFixed(2),
        unitsSold: consolidated.unitsSold,
        salesGrossIsk: consolidated.salesGrossIsk.toFixed(2),
        salesTaxIsk: consolidated.salesTaxIsk.toFixed(2),
        salesNetIsk: consolidated.salesNetIsk.toFixed(2),
        brokerFeesIsk: consolidated.brokerFeesIsk.toFixed(2),
        relistFeesIsk: consolidated.relistFeesIsk.toFixed(2),
        currentSellPriceIsk: consolidated.currentSellPriceIsk?.toFixed(2) ?? null,
      },
    });

    // 2. Migrate related records from duplicate lines to primary line
    for (const dupLine of duplicateLines) {
      // Migrate BuyAllocations
      const buyAllocations = await tx.buyAllocation.findMany({
        where: { lineId: dupLine.id },
      });
      
      for (const alloc of buyAllocations) {
        // Check if this allocation already exists for the primary line
        const existingAlloc = await tx.buyAllocation.findFirst({
          where: {
            walletCharacterId: alloc.walletCharacterId,
            walletTransactionId: alloc.walletTransactionId,
            lineId: primaryLine.id,
          },
        });

        if (existingAlloc) {
          // If it exists, sum the quantities and delete the duplicate
          await tx.buyAllocation.update({
            where: { id: existingAlloc.id },
            data: { quantity: existingAlloc.quantity + alloc.quantity },
          });
          await tx.buyAllocation.delete({ where: { id: alloc.id } });
        } else {
          // Otherwise, just update the lineId to point to primary
          await tx.buyAllocation.update({
            where: { id: alloc.id },
            data: { lineId: primaryLine.id },
          });
        }
      }

      // Migrate SellAllocations
      const sellAllocations = await tx.sellAllocation.findMany({
        where: { lineId: dupLine.id },
      });
      
      for (const alloc of sellAllocations) {
        const existingAlloc = await tx.sellAllocation.findFirst({
          where: {
            walletCharacterId: alloc.walletCharacterId,
            walletTransactionId: alloc.walletTransactionId,
            lineId: primaryLine.id,
          },
        });

        if (existingAlloc) {
          // Sum quantities and revenues, delete duplicate
          await tx.sellAllocation.update({
            where: { id: existingAlloc.id },
            data: {
              quantity: existingAlloc.quantity + alloc.quantity,
              revenueIsk: Number(existingAlloc.revenueIsk) + Number(alloc.revenueIsk),
              taxIsk: Number(existingAlloc.taxIsk) + Number(alloc.taxIsk),
            },
          });
          await tx.sellAllocation.delete({ where: { id: alloc.id } });
        } else {
          await tx.sellAllocation.update({
            where: { id: alloc.id },
            data: { lineId: primaryLine.id },
          });
        }
      }

      // Migrate PackageCycleLines
      const packageLinks = await tx.packageCycleLine.findMany({
        where: { cycleLineId: dupLine.id },
      });
      
      for (const link of packageLinks) {
        const existingLink = await tx.packageCycleLine.findFirst({
          where: {
            packageId: link.packageId,
            cycleLineId: primaryLine.id,
          },
        });

        if (existingLink) {
          // Sum units committed, delete duplicate
          await tx.packageCycleLine.update({
            where: { id: existingLink.id },
            data: { unitsCommitted: existingLink.unitsCommitted + link.unitsCommitted },
          });
          await tx.packageCycleLine.delete({ where: { id: link.id } });
        } else {
          await tx.packageCycleLine.update({
            where: { id: link.id },
            data: { cycleLineId: primaryLine.id },
          });
        }
      }

      // 3. Delete the duplicate line
      await tx.cycleLine.delete({ where: { id: dupLine.id } });
    }

    console.log(`  ✅ Consolidated ${duplicateCount} lines into one (${primaryLine.id.slice(0, 8)}...)`);
    console.log(`     - Total units: ${consolidated.unitsSold}`);
    console.log(`     - Corrected broker fees: ${consolidated.brokerFeesIsk.toFixed(2)} ISK (was ${lines.reduce((sum, l) => sum + l.brokerFeesIsk, 0).toFixed(2)} ISK)`);
  });
}

async function validateAndFixBrokerFees(cycleIdFilter: string | undefined, execute: boolean): Promise<number> {
  console.log('\n🔍 Validating broker fees on all cycle lines...\n');

  const whereClause = cycleIdFilter ? { cycleId: cycleIdFilter } : {};

  // Find all lines that have been listed (have currentSellPriceIsk)
  // We'll filter for brokerFeesIsk > 0 in JavaScript after fetching
  const allLines = await prisma.cycleLine.findMany({
    where: {
      ...whereClause,
      currentSellPriceIsk: { not: null },
    },
    select: {
      id: true,
      cycleId: true,
      typeId: true,
      destinationStationId: true,
      plannedUnits: true,
      unitsBought: true,
      currentSellPriceIsk: true,
      brokerFeesIsk: true,
    },
  });

  // Filter to only lines with broker fees > 0 (already listed)
  const linesWithBrokerFees = allLines.filter(line => {
    const brokerFee = Number(line.brokerFeesIsk);
    return brokerFee > 0;
  });

  if (linesWithBrokerFees.length === 0) {
    console.log('✅ No lines with broker fees to validate.');
    return 0;
  }

  console.log(`Found ${linesWithBrokerFees.length} lines with broker fees set. Validating...\n`);

  const BROKER_FEE_RATE = 0.015; // 1.5%
  const TOLERANCE = 0.01; // Allow 1 cent difference for rounding

  const linesToFix: Array<{
    id: string;
    typeId: number;
    currentBrokerFee: number;
    expectedBrokerFee: number;
    units: number;
    currentSellPriceIsk: number;
  }> = [];

  for (const line of linesWithBrokerFees) {
    // Use unitsBought if > 0 (production), otherwise use plannedUnits (dev)
    const units = line.unitsBought > 0 ? line.unitsBought : line.plannedUnits;
    const currentSellPriceIsk = Number(line.currentSellPriceIsk!);
    const currentBrokerFee = Number(line.brokerFeesIsk);

    // Calculate expected broker fee
    const expectedBrokerFee = units * currentSellPriceIsk * BROKER_FEE_RATE;

    // Check if current broker fee is incorrect (outside tolerance)
    if (Math.abs(currentBrokerFee - expectedBrokerFee) > TOLERANCE) {
      linesToFix.push({
        id: line.id,
        typeId: line.typeId,
        currentBrokerFee,
        expectedBrokerFee,
        units,
        currentSellPriceIsk,
      });
    }
  }

  if (linesToFix.length === 0) {
    console.log(`✅ All ${allLines.length} lines have correct broker fees!`);
    return 0;
  }

  console.log(`Found ${linesToFix.length} lines with incorrect broker fees:\n`);

  // Get type names for display
  const typeIds = [...new Set(linesToFix.map(l => l.typeId))];
  const typeNameMap = await getTypeNames(typeIds);

  for (let i = 0; i < linesToFix.length; i++) {
    const line = linesToFix[i];
    const typeName = typeNameMap.get(line.typeId) || `Type ${line.typeId}`;
    
    console.log(`${i + 1}. ${typeName}`);
    console.log(`   Line ID: ${line.id.slice(0, 8)}...`);
    console.log(`   Units: ${line.units.toLocaleString()}`);
    console.log(`   Sell Price: ${line.currentSellPriceIsk.toFixed(2)} ISK`);
    console.log(`   Current Broker Fee: ${line.currentBrokerFee.toFixed(2)} ISK`);
    console.log(`   Expected Broker Fee: ${line.expectedBrokerFee.toFixed(2)} ISK`);
    console.log(`   Difference: ${(line.currentBrokerFee - line.expectedBrokerFee).toFixed(2)} ISK`);

    if (execute) {
      await prisma.cycleLine.update({
        where: { id: line.id },
        data: { brokerFeesIsk: line.expectedBrokerFee.toFixed(2) },
      });
      console.log(`   ✅ Fixed!`);
    }
    console.log('');
  }

  return linesToFix.length;
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const skipBrokerValidation = args.includes('--skip-broker-validation');
  const cycleIdArg = args.find(arg => arg.startsWith('--cycle-id='));
  const cycleIdFilter = cycleIdArg ? cycleIdArg.split('=')[1] : undefined;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Consolidate Duplicate Cycle Lines Script');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Mode: ${execute ? '🔴 EXECUTE' : '🔵 DRY RUN (preview only)'}`);
  if (cycleIdFilter) {
    console.log(`  Cycle Filter: ${cycleIdFilter}`);
  }
  if (skipBrokerValidation) {
    console.log(`  Broker Validation: SKIPPED`);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!execute) {
    console.log('⚠️  This is a DRY RUN. No changes will be made.');
    console.log('   To actually consolidate lines, run with --execute flag.\n');
  }

  // STEP 1: Find and consolidate duplicate groups
  const duplicateGroups = await findDuplicateGroups(cycleIdFilter);

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate cycle lines found!');
  } else {
    console.log(`Found ${duplicateGroups.length} groups with duplicate cycle lines:\n`);

    // Get type names for display
    const allTypeIds = [...new Set(duplicateGroups.map(g => g.typeId))];
    const typeNameMap = await getTypeNames(allTypeIds);

    // Process each group
    for (let i = 0; i < duplicateGroups.length; i++) {
      const group = duplicateGroups[i];
      const typeName = typeNameMap.get(group.typeId) || `Type ${group.typeId}`;
      
      console.log(`${i + 1}. ${typeName} → Station ${group.destinationStationId}`);
      console.log(`   Cycle: ${group.cycleId.slice(0, 8)}...`);
      console.log(`   Duplicate Count: ${group.lines.length} lines`);

      await consolidateGroup(group, execute);
      console.log('');
    }

    if (execute) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`✅ Successfully consolidated ${duplicateGroups.length} duplicate groups!`);
      console.log('═══════════════════════════════════════════════════════════════');
    } else {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`📋 Summary: ${duplicateGroups.length} groups would be consolidated`);
      console.log('   Run with --execute to perform the consolidation');
      console.log('═══════════════════════════════════════════════════════════════');
    }
  }

  // STEP 2: Validate and fix broker fees on all lines
  // Note: Only run this AFTER consolidation is complete (in execute mode)
  // In dry run, broker fees might appear wrong because they're for unconsolidated data
  if (!skipBrokerValidation && (execute || duplicateGroups.length === 0)) {
    const fixedCount = await validateAndFixBrokerFees(cycleIdFilter, execute);

    if (fixedCount > 0) {
      if (execute) {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(`✅ Fixed broker fees on ${fixedCount} cycle lines!`);
        console.log('═══════════════════════════════════════════════════════════════');
      } else {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(`📋 Summary: ${fixedCount} lines would have broker fees corrected`);
        console.log('   Run with --execute to perform the fixes');
        console.log('═══════════════════════════════════════════════════════════════');
      }
    }
  } else if (skipBrokerValidation) {
    console.log('\n📝 Note: Broker fee validation skipped (--skip-broker-validation flag).');
  } else {
    console.log('\n📝 Note: Broker fee validation skipped in dry run mode when duplicates exist.');
    console.log('   Broker fees will be validated after consolidation in execute mode.');
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

