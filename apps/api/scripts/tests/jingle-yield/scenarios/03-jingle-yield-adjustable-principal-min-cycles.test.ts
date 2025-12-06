/**
 * Scenario 03: Adjustable Principal & Min Cycles
 *
 * Goal:
 * - Verify that an admin can create a JingleYield program with a custom
 *   seeded principal and custom minCycles, and that those values flow
 *   through to the participation, program row, and admin list API.
 *
 * Flow:
 * 1) Plan a new JY cycle.
 * 2) Create a JY participation with principalIsk = 3B and minCycles = 5.
 * 3) Assert participation amount is 3B ISK.
 * 4) Assert JY program has lockedPrincipalIsk = 3B, targetInterestIsk = 3B,
 *    minCycles = 5, cyclesCompleted = 0.
 */

import { PrismaClient } from '@eve/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  type TestConfig,
  type SharedRolloverContext,
  createApiCall,
  createCycle,
  createJingleYieldParticipation,
  formatIsk,
  logStep,
  logSuccess,
  printScenarioHeader,
  printScenarioComplete,
} from '../helpers';

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});

export async function scenario03JingleYieldAdjustablePrincipalAndCycles(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader(
    '📏',
    'SCENARIO 03: Adjustable Principal & Min Cycles',
  );

  if (!config.testUserId) {
    throw new Error(
      'Missing --testUserId. Provide a real user ID for Scenario 03.',
    );
  }

  // In the real system, a user must fully cash out (no active participations)
  // before a new JingleYield program can be created. Since Scenario 01/02 may
  // have left active participations for this test user, force-complete any
  // remaining active participations so this scenario can start a fresh program.
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

  // 1) Plan a new cycle for adjustable JY
  logStep('1️⃣', 'Planning JY cycle with custom principal/min cycles...');
  const cycle = await createCycle(apiCall, 'JY Suite - Custom Principal');
  ctx.cycleIds.push(cycle.id);
  logSuccess(`Cycle created: ${cycle.id.substring(0, 8)} (${cycle.name})`);

  // 2) Create a JingleYield participation with custom principal/minCycles
  const customPrincipal = 3_000_000_000; // 3B
  const customMinCycles = 5;

  logStep(
    '2️⃣',
    `Creating JY participation with principal ${formatIsk(
      customPrincipal,
    )} ISK and minCycles=${customMinCycles}...`,
  );

  const jy = await createJingleYieldParticipation(apiCall, {
    userId: config.testUserId,
    cycleId: cycle.id,
    adminCharacterId: config.characterId,
    characterName: 'JY Custom Investor',
    principalIsk: String(customPrincipal),
    minCycles: customMinCycles,
  });

  ctx.latestParticipationId = jy.participation.id;
  ctx.lastInitialAmount = parseFloat(jy.participation.amountIsk);

  logSuccess(
    `Created custom JY participation: ${jy.participation.id.substring(0, 8)}`,
  );
  logSuccess(
    `Program ID: ${jy.program.id.substring(0, 8)}, locked=${formatIsk(
      parseFloat(jy.program.lockedPrincipalIsk),
    )}, minCycles=${jy.program.minCycles}`,
  );

  // 3) Assert participation amount is exactly the custom principal
  logStep('3️⃣', 'Verifying participation amount matches custom principal...');
  const parts = await apiCall(
    'GET',
    `/ledger/cycles/${cycle.id}/participations`,
    null,
  );
  const p = parts.find((x: any) => x.id === jy.participation.id);
  if (!p) {
    throw new Error(
      '❌ Custom JY participation not found in cycle participations',
    );
  }
  const amount = parseFloat(p.amountIsk);
  if (amount !== customPrincipal) {
    throw new Error(
      `❌ Participation amount mismatch. Expected ${formatIsk(
        customPrincipal,
      )}, got ${formatIsk(amount)}`,
    );
  }
  logSuccess(
    `✓ Participation amount correctly set to ${formatIsk(customPrincipal)} ISK`,
  );

  // 4) Verify program values via admin list and direct DB
  logStep(
    '4️⃣',
    'Verifying JY program has custom locked principal and minCycles...',
  );

  const programs = await apiCall('GET', '/ledger/jingle-yield/programs', null);
  const program = programs.find((prg: any) => prg.id === jy.program.id);

  if (!program) {
    throw new Error(
      '❌ Custom JY program not found in /ledger/jingle-yield/programs',
    );
  }

  const locked = parseFloat(program.lockedPrincipalIsk);
  const target = parseFloat(program.targetInterestIsk);

  if (locked !== customPrincipal || target !== customPrincipal) {
    throw new Error(
      `❌ Program principal/target mismatch. Expected ${formatIsk(
        customPrincipal,
      )}, got locked=${formatIsk(locked)}, target=${formatIsk(target)}`,
    );
  }

  if (program.minCycles !== customMinCycles) {
    throw new Error(
      `❌ Program minCycles mismatch. Expected ${customMinCycles}, got ${program.minCycles}`,
    );
  }

  if (program.cyclesCompleted !== 0) {
    throw new Error(
      `❌ Expected cyclesCompleted=0 for new program, got ${program.cyclesCompleted}`,
    );
  }

  logSuccess(
    `✓ Program has lockedPrincipal=${formatIsk(
      locked,
    )}, targetInterest=${formatIsk(target)}, minCycles=${program.minCycles}, cyclesCompleted=${program.cyclesCompleted}`,
  );

  // Direct DB sanity check
  const dbProgram = await prisma.jingleYieldProgram.findUnique({
    where: { id: jy.program.id },
  });
  if (!dbProgram) {
    throw new Error('❌ Custom JY program missing in database');
  }

  const dbLocked = Number(dbProgram.lockedPrincipalIsk);
  const dbTarget = Number(dbProgram.targetInterestIsk);

  if (dbLocked !== customPrincipal || dbTarget !== customPrincipal) {
    throw new Error(
      `❌ DB program principal/target mismatch. Expected ${formatIsk(
        customPrincipal,
      )}, got locked=${formatIsk(dbLocked)}, target=${formatIsk(dbTarget)}`,
    );
  }

  if (dbProgram.minCycles !== customMinCycles) {
    throw new Error(
      `❌ DB program minCycles mismatch. Expected ${customMinCycles}, got ${dbProgram.minCycles}`,
    );
  }

  logSuccess(
    '✓ Database JY program matches custom principal and minCycles configuration.',
  );

  printScenarioComplete();
}


