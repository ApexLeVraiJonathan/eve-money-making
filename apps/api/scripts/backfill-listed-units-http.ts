/**
 * Backfill script for listedUnits field (HTTP version)
 * 
 * Uses the running API to fetch data with automatic token refresh
 * 
 * Usage:
 *   npx ts-node scripts/backfill-listed-units-http.ts [options]
 * 
 * Options:
 *   --dry-run              Only log changes, don't write to database
 *   --cycle-id <uuid>      Only process lines for a specific cycle
 *   --status <status>      Only process cycles with specific status
 *   --api-key <key>        API key for authentication (required)
 */

import { PrismaClient } from '@eve/prisma';

const API_BASE = 'http://localhost:3000';
const API_KEY = '0xx5uLdlwYJT9PuCpoGSc0ATkye46cPx';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    cycleId: undefined as string | undefined,
    status: undefined as string | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--cycle-id' && i + 1 < args.length) options.cycleId = args[++i];
    else if (arg === '--status' && i + 1 < args.length) options.status = args[++i];
  }

  return options;
}

async function main() {
  const { dryRun, cycleId: targetCycleId, status: targetStatus } = parseArgs();
  const prisma = new PrismaClient();

  console.log('='.repeat(80));
  console.log('Backfill listedUnits Script (HTTP version)');
  console.log('='.repeat(80));
  console.log(`DRY_RUN: ${dryRun}`);
  if (targetCycleId) console.log(`Target Cycle: ${targetCycleId}`);
  if (targetStatus) console.log(`Target Status: ${targetStatus}`);
  console.log('');

  try {
    // Step 1: Call undercut-check to get all sell orders (this refreshes tokens automatically)
    console.log('Fetching sell orders via undercut-check endpoint...');
    const undercutResponse = await fetch(`${API_BASE}/pricing/undercut-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({}),
    });

    if (!undercutResponse.ok) {
      throw new Error(`Undercut check failed: ${undercutResponse.status}`);
    }

    const undercutData = await undercutResponse.json();
    
    // Build order volume map from undercut data
    const orderVolumeMap = new Map<string, number>();
    for (const group of undercutData) {
      for (const update of group.updates) {
        const key = `${group.stationId}:${update.typeId}`;
        const current = orderVolumeMap.get(key) ?? 0;
        orderVolumeMap.set(key, current + update.remaining);
      }
    }

    console.log(`Found ${orderVolumeMap.size} unique station:type combinations with active orders\n`);

    // Step 2: Get target cycles
    const whereClause: any = {};
    if (targetCycleId) whereClause.id = targetCycleId;
    if (targetStatus) whereClause.status = targetStatus;

    const cycles = await prisma.cycle.findMany({
      where: whereClause,
      select: { id: true, name: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    if (cycles.length === 0) {
      console.warn('No cycles found matching criteria');
      await prisma.$disconnect();
      return;
    }

    console.log(`Found ${cycles.length} cycle(s) to process\n`);

    // Step 3: Process each cycle
    let totalLinesProcessed = 0;
    let totalLinesUpdated = 0;

    for (const cycle of cycles) {
      console.log('-'.repeat(80));
      console.log(`Processing Cycle: ${cycle.name || cycle.id.slice(0, 8)} (${cycle.status})`);
      console.log('-'.repeat(80));

      const lines = await prisma.cycleLine.findMany({
        where: { cycleId: cycle.id },
        select: {
          id: true,
          typeId: true,
          destinationStationId: true,
          plannedUnits: true,
          unitsBought: true,
          unitsSold: true,
          listedUnits: true,
        },
      });

      console.log(`Found ${lines.length} line(s) in cycle\n`);

      for (const line of lines) {
        totalLinesProcessed++;

        // Calculate what listedUnits should be
        const baseListedFromSales = line.unitsSold;
        const key = `${line.destinationStationId}:${line.typeId}`;
        const listedFromOrders = orderVolumeMap.get(key) ?? 0;

        // Sum and clamp to unitsBought
        const calculatedListedUnits = Math.min(
          baseListedFromSales + listedFromOrders,
          line.unitsBought,
        );

        // Only update if different
        if (calculatedListedUnits !== line.listedUnits) {
          totalLinesUpdated++;

          const remainingUnits = Math.max(0, line.unitsBought - line.unitsSold);
          const oldUnlisted = Math.max(0, remainingUnits - line.listedUnits);
          const newUnlisted = Math.max(0, remainingUnits - calculatedListedUnits);

          console.log(`Line ${line.id.slice(0, 8)}: typeId=${line.typeId}, station=${line.destinationStationId}`);
          console.log(`  Units: bought=${line.unitsBought}, sold=${line.unitsSold}, remaining=${remainingUnits}`);
          console.log(`  Listed: current=${line.listedUnits} -> calculated=${calculatedListedUnits}`);
          console.log(`    (from sales=${baseListedFromSales} + from orders=${listedFromOrders})`);
          console.log(`  Unlisted: old=${oldUnlisted} -> new=${newUnlisted}`);

          if (!dryRun) {
            await prisma.cycleLine.update({
              where: { id: line.id },
              data: { listedUnits: calculatedListedUnits },
            });
            console.log(`  ✓ Updated`);
          } else {
            console.log(`  [DRY RUN - would update]`);
          }
          console.log('');
        }
      }
    }

    console.log('='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));
    console.log(`Total lines processed: ${totalLinesProcessed}`);
    console.log(`Total lines updated: ${totalLinesUpdated}`);
    console.log(`Total lines unchanged: ${totalLinesProcessed - totalLinesUpdated}`);
    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes written to database');
      console.log('Run without --dry-run to apply changes');
    } else {
      console.log('\n✓ Changes written to database');
    }
  } catch (error) {
    console.error('Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\nBackfill script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nBackfill script failed:', error);
    process.exit(1);
  });

