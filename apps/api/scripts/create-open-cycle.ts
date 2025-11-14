/**
 * Create Open Cycle
 * 
 * Creates a new cycle and opens it for trading.
 */

import { PrismaClient } from '@eve/prisma';

const prisma = new PrismaClient();

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && idx < process.argv.length - 1 ? process.argv[idx + 1] : undefined;
}

async function createOpenCycle() {
  const apiUrl = getArg('--apiUrl') || 'http://localhost:3000';
  const apiKey = getArg('--apiKey');
  const cycleName = getArg('--name') || `Cycle ${new Date().toISOString().split('T')[0]}`;
  
  if (!apiKey) {
    console.error('❌ Missing required argument: --apiKey');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/create-open-cycle.ts --apiKey KEY [--apiUrl URL] [--name NAME]');
    process.exit(1);
  }
  
  console.log('\n🔄 Creating new cycle...\n');
  
  try {
    // Step 1: Plan the cycle
    const planResponse = await fetch(`${apiUrl}/ledger/cycles/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        startedAt: new Date(Date.now() + 5000).toISOString(), // Start in 5 seconds
        name: cycleName,
      }),
    });
    
    if (!planResponse.ok) {
      const text = await planResponse.text();
      throw new Error(`Failed to plan cycle: ${planResponse.status} ${planResponse.statusText}\n${text}`);
    }
    
    const cycle = await planResponse.json();
    console.log(`✅ Cycle planned:`);
    console.log(`   ID: ${cycle.id}`);
    console.log(`   Name: ${cycle.name}`);
    
    // Step 2: Open the cycle
    const openResponse = await fetch(`${apiUrl}/ledger/cycles/${cycle.id}/open`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: '{}',
    });
    
    if (!openResponse.ok) {
      const text = await openResponse.text();
      throw new Error(`Failed to open cycle: ${openResponse.status} ${openResponse.statusText}\n${text}`);
    }
    
    console.log(`✅ Cycle opened!`);
    console.log(`\n✓ Ready to commit plans to cycle: ${cycle.id}\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createOpenCycle();

