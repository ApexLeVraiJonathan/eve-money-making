/**
 * Production Database Reset Script
 * WARNING: This will DROP ALL TABLES and re-run migrations
 *
 * Usage: pnpm tsx scripts/reset-prod-db.ts <DATABASE_URL>
 * Example: pnpm tsx scripts/reset-prod-db.ts "postgresql://user:pass@host:5432/dbname"
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

async function resetProductionDatabase() {
  const databaseUrl = process.argv[2];

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL argument is required');
    console.log('\nUsage: pnpm tsx scripts/reset-prod-db.ts <DATABASE_URL>');
    console.log(
      'Example: pnpm tsx scripts/reset-prod-db.ts "postgresql://user:pass@host:5432/dbname"',
    );
    process.exit(1);
  }

  console.log('⚠️  WARNING: This will DROP ALL TABLES in the database!');
  console.log(
    `📍 Target database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`,
  );
  console.log('\n⏳ Waiting 5 seconds before proceeding...');
  console.log('   Press Ctrl+C to cancel');

  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    console.log('\n🗑️  Step 1: Nuking the entire public schema...');

    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    // Drop the entire public schema and recreate it
    // This removes EVERYTHING - tables, enums, functions, etc.
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
    console.log('   ✓ Dropped public schema');

    await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
    console.log('   ✓ Created fresh public schema');

    // Grant permissions
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO postgres`);
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
    console.log('   ✓ Granted permissions');

    await prisma.$disconnect();

    console.log('\n✅ Database wiped successfully');

    console.log('\n📦 Step 2: Applying current schema...');

    // Now push the current schema (it will create all tables)
    execSync('pnpm prisma db push --skip-generate --accept-data-loss', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      cwd: process.cwd(),
    });

    console.log('\n✅ Database reset complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Verify the schema: pnpm prisma studio');
    console.log('   2. Deploy your application');
    console.log('   3. Create initial admin users/characters as needed');
  } catch (error) {
    console.error('\n❌ Error during database reset:', error);
    process.exit(1);
  }
}

resetProductionDatabase();
