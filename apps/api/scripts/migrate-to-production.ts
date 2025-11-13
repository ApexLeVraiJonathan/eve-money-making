/**
 * Production Migration Tool
 * 
 * This script handles the migration from old schema to new schema with CycleStatus,
 * package tracking, and other improvements.
 * 
 * Usage:
 *   DATABASE_URL=<prod-url> pnpm exec ts-node scripts/migrate-to-production.ts <step>
 * 
 * Steps:
 *   1 - Export planned cycle (run BEFORE migration)
 *   2 - Clean database (delete all cycles/participations)
 *   3 - Deploy migrations (run Prisma migrate)
 *   4 - Import planned cycle (run AFTER migration)
 *   all - Run steps 2, 3, 4 automatically (requires export file as 2nd argument)
 */

import { PrismaClient } from '@eve/prisma';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ============================================================================
// STEP 1: Export Planned Cycle
// ============================================================================

async function step1_exportPlannedCycle() {
  log('cyan', '\n🔍 STEP 1: Exporting Planned Cycle\n');
  log('yellow', '⚠️  Make sure you are connected to PRODUCTION database!\n');

  // Find the planned cycle (future startedAt, no closedAt)
  // NOTE: We select specific fields to work with OLD schema (before status column exists)
  const cycles = await prisma.cycle.findMany({
    where: {
      closedAt: null,
    },
    orderBy: {
      startedAt: 'desc',
    },
    select: {
      id: true,
      name: true,
      startedAt: true,
      closedAt: true,
      initialInjectionIsk: true,
      initialCapitalIsk: true,
      participations: {
        select: {
          userId: true,
          characterName: true,
          amountIsk: true,
          memo: true,
          status: true,
          walletJournalId: true,
          validatedAt: true,
          createdAt: true,
        },
      },
    },
  });

  log('bright', `Found ${cycles.length} open cycles:`);
  cycles.forEach((c, i) => {
    const isPast = new Date(c.startedAt) < new Date();
    console.log(
      `  ${i + 1}. ${c.name || c.id.slice(0, 8)} - ${isPast ? 'OPEN' : 'PLANNED'} - ${c.participations.length} participations`,
    );
  });

  // Find the one with future startedAt (planned)
  const plannedCycle = cycles.find((c) => new Date(c.startedAt) > new Date());

  if (!plannedCycle) {
    log('red', '\n❌ No planned cycle found (future startedAt)');
    console.log('All cycles have already started.');
    return null;
  }

  log('green', `\n✅ Found planned cycle: ${plannedCycle.name || plannedCycle.id}`);
  console.log(`   Start Date: ${plannedCycle.startedAt}`);
  console.log(`   Participations: ${plannedCycle.participations.length}`);

  if (plannedCycle.participations.length === 0) {
    log('yellow', '\n⚠️  No participations to export.');
    return null;
  }

  // Prepare export data
  const exportData = {
    cycle: {
      name: plannedCycle.name,
      startedAt: plannedCycle.startedAt.toISOString(),
      initialInjectionIsk: plannedCycle.initialInjectionIsk?.toString(),
      initialCapitalIsk: plannedCycle.initialCapitalIsk?.toString(),
    },
    participations: plannedCycle.participations.map((p) => ({
      userId: p.userId,
      characterName: p.characterName,
      amountIsk: p.amountIsk.toString(),
      memo: p.memo,
      status: p.status,
      walletJournalId: p.walletJournalId?.toString(),
      validatedAt: p.validatedAt?.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
  };

  // Save to file
  const filename = `planned-cycle-export-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));

  log('green', `\n✅ Exported to: ${filename}`);
  console.log('\n📋 Summary:');
  console.log(`   Cycle Name: ${exportData.cycle.name || 'Unnamed'}`);
  console.log(`   Start Date: ${exportData.cycle.startedAt}`);
  console.log(`   Participations: ${exportData.participations.length}`);
  console.log(
    `   Total Investment: ${exportData.participations.reduce((sum, p) => sum + Number(p.amountIsk), 0).toLocaleString()} ISK`,
  );

  console.log('\n📝 Participation Details:');
  exportData.participations.forEach((p, i) => {
    console.log(
      `   ${i + 1}. ${p.characterName}: ${Number(p.amountIsk).toLocaleString()} ISK (${p.status})`,
    );
  });

  log('green', '\n✅ Export complete! Save this file before running step 2.');
  return filename;
}

// ============================================================================
// STEP 2: Clean Database
// ============================================================================

async function step2_cleanDatabase() {
  log('cyan', '\n🗑️  STEP 2: Cleaning Database\n');
  log('red', '⚠️  WARNING: This will DROP ALL cycle-related tables!\n');

  // List what will be deleted
  const cycleCount = await prisma.cycle.count();
  const participationCount = await prisma.cycleParticipation.count();
  const lineCount = await prisma.cycleLine.count();

  console.log('📊 Current data:');
  console.log(`   Cycles: ${cycleCount}`);
  console.log(`   Participations: ${participationCount}`);
  console.log(`   Cycle Lines: ${lineCount}`);

  log('yellow', '\n⏳ Dropping all cycle-related tables...');

  // Drop tables in correct order (respecting foreign keys)
  // We use raw SQL to drop tables so migrations can recreate them fresh
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "CycleSnapshot" CASCADE;');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "CycleFeeEvent" CASCADE;');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "SellAllocation" CASCADE;');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "BuyAllocation" CASCADE;');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "PackageCycleLine" CASCADE;');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "CycleLine" CASCADE;');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "CycleLedgerEntry" CASCADE;');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "CycleParticipation" CASCADE;');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "CycleCapitalCache" CASCADE;');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "Cycle" CASCADE;');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "CommittedPackage" CASCADE;');

  log('green', '\n✅ Database cleaned successfully! All cycle tables dropped.');
  log('bright', '\n📌 Next: Run step 3 to deploy migrations');
}

// ============================================================================
// STEP 3: Deploy Migrations
// ============================================================================

async function step3_deployMigrations() {
  log('cyan', '\n🚀 STEP 3: Deploying Migrations\n');

  log('yellow', '⏳ Running: prisma migrate deploy...\n');

  try {
    const path = require('path');
    // Navigate to workspace root and run prisma
    const workspaceRoot = path.resolve(__dirname, '../../..');
    
    // On Windows, we need to use .cmd files
    const isWindows = process.platform === 'win32';
    const prismaCmd = isWindows ? 'prisma.cmd' : 'prisma';
    const prismaPath = path.join(workspaceRoot, 'node_modules', '.bin', prismaCmd);
    
    log('bright', `Using Prisma at: ${prismaPath}\n`);
    
    const { stdout, stderr } = await execAsync(`"${prismaPath}" migrate deploy`, {
      env: { ...process.env },
      cwd: workspaceRoot,
    });
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    log('green', '\n✅ Migrations deployed successfully!');
    log('bright', '\n📌 Next: Run step 4 to import the planned cycle');
  } catch (error: any) {
    log('red', '\n❌ Migration failed!');
    console.error(error.message);
    throw error;
  }
}

// ============================================================================
// STEP 4: Import Planned Cycle
// ============================================================================

async function step4_importPlannedCycle(filename: string) {
  log('cyan', '\n📥 STEP 4: Importing Planned Cycle\n');

  if (!filename) {
    log('red', '❌ Please provide the export filename as argument');
    console.log('Usage: ts-node migrate-to-production.ts 4 <filename>');
    process.exit(1);
  }

  if (!fs.existsSync(filename)) {
    log('red', `❌ File not found: ${filename}`);
    process.exit(1);
  }

  log('bright', `📂 Reading from: ${filename}\n`);

  const data = JSON.parse(fs.readFileSync(filename, 'utf-8'));

  console.log('📋 Import Preview:');
  console.log(`   Cycle Name: ${data.cycle.name || 'Unnamed'}`);
  console.log(`   Start Date: ${data.cycle.startedAt}`);
  console.log(`   Participations: ${data.participations.length}`);
  console.log(
    `   Total Investment: ${data.participations.reduce((sum: number, p: any) => sum + Number(p.amountIsk), 0).toLocaleString()} ISK\n`,
  );

  // Create cycle with new schema (includes status field)
  log('yellow', '⏳ Creating cycle...');
  const cycle = await prisma.cycle.create({
    data: {
      name: data.cycle.name,
      startedAt: new Date(data.cycle.startedAt),
      status: 'PLANNED', // New field!
      initialInjectionIsk: data.cycle.initialInjectionIsk,
      initialCapitalIsk: data.cycle.initialCapitalIsk,
    },
  });
  log('green', `✅ Created cycle: ${cycle.id}\n`);

  // Create participations
  log('yellow', '⏳ Creating participations...');
  let created = 0;
  for (const p of data.participations) {
    await prisma.cycleParticipation.create({
      data: {
        cycleId: cycle.id,
        userId: p.userId,
        characterName: p.characterName,
        amountIsk: p.amountIsk,
        memo: p.memo,
        status: p.status,
        walletJournalId: p.walletJournalId ? BigInt(p.walletJournalId) : null,
        validatedAt: p.validatedAt ? new Date(p.validatedAt) : null,
        createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        // New fields will use defaults
        payoutAmountIsk: null,
        payoutPaidAt: null,
      },
    });
    created++;
    console.log(
      `   ${created}/${data.participations.length} - ${p.characterName}: ${Number(p.amountIsk).toLocaleString()} ISK`,
    );
  }

  log('green', `\n✅ Import complete!`);
  console.log(`   Cycle ID: ${cycle.id}`);
  console.log(`   Participations: ${created}`);
  log('bright', `\n🎉 Migration complete! Production is ready.`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const step = process.argv[2];
  const arg = process.argv[3];
  const databaseUrl = process.argv[4];

  // Set DATABASE_URL if provided as argument
  if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
    log('cyan', '🔗 Using provided DATABASE_URL\n');
  } else if (!process.env.DATABASE_URL) {
    log('red', '❌ DATABASE_URL is required!');
    console.log('Either set it as environment variable or pass as last argument.\n');
  }

  if (!step) {
    console.log(`
${colors.bright}Production Migration Tool${colors.reset}

Usage:
  ${colors.cyan}pnpm exec ts-node scripts/migrate-to-production.ts <step> [filename] [database-url]${colors.reset}

Steps:
  ${colors.green}1${colors.reset}     - Export planned cycle (run BEFORE migration)
  ${colors.yellow}2${colors.reset}     - Clean database (delete all cycles/participations)
  ${colors.blue}3${colors.reset}     - Deploy migrations (run Prisma migrate)
  ${colors.green}4${colors.reset}     - Import planned cycle (run AFTER migration)
              Requires filename: ${colors.cyan}ts-node migrate-to-production.ts 4 <filename> [db-url]${colors.reset}

  ${colors.bright}all${colors.reset}   - Run steps 2, 3, 4 automatically
              Requires filename: ${colors.cyan}ts-node migrate-to-production.ts all <filename> [db-url]${colors.reset}

Example workflow (Windows PowerShell):
  ${colors.cyan}# Set the database URL
  $PROD_DB = "postgresql://user:pass@host:port/db"

  # 1. Export data (on production)
  pnpm exec ts-node scripts/migrate-to-production.ts 1 "" $PROD_DB

  # 2. Clean database
  pnpm exec ts-node scripts/migrate-to-production.ts 2 "" $PROD_DB

  # 3. Deploy migrations
  pnpm exec ts-node scripts/migrate-to-production.ts 3 "" $PROD_DB

  # 4. Import data
  pnpm exec ts-node scripts/migrate-to-production.ts 4 planned-cycle-export-*.json $PROD_DB${colors.reset}

${colors.yellow}⚠️  IMPORTANT: Always run step 1 BEFORE steps 2-4!${colors.reset}
    `);
    process.exit(0);
  }

  try {
    switch (step) {
      case '1':
        await step1_exportPlannedCycle();
        break;

      case '2':
        await step2_cleanDatabase();
        break;

      case '3':
        await step3_deployMigrations();
        break;

      case '4':
        if (!arg) {
          log('red', '❌ Step 4 requires filename as argument');
          console.log('Usage: ts-node migrate-to-production.ts 4 <filename>');
          process.exit(1);
        }
        await step4_importPlannedCycle(arg);
        break;

      case 'all':
        if (!arg) {
          log('red', '❌ "all" requires export filename as argument');
          console.log('Usage: ts-node migrate-to-production.ts all <filename>');
          process.exit(1);
        }
        log('bright', '\n🚀 Running full migration process...\n');
        await step2_cleanDatabase();
        await step3_deployMigrations();
        await step4_importPlannedCycle(arg);
        log('bright', '\n✅ Full migration complete!');
        break;

      default:
        log('red', `❌ Unknown step: ${step}`);
        console.log('Valid steps: 1, 2, 3, 4, all');
        process.exit(1);
    }
  } catch (error) {
    log('red', '\n❌ Migration failed!');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

