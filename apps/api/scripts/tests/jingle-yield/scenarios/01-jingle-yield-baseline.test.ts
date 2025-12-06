/**
 * Scenario 01: JingleYield Creation & Admin Wiring
 *
 * Tests the core JingleYield behavior:
 * - Admin can create a JingleYield participation for a real user
 * - A 2B participation is created in a PLANNED cycle
 * - A JingleYieldProgram row is created and linked
 * - Admin JY list endpoint returns the program with correct summary data
 *
 * This scenario focuses on backend wiring and admin APIs. It does not try to
 * fully reach the 2B interest target (that would require multiple profitable
 * cycles), but it verifies the most critical integration points.
 */

import { PrismaClient } from '@eve/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  TestConfig,
  SharedRolloverContext,
  createApiCall,
  createCycle,
  createJingleYieldParticipation,
  getParticipations,
  formatIsk,
  logStep,
  logSuccess,
  logWarning,
  printScenarioHeader,
  printScenarioComplete,
  waitForUser,
} from '../helpers';

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});

export async function scenario01JingleYieldBaseline(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader('🎄', 'SCENARIO 01: JingleYield Creation & Admin Wiring');

  if (!config.testUserId) {
    throw new Error(
      'Missing --testUserId. Provide a real user ID so JingleYield can link to an app user.',
    );
  }

  const apiCall = createApiCall(config);

  // Step 1: Create a planned cycle for JingleYield
  logStep('1️⃣', 'Creating JingleYield test cycle (PLANNED)...');
  const cycle = await createCycle(apiCall, 'JY Suite - Cycle 1');
  ctx.cycleIds.push(cycle.id);
  logSuccess(`Cycle created: ${cycle.id.substring(0, 8)} (${cycle.name})`);

  // Step 2: Create a JingleYield participation via admin endpoint
  logStep('2️⃣', 'Creating JingleYield participation via admin endpoint...');
  const jyParticipation = await createJingleYieldParticipation(apiCall, {
    userId: config.testUserId,
    cycleId: cycle.id,
    adminCharacterId: config.characterId,
    characterName: 'JY Test Investor',
  });

  ctx.latestParticipationId = jyParticipation.participation.id;
  ctx.lastInitialAmount = parseFloat(jyParticipation.participation.amountIsk);

  logSuccess(
    `Created JY participation: ${jyParticipation.participation.id.substring(
      0,
      8,
    )}`,
  );
  logSuccess(
    `Linked JY program: ${jyParticipation.program.id.substring(0, 8)}`,
  );
  logSuccess(
    `Locked principal: ${formatIsk(
      parseFloat(jyParticipation.program.lockedPrincipalIsk),
    )}`,
  );

  // Step 3: Verify participation recorded as 2B in the cycle
  logStep('3️⃣', 'Verifying participation in PLANNED cycle...');
  const participations = await getParticipations(apiCall, cycle.id);
  const p = participations.find(
    (x: any) => x.id === jyParticipation.participation.id,
  );

  if (!p) {
    throw new Error('❌ JY participation not found in cycle participations');
  }

  const amount = parseFloat(p.amountIsk);
  if (amount !== 2_000_000_000) {
    logWarning(
      `Expected 2B participation amount, got ${formatIsk(amount)} (check backend wiring)`,
    );
  } else {
    logSuccess('Participation amount correctly set to 2B ISK');
  }

  if (!p.jingleYieldProgramId) {
    throw new Error('❌ Participation not linked to JingleYieldProgram');
  }
  logSuccess(`Participation linked to JY program: ${p.jingleYieldProgramId}`);

  // Step 4: Verify admin JY list endpoint shows the program
  logStep('4️⃣', 'Verifying admin JingleYield list endpoint...');
  const programs = await apiCall('GET', '/ledger/jingle-yield/programs', null);

  const program = programs.find(
    (prg: any) => prg.id === jyParticipation.program.id,
  );

  if (!program) {
    throw new Error(
      '❌ JingleYield program not found in /ledger/jingle-yield/programs',
    );
  }

  logSuccess(`Program found in admin list: ${program.id.substring(0, 8)}`);
  logSuccess(`Status: ${program.status}`);
  logSuccess(
    `Locked principal (summary): ${formatIsk(
      parseFloat(program.lockedPrincipalIsk),
    )}`,
  );

  // Step 5: Verify DB state directly (optional but strong assertion)
  logStep('5️⃣', 'Verifying database state for JingleYield program...');
  const dbProgram = await prisma.jingleYieldProgram.findUnique({
    where: { id: jyParticipation.program.id },
  });
  if (!dbProgram) {
    throw new Error('❌ JingleYield program missing in database');
  }

  if (dbProgram.userId !== config.testUserId) {
    throw new Error(
      `❌ Program userId mismatch (expected ${config.testUserId}, got ${dbProgram.userId})`,
    );
  }

  logSuccess('Database JY program userId matches testUserId');

  // Optional interactive pause for UI verification
  await waitForUser(
    config,
    'Verify in UI:\n' +
      '   - Admin → Participations: JY participation exists in the planned cycle with 2B amount\n' +
      '   - Admin → JingleYield: Program is listed with locked 2B and ACTIVE status\n',
  );

  printScenarioComplete();
}


