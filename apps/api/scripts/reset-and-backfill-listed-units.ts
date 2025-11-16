import { PrismaClient } from '@eve/prisma';

/**
 * Backfill script to recalculate listedUnits for all cycle lines
 *
 * Logic:
 * 1. Fetch all sell orders from seller characters via API
 * 2. Group orders by typeId + stationId, sum volume_total (original listed amount)
 * 3. For each cycle line, calculate listedUnits:
 *    listedUnits = min(ESI_volume_total + unitsSold, unitsBought)
 *    - ESI_volume_total: currently listed units from active orders
 *    - unitsSold: units that were sold (were listed before)
 *    - unitsBought: hard cap (can't list more than you bought)
 * 4. Update cycle lines with the calculated listedUnits
 *
 * Note: This script requires the API to be running to fetch orders with token refresh
 *
 * Run with: npx ts-node apps/api/scripts/reset-and-backfill-listed-units.ts [--dry-run] [--cycle-id <id>] [--status <status>]
 */

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let cycleId: string | null = null;
  let status: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--cycle-id' && i + 1 < args.length) {
      cycleId = args[i + 1];
      i++;
    } else if (args[i] === '--status' && i + 1 < args.length) {
      status = args[i + 1];
      i++;
    }
  }

  return { dryRun, cycleId, status };
}

async function main() {
  const { dryRun, cycleId: targetCycleId, status: targetStatus } = parseArgs();

  console.log('='.repeat(80));
  console.log('Backfill listedUnits Script');
  console.log('='.repeat(80));
  console.log(`DRY_RUN: ${dryRun}`);
  if (targetCycleId) console.log(`TARGET_CYCLE_ID: ${targetCycleId}`);
  if (targetStatus) console.log(`TARGET_STATUS: ${targetStatus}`);
  console.log('');

  const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
  const API_KEY = process.env.API_KEY || '0xx5uLdlwYJT9PuCpoGSc0ATkye46cPx';

  try {
    // Step 1: Fetch all sell orders from API (which handles ESI and token refresh)
    console.log('Fetching sell orders from API...');
    console.log(`API URL: ${API_BASE_URL}`);

    // Call undercut-check to get orders (it will refresh tokens as needed)
    const undercutResponse = await fetch(
      `${API_BASE_URL}/pricing/undercut-check`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': API_KEY,
        },
        body: JSON.stringify({}),
      },
    );

    if (!undercutResponse.ok) {
      throw new Error(
        `Failed to fetch orders: ${undercutResponse.status} ${undercutResponse.statusText}`,
      );
    }

    const undercutData = await undercutResponse.json();

    // We need to get character orders directly to access volume_total
    // The undercut-check response doesn't include it
    // So we need to call a different endpoint or extend undercut-check

    console.log(
      '\n⚠️  NOTE: The undercut-check endpoint does not return volume_total',
    );
    console.log(
      'We need character orders with volume_total (original listed amount)',
    );
    console.log('');
    console.log(
      'For now, this script will use the API to get characters and their orders',
    );
    console.log('');

    // Get all characters and filter for sellers
    console.log('Fetching characters from API...');
    const charactersResponse = await fetch(`${API_BASE_URL}/auth/admin/characters`, {
      headers: {
        'X-Api-Key': API_KEY,
      },
    });

    if (!charactersResponse.ok) {
      throw new Error(
        `Failed to fetch characters: ${charactersResponse.status} ${charactersResponse.statusText}`,
      );
    }

    const allCharacters = await charactersResponse.json();
    const characters = allCharacters.filter(
      (c: any) => c.function === 'SELLER',
    );
    console.log(
      `Found ${characters.length} seller character(s) (out of ${allCharacters.length} total)\n`,
    );

    // Fetch orders for each character
    console.log('Fetching orders for each character...');
    const allOrders: Array<{
      type_id: number;
      volume_total: number;
      volume_remain: number;
      location_id: number;
    }> = [];

    for (const char of characters) {
      try {
        // Use characterId from the API response
        const ordersResponse = await fetch(
          `${API_BASE_URL}/auth/admin/characters/${char.characterId}/orders`,
          {
            headers: {
              'X-Api-Key': API_KEY,
            },
          },
        );

        if (ordersResponse.ok) {
          const orders = await ordersResponse.json();
          for (const order of orders) {
            if (!order.is_buy_order) {
              // Only sell orders
              allOrders.push({
                type_id: order.type_id,
                volume_total: order.volume_total,
                volume_remain: order.volume_remain,
                location_id: order.location_id,
              });
            }
          }
        } else {
          console.warn(
            `Failed to fetch orders for character ${char.characterId}: ${ordersResponse.status}`,
          );
        }
      } catch (error) {
        console.warn(
          `Error fetching orders for character ${char.characterId}:`,
          error,
        );
      }
    }

    console.log(`Found ${allOrders.length} active sell order(s)\n`);

    // Step 2: Group orders by station:typeId and sum volume_total
    // Key: "stationId:typeId", Value: total volume_total
    const listedUnitsMap = new Map<string, number>();
    for (const order of allOrders) {
      const key = `${order.location_id}:${order.type_id}`;
      const current = listedUnitsMap.get(key) ?? 0;
      listedUnitsMap.set(key, current + order.volume_total);
    }

    console.log(
      `Aggregated into ${listedUnitsMap.size} unique station:type combinations\n`,
    );

    // Step 3: Get cycles to process
    const whereClause: any = {};
    if (targetCycleId) {
      whereClause.id = targetCycleId;
    } else if (targetStatus) {
      whereClause.status = targetStatus;
    }

    const cycles = await prisma.cycle.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Found ${cycles.length} cycle(s) to process\n`);

    let totalLinesProcessed = 0;
    let totalLinesUpdated = 0;

    for (const cycle of cycles) {
      console.log('-'.repeat(80));
      console.log(`Processing Cycle: ${cycle.name} (${cycle.status})`);
      console.log('-'.repeat(80));

      const lines = await prisma.cycleLine.findMany({
        where: { cycleId: cycle.id },
        select: {
          id: true,
          typeId: true,
          destinationStationId: true,
          unitsBought: true,
          listedUnits: true,
          unitsSold: true,
        },
      });

      console.log(`Found ${lines.length} line(s) in cycle\n`);
      totalLinesProcessed += lines.length;

      // Update listedUnits based on active orders + units sold (conditionally)
      for (const line of lines) {
        const key = `${line.destinationStationId}:${line.typeId}`;
        const currentlyListedFromESI = listedUnitsMap.get(key) || 0;
        const unitsSold = line.unitsSold || 0;

        // Calculate total listed units:
        // ONLY add unitsSold if:
        // 1. listedUnits < unitsBought (there are unlisted units)
        // 2. AND ESI < unitsBought (ESI shows less than bought)
        // This means some units were sold (they were listed before selling)
        let totalListedUnits;
        let calculationNote = '';

        if (
          line.listedUnits < line.unitsBought &&
          currentlyListedFromESI < line.unitsBought
        ) {
          // Add sold units because they were listed before being sold
          totalListedUnits = Math.min(
            currentlyListedFromESI + unitsSold,
            line.unitsBought,
          );
          calculationNote = 'ESI + sold, capped at bought';
        } else {
          // Just use ESI data, capped at bought
          totalListedUnits = Math.min(currentlyListedFromESI, line.unitsBought);
          calculationNote = 'ESI only, capped at bought';
        }

        // Only update if there's a change
        if (totalListedUnits !== line.listedUnits) {
          const oldUnlisted = Math.max(0, line.unitsBought - line.listedUnits);
          const newUnlisted = Math.max(0, line.unitsBought - totalListedUnits);

          console.log(
            `Line ${line.id.slice(0, 8)}: typeId=${line.typeId}, station=${line.destinationStationId}`,
          );
          console.log(
            `  Units: bought=${line.unitsBought}, sold=${unitsSold}`,
          );
          console.log(`  ESI currently listed: ${currentlyListedFromESI}`);
          console.log(
            `  Listed: ${line.listedUnits} -> ${totalListedUnits} (${calculationNote})`,
          );
          console.log(`  Unlisted: ${oldUnlisted} -> ${newUnlisted}`);

          if (!dryRun) {
            await prisma.cycleLine.update({
              where: { id: line.id },
              data: { listedUnits: totalListedUnits },
            });
            console.log(`  ✓ Updated`);
          } else {
            console.log(`  [DRY RUN - would update]`);
          }
          console.log('');

          totalLinesUpdated++;
        }
      }
    }

    console.log('='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));
    console.log(`Total lines processed: ${totalLinesProcessed}`);
    console.log(`Total lines updated: ${totalLinesUpdated}`);
    console.log(
      `Total lines unchanged (already correct): ${totalLinesProcessed - totalLinesUpdated}`,
    );

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
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
