import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAllocation(cycleId?: string) {
  console.log('🔧 Fixing allocation for cycle...');

  // Get the cycle to fix (either specified or the latest open one)
  const cycle = cycleId
    ? await prisma.cycle.findUnique({ where: { id: cycleId } })
    : await prisma.cycle.findFirst({
        where: { closedAt: null },
        orderBy: { startedAt: 'desc' },
      });

  if (!cycle) {
    console.error('❌ No cycle found to fix');
    process.exit(1);
  }

  console.log(`📍 Fixing cycle: ${cycle.id} (${cycle.name || 'Unnamed'})`);
  console.log(`   Started at: ${cycle.startedAt}`);

  // Step 1: Delete all allocations for this cycle's lines
  console.log('\n🗑️  Step 1: Clearing existing allocations...');

  const lineIds = await prisma.cycleLine.findMany({
    where: { cycleId: cycle.id },
    select: { id: true },
  });

  const lineIdList = lineIds.map((l) => l.id);

  const deletedBuyAllocations = await prisma.buyAllocation.deleteMany({
    where: { lineId: { in: lineIdList } },
  });

  const deletedSellAllocations = await prisma.sellAllocation.deleteMany({
    where: { lineId: { in: lineIdList } },
  });

  console.log(`   ✓ Deleted ${deletedBuyAllocations.count} buy allocations`);
  console.log(`   ✓ Deleted ${deletedSellAllocations.count} sell allocations`);

  // Step 2: Reset cycle line metrics
  console.log('\n🔄 Step 2: Resetting cycle line metrics...');

  const updatedLines = await prisma.cycleLine.updateMany({
    where: { cycleId: cycle.id },
    data: {
      unitsBought: 0,
      unitsSold: 0,
      buyCostIsk: '0.00',
      salesGrossIsk: '0.00',
      salesTaxIsk: '0.00',
      salesNetIsk: '0.00',
    },
  });

  console.log(`   ✓ Reset ${updatedLines.count} cycle lines`);

  // Step 3: Re-run allocation by calling the reconciliation endpoint
  console.log('\n🔁 Step 3: Re-running allocation with time filter...');
  console.log(
    '   ⚠️  You need to call the reconciliation API endpoint manually:',
  );
  console.log(
    `   POST /recon/reconcile with cycleId=${cycle.id} (or let it auto-detect)`,
  );
  console.log('\n✅ Allocation fix preparation complete!');
  console.log(
    '   Next step: Run the reconciliation endpoint to re-allocate transactions.',
  );
}

// Get cycle ID from command line args
const cycleId = process.argv[2];

fixAllocation(cycleId)
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
