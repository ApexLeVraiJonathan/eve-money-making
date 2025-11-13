/**
 * Export planned cycle and participations for migration
 * Run this BEFORE deploying schema changes to production
 *
 * Usage:
 *   DATABASE_URL=<prod-url> pnpm exec ts-node scripts/export-planned-cycle.ts
 */

import { PrismaClient } from '@eve/prisma';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function exportPlannedCycle() {
  console.log('🔍 Looking for planned cycle...\n');

  // Find the planned cycle (future startedAt, no closedAt)
  const cycles = await prisma.cycle.findMany({
    where: {
      closedAt: null,
    },
    orderBy: {
      startedAt: 'desc',
    },
    include: {
      participations: true,
    },
  });

  console.log(`Found ${cycles.length} open cycles:`);
  cycles.forEach((c, i) => {
    const isPast = new Date(c.startedAt) < new Date();
    console.log(
      `  ${i + 1}. ${c.name || c.id.slice(0, 8)} - ${isPast ? 'OPEN (started)' : 'PLANNED (future)'} - ${c.participations.length} participations`,
    );
  });

  // Find the one with future startedAt (planned)
  const plannedCycle = cycles.find((c) => new Date(c.startedAt) > new Date());

  if (!plannedCycle) {
    console.log('\n❌ No planned cycle found (future startedAt)');
    console.log('All cycles have already started.');
    return;
  }

  console.log(
    `\n✅ Found planned cycle: ${plannedCycle.name || plannedCycle.id}`,
  );
  console.log(`   Start Date: ${plannedCycle.startedAt}`);
  console.log(`   Participations: ${plannedCycle.participations.length}`);

  if (plannedCycle.participations.length === 0) {
    console.log('\n⚠️  No participations to export.');
    return;
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

  console.log(`\n✅ Exported to: ${filename}`);
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

  console.log(
    '\n✅ Export complete! Save this file before running migrations.',
  );
}

exportPlannedCycle()
  .catch((e) => {
    console.error('❌ Export failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
