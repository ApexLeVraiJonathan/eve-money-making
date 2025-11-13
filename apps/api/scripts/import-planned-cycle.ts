/**
 * Import planned cycle and participations after migration
 * Run this AFTER deploying schema changes to production
 * 
 * Usage:
 *   DATABASE_URL=<prod-url> pnpm exec ts-node scripts/import-planned-cycle.ts <filename>
 */

import { PrismaClient } from '@eve/prisma';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function importPlannedCycle() {
  const filename = process.argv[2];

  if (!filename) {
    console.error('❌ Please provide the export file as an argument');
    console.error('Usage: ts-node scripts/import-planned-cycle.ts <filename>');
    process.exit(1);
  }

  if (!fs.existsSync(filename)) {
    console.error(`❌ File not found: ${filename}`);
    process.exit(1);
  }

  console.log(`📂 Reading from: ${filename}\n`);

  const data = JSON.parse(fs.readFileSync(filename, 'utf-8'));

  console.log('📋 Import Preview:');
  console.log(`   Cycle Name: ${data.cycle.name || 'Unnamed'}`);
  console.log(`   Start Date: ${data.cycle.startedAt}`);
  console.log(`   Participations: ${data.participations.length}`);
  console.log(
    `   Total Investment: ${data.participations.reduce((sum: number, p: any) => sum + Number(p.amountIsk), 0).toLocaleString()} ISK\n`,
  );

  // Create cycle with new schema (includes status field)
  console.log('💾 Creating cycle...');
  const cycle = await prisma.cycle.create({
    data: {
      name: data.cycle.name,
      startedAt: new Date(data.cycle.startedAt),
      status: 'PLANNED', // New field!
      initialInjectionIsk: data.cycle.initialInjectionIsk,
      initialCapitalIsk: data.cycle.initialCapitalIsk,
    },
  });
  console.log(`✅ Created cycle: ${cycle.id}\n`);

  // Create participations
  console.log('💾 Creating participations...');
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

  console.log(`\n✅ Import complete!`);
  console.log(`   Cycle ID: ${cycle.id}`);
  console.log(`   Participations: ${created}`);
  console.log(`\n🎉 Planned cycle restored successfully!`);
}

importPlannedCycle()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

