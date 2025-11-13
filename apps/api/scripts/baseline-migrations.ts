/**
 * Baseline Migrations for Production
 * 
 * This marks all existing migrations as applied so Prisma Migrate
 * can work with an existing production database.
 */

import { PrismaClient } from '@eve/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking migration status...\n');

  // Check what migrations exist in the database
  const appliedMigrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
    SELECT migration_name, finished_at 
    FROM _prisma_migrations 
    ORDER BY finished_at;
  `;

  console.log(`Found ${appliedMigrations.length} migrations in database:\n`);
  
  appliedMigrations.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.migration_name} - ${m.finished_at ? '✅ Applied' : '❌ Failed'}`);
  });

  console.log('\n📝 To baseline, you need to:');
  console.log('1. Delete (or truncate) the _prisma_migrations table');
  console.log('2. Run: npx prisma migrate resolve --applied <migration_name> for each migration\n');
  
  console.log('Or use the simple approach:');
  console.log('   npx prisma migrate resolve --applied "0_init"\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

