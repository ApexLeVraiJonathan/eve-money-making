/**
 * Check for Open Cycle
 * 
 * Checks if there's an open cycle to commit to.
 * If not, creates one.
 */

import { PrismaClient } from '@eve/prisma';

const prisma = new PrismaClient();

async function checkOpenCycle() {
  console.log('\n🔍 Checking for open cycle...\n');
  
  const openCycle = await prisma.cycle.findFirst({
    where: { status: 'OPEN' },
    select: { id: true, name: true, startedAt: true },
  });
  
  if (openCycle) {
    console.log('✅ Found open cycle:');
    console.log(`   ID: ${openCycle.id}`);
    console.log(`   Name: ${openCycle.name}`);
    console.log(`   Started: ${openCycle.startedAt}`);
    console.log('\n✓ Ready to commit plan!\n');
  } else {
    console.log('⚠️  No open cycle found.');
    console.log('\nYou need to create an open cycle first. You can:');
    console.log('  1. Use the frontend at /tradecraft/admin/cycles');
    console.log('  2. Create via API: POST /ledger/cycles/plan then POST /ledger/cycles/:id/open');
    console.log('\nOr run this script to create one automatically:\n');
    console.log('  npx ts-node scripts/create-open-cycle.ts --apiKey YOUR_API_KEY\n');
  }
  
  await prisma.$disconnect();
}

checkOpenCycle();

