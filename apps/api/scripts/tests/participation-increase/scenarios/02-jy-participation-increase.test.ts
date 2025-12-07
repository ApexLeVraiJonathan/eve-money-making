/**
 * Scenario 02: JingleYield Root Participation Increase (Interactive)
 *
 * Goal:
 * - Verify that increasing a JingleYield root participation:
 *   - Increases the participation amount by the requested delta.
 *   - Leaves the JingleYieldProgram.lockedPrincipalIsk unchanged.
 *   - Respects the 10B user principal cap combined with the JY seed.
 *   - Updates the UI banner to show the user-funded extra and payment
 *     instructions.
 *
 * Flow:
 * 1) Create a PLANNED cycle.
 * 2) As admin, create a 2B JY root participation for the test user.
 * 3) Pause and instruct the operator to:
 *    - Open Tradecraft → Next Cycle for that user.
 *    - Verify the "Admin-funded JingleYield principal" banner.
 *    - Click "Increase Participation" and add 8B (bringing total to 10B).
 * 4) Verify via Prisma + API:
 *    - Participation amount = 10B.
 *    - JingleYield program lockedPrincipalIsk = 2B.
 *    - Status is AWAITING_INVESTMENT.
 */

import { PrismaClient } from '@eve/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  type TestConfig,
  type SharedRolloverContext,
  createApiCall,
  createCycle,
  formatIsk,
  logStep,
  logSuccess,
  waitForUser,
  printScenarioHeader,
  printScenarioComplete,
} from '../helpers';

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});

export async function scenario02JingleYieldParticipationIncrease(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader(
    '🎄',
    'SCENARIO 02: JingleYield Root Participation Increase (Interactive)',
  );

  if (!config.testUserId) {
    throw new Error(
      'Missing --testUserId. Provide a real user ID for Scenario 02.',
    );
  }

  // In the real system, a user must fully cash out (no active participations)
  // before a new JingleYield program can be created. Scenario 01 may have left
  // active participations for this test user, so force-complete any remaining
  // active participations so we can start a fresh JY program here.
  await prisma.cycleParticipation.updateMany({
    where: {
      userId: config.testUserId,
      status: {
        in: [
          'AWAITING_INVESTMENT',
          'AWAITING_VALIDATION',
          'OPTED_IN',
          'AWAITING_PAYOUT',
        ],
      },
    },
    data: {
      status: 'COMPLETED',
      payoutPaidAt: new Date(),
    },
  });

  const apiCall = createApiCall(config);

  // 1) Close previous test cycle (from Scenario 01) and create a fresh PLANNED
  //    JY cycle so the frontend still only sees a single PLANNED cycle.
  logStep(
    '1️⃣',
    'Closing previous test cycle (if any) and creating PLANNED JY test cycle...',
  );

  if (ctx.cycleIds[0]) {
    await prisma.cycle.updateMany({
      where: { id: ctx.cycleIds[0], status: 'PLANNED' },
      data: { status: 'COMPLETED', closedAt: new Date() },
    });
  }

  const cycle = await createCycle(apiCall, 'PI Suite - JY Root Increase');
  ctx.cycleIds.push(cycle.id);
  logSuccess(
    `Cycle created: ${cycle.id.substring(0, 8)} (${cycle.name ?? 'unnamed'})`,
  );

  // 2) Create a 2B JY root participation for the user
  const jySeed = 2_000_000_000; // 2B

  logStep(
    '2️⃣',
    `Creating 2B JingleYield root participation for test user ${config.testUserId}...`,
  );

  const jy = await apiCall('POST', '/ledger/jingle-yield/participations', {
    userId: config.testUserId,
    cycleId: cycle.id,
    adminCharacterId: config.characterId,
    characterName: 'JY Test Investor',
  });

  const participationId: string = jy.participation.id;
  const programId: string = jy.program.id;

  logSuccess(
    `JY root participation created: ${participationId.substring(
      0,
      8,
    )}, program=${programId.substring(0, 8)}, locked=${formatIsk(jySeed)} ISK`,
  );

  // 3) Pause for interactive UI increase
  const delta = 8_000_000_000; // 8B (user extra)
  await waitForUser(
    config,
    [
      'Open the frontend and log in as the test user.',
      'Navigate to Tradecraft → Next Cycle.',
      `You should see a 2B JingleYield participation in "PI Suite - JY Root Increase".`,
      'Verify that the green banner says the initial principal is admin-funded and that you do not need to pay for it.',
      `Click "Increase Participation" and enter an additional ${formatIsk(
        delta,
      )} ISK so that the total participation amount becomes 10B.`,
      '',
      'Do NOT send ISK in-game yet; we will only verify the database state.',
    ].join('\n   '),
  );

  // 4) Verify via Prisma + API
  logStep(
    '3️⃣',
    'Verifying updated JY participation and program state via database...',
  );

  const dbParticipation = await prisma.cycleParticipation.findUnique({
    where: { id: participationId },
  });

  if (!dbParticipation) {
    throw new Error('❌ Updated JY participation not found in database');
  }

  const amount = Number(dbParticipation.amountIsk);
  const expectedTotal = jySeed + delta;

  if (amount !== expectedTotal) {
    throw new Error(
      `❌ JY participation amount mismatch after increase. Expected ${formatIsk(
        expectedTotal,
      )}, got ${formatIsk(amount)}`,
    );
  }

  if (dbParticipation.status !== 'AWAITING_INVESTMENT') {
    throw new Error(
      `❌ Expected JY participation status AWAITING_INVESTMENT after increase, got ${dbParticipation.status}`,
    );
  }

  const dbProgram = await prisma.jingleYieldProgram.findUnique({
    where: { id: programId },
  });

  if (!dbProgram) {
    throw new Error('❌ JingleYield program not found in database');
  }

  const lockedPrincipal = Number(dbProgram.lockedPrincipalIsk);
  if (lockedPrincipal !== jySeed) {
    throw new Error(
      `❌ Expected lockedPrincipalIsk to remain ${formatIsk(
        jySeed,
      )}, got ${formatIsk(lockedPrincipal)}`,
    );
  }

  logSuccess(
    `✓ JY root participation increased to ${formatIsk(
      amount,
    )} ISK while locked principal remains ${formatIsk(jySeed)} ISK.`,
  );

  printScenarioHeader(
    '👀',
    'MANUAL CHECK: JY Increase Banner & Memo (Frontend Verification)',
  );
  await waitForUser(
    config,
    [
      'In the frontend, verify that for the JY participation:',
      '- The green banner shows how much extra you added on top of the seeded amount.',
      '- The banner tells you to send exactly that extra ISK.',
      '- The To / Memo fields are visible with copy buttons.',
      '',
      'Once you have visually confirmed this, press ENTER to complete Scenario 02.',
    ].join('\n   '),
  );

  printScenarioComplete();
}


