/**
 * Fix Missing Table Script
 * Recreates missing tables by pushing the Prisma schema
 *
 * Usage: pnpm tsx scripts/fix-missing-table.ts <DATABASE_URL>
 */

import { execSync } from 'child_process';

async function fixMissingTable() {
  const databaseUrl = process.argv[2];

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL argument is required');
    console.log(
      '\nUsage: pnpm tsx scripts/fix-missing-table.ts <DATABASE_URL>',
    );
    console.log(
      'Example: pnpm tsx scripts/fix-missing-table.ts "postgresql://user:pass@host:5432/dbname"',
    );
    process.exit(1);
  }

  console.log('🔧 Recreating missing tables from Prisma schema...');
  console.log(
    `📍 Target database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`,
  );

  try {
    console.log('\n📦 Step 1: Pushing Prisma schema to database...');

    // Set the DATABASE_URL environment variable for this command
    const env = { ...process.env, DATABASE_URL: databaseUrl };

    execSync('pnpm prisma db push --skip-generate --accept-data-loss', {
      stdio: 'inherit',
      env,
    });

    console.log('\n✅ Schema push completed successfully!');
    console.log('   All missing tables have been recreated.');
  } catch (error) {
    console.error('\n❌ Error during schema push:', error);
    process.exit(1);
  }
}

fixMissingTable();
