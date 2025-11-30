/**
 * Fix script for listedUnits on rollover cycle lines.
 *
 * Context:
 * - When `listed_units` was introduced on `cycle_lines`, rollover logic
 *   forgot to mark rolled-over inventory as already listed.
 * - This script backfills `listedUnits` for existing rollover lines so that
 *   they correctly reflect that all rollover units have been listed.
 *
 * Behaviour:
 * - Targets only `cycleLine` rows where:
 *     - isRollover = true
 *     - unitsBought > 0
 *     - listedUnits < unitsBought (default) or == 0 in strict mode
 * - Sets:
 *     listedUnits = unitsBought
 *
 * Usage:
 *   pnpm ts-node apps/api/scripts/fix-rollover-listed-units.ts [options]
 *
 * Options:
 *   --dry-run            Only log changes, do not write to the database
 *   --cycle-id <uuid>    Limit to a single cycle
 *   --status <status>    Limit to cycles with a given status (OPEN, COMPLETED, etc.)
 *   --only-zero          Only touch lines where listedUnits is currently 0
 */

import { PrismaClient } from '@eve/prisma';

const prisma = new PrismaClient();

type CliOptions = {
  dryRun: boolean;
  cycleId?: string;
  status?: string;
  onlyZero: boolean;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    dryRun: false,
    cycleId: undefined,
    status: undefined,
    onlyZero: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--cycle-id' && i + 1 < args.length) {
      opts.cycleId = args[i + 1];
      i += 1;
    } else if (arg === '--status' && i + 1 < args.length) {
      opts.status = args[i + 1];
      i += 1;
    } else if (arg === '--only-zero') {
      opts.onlyZero = true;
    }
  }

  return opts;
}

async function main() {
  const { dryRun, cycleId, status, onlyZero } = parseArgs();

  console.log('='.repeat(80));
  console.log('Fix Rollover listedUnits Script');
  console.log('='.repeat(80));
  console.log(`DRY_RUN   : ${dryRun}`);
  if (cycleId) console.log(`CYCLE_ID  : ${cycleId}`);
  if (status) console.log(`STATUS    : ${status}`);
  console.log(`ONLY_ZERO : ${onlyZero}`);
  console.log('');

  try {
    // Build where clause for cycles, if any cycle-level filters were provided
    const cycleWhere: Record<string, unknown> = {};
    if (cycleId) {
      cycleWhere.id = cycleId;
    } else if (status) {
      cycleWhere.status = status;
    }

    const targetCycles = await prisma.cycle.findMany({
      where: cycleWhere,
      select: {
        id: true,
        name: true,
        status: true,
        startedAt: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (targetCycles.length === 0) {
      console.log('No cycles matched the provided filters. Nothing to do.');
      return;
    }

    console.log(`Found ${targetCycles.length} cycle(s) to scan for rollover lines.\n`);

    let totalLinesScanned = 0;
    let totalLinesUpdated = 0;

    for (const cycle of targetCycles) {
      console.log('-'.repeat(80));
      console.log(
        `Cycle ${cycle.id} (${cycle.name ?? 'Unnamed'}) - status=${cycle.status}`,
      );
      console.log('-'.repeat(80));

      const lineWhere: Record<string, unknown> = {
        cycleId: cycle.id,
        isRollover: true,
      };

      // Restrict to lines where there is something to fix:
      // unitsBought > 0 and listedUnits < unitsBought (or == 0 in strict mode)
      const lines = await prisma.cycleLine.findMany({
        where: {
          ...lineWhere,
          unitsBought: { gt: 0 },
          ...(onlyZero ? { listedUnits: 0 } : {}),
        },
        select: {
          id: true,
          typeId: true,
          destinationStationId: true,
          unitsBought: true,
          unitsSold: true,
          listedUnits: true,
        },
      });

      // When not in --only-zero mode, further narrow to lines where
      // listedUnits is actually less than unitsBought.
      const candidateLines = lines.filter(
        (line) => line.listedUnits < line.unitsBought,
      );

      console.log(
        `Found ${candidateLines.length} rollover line(s) with incorrect listedUnits in this cycle.\n`,
      );

      for (const line of candidateLines) {
        totalLinesScanned += 1;

        const newListedUnits = line.unitsBought;

        if (newListedUnits === line.listedUnits) {
          continue;
        }

        totalLinesUpdated += 1;

        const remainingUnits = Math.max(0, line.unitsBought - line.unitsSold);
        const oldUnlisted = Math.max(0, line.unitsBought - line.listedUnits);
        const newUnlisted = Math.max(0, line.unitsBought - newListedUnits);

        console.log(
          `Line ${line.id.slice(0, 8)}: typeId=${line.typeId}, station=${line.destinationStationId}`,
        );
        console.log(
          `  Units: bought=${line.unitsBought}, sold=${line.unitsSold}, remaining=${remainingUnits}`,
        );
        console.log(
          `  listedUnits: ${line.listedUnits} -> ${newListedUnits} (rollover inventory treated as already listed)`,
        );
        console.log(`  Unlisted: ${oldUnlisted} -> ${newUnlisted}`);

        if (!dryRun) {
          await prisma.cycleLine.update({
            where: { id: line.id },
            data: { listedUnits: newListedUnits },
          });
          console.log('  ✓ Updated');
        } else {
          console.log('  [DRY RUN - would update]');
        }

        console.log('');
      }
    }

    console.log('='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));
    console.log(`Total rollover lines scanned : ${totalLinesScanned}`);
    console.log(`Total rollover lines updated : ${totalLinesUpdated}`);
    console.log(
      `Total rollover lines unchanged: ${totalLinesScanned - totalLinesUpdated}`,
    );
    if (dryRun) {
      console.log('\nDRY RUN MODE - No changes were written to the database.');
      console.log('Run again without --dry-run to apply the fixes.');
    } else {
      console.log('\n✓ Changes written to the database.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\nScript completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nScript failed:', err);
    process.exit(1);
  });


