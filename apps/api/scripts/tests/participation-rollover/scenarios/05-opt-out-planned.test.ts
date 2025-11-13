/**
 * Scenario 5: Opt-out of PLANNED Cycle
 *
 * Tests that a user can opt-out of a participation while the cycle is still PLANNED.
 *
 * Flow:
 * 1. Create a PLANNED cycle
 * 2. Create participation and match donation
 * 3. Opt-out while cycle is PLANNED (should succeed)
 * 4. Verify participation was marked as OPTED_OUT or deleted
 */

import { PrismaClient } from '@eve/prisma';
import {
  TestConfig,
  TestContext,
  createApiCall,
  createCycle,
  createParticipation,
  getParticipations,
  createFakeDonation,
  matchDonations,
  formatIsk,
} from '../helpers';

const prisma = new PrismaClient();

/**
 * Opt out of a participation
 */
async function optOutParticipation(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  participationId: string,
): Promise<void> {
  await apiCall('POST', `/ledger/participations/${participationId}/opt-out`, {});
}

export async function testOptOutPlanned(ctx: TestContext): Promise<void> {
  const apiCall = createApiCall(ctx.config);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔴 SCENARIO 5: Opt-out of PLANNED Cycle');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Create a PLANNED cycle
  console.log('1️⃣  Creating PLANNED cycle...');
  const cycle = await createCycle(apiCall, 'Opt-out Test');
  console.log(`  ✓ Cycle created: ${cycle.id}`);

  // 2. Create participation
  console.log('\n2️⃣  Creating participation...');
  const participation = await createParticipation(apiCall, {
    cycleId: cycle.id,
    characterName: 'Opt-out Tester',
    amountIsk: '5000000000.00',
    testUserId: 'optout01',
  });
  console.log(`  ✓ Participation created: ${participation.id}`);

  // 3. Create donation and match
  await createFakeDonation(
    ctx,
    5000000000,
    `ARB-${cycle.id.substring(0, 8)}-optout01`,
  );
  await matchDonations(apiCall, cycle.id);
  console.log('  ✓ Donation matched, status: OPTED_IN');

  // 4. Opt-out while cycle is PLANNED (should succeed)
  console.log('\n3️⃣  Opting out of PLANNED cycle...');
  await optOutParticipation(apiCall, participation.id);
  console.log('  ✓ Opt-out successful');

  // 5. Verify participation was deleted or marked as OPTED_OUT
  const participations = await getParticipations(apiCall, cycle.id);
  const optedOut = participations.find((p: any) => p.id === participation.id);
  if (optedOut && optedOut.status !== 'OPTED_OUT') {
    throw new Error(
      `❌ Expected participation to be OPTED_OUT or deleted, got ${optedOut.status}`,
    );
  }
  console.log('  ✓ Participation marked for refund or deleted');

  console.log('\n✅ SCENARIO 5 COMPLETE\n');
}

// Allow running this test standalone
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const getArg = (name: string) => {
      const index = args.indexOf(name);
      return index >= 0 ? args[index + 1] : undefined;
    };

    const config: TestConfig = {
      apiUrl: getArg('--apiUrl') || 'http://localhost:3000',
      token: getArg('--token'),
      apiKey: getArg('--apiKey'),
      characterId: parseInt(getArg('--characterId') || '0'),
      skipPauses: args.includes('--skip-pauses'),
    };

    if ((!config.token && !config.apiKey) || !config.characterId) {
      console.error('❌ Missing required arguments');
      console.log('\nUsage:');
      console.log(
        '  pnpm exec ts-node scripts/tests/participation-rollover/scenarios/05-opt-out-planned.test.ts --apiKey <key> --characterId <id>',
      );
      process.exit(1);
    }

    const ctx: TestContext = {
      config,
      characterId: config.characterId,
      transactionIdCounter: 0,
    };

    try {
      console.log('\n🚀 Running Scenario 5: Opt-out of PLANNED Cycle\n');
      await testOptOutPlanned(ctx);
      console.log('\n✅ Test passed!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}

