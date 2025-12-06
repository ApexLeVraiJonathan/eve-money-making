/**
 * Scenario 04: Enforce 10B User Principal Cap with Active JY Program
 *
 * Goal:
 * - Verify that when a user has an ACTIVE JingleYield program with locked
 *   principal, any new non-rollover participation is capped so that:
 *      userPrincipal + jyPrincipal <= 10B
 *   and that attempts to exceed this cap result in a 400 Bad Request with a
 *   clear error message.
 *
 * Flow:
 * 1) Ensure there is at least one ACTIVE JY program (use the most recent).
 * 2) Compute remainingPrincipalCap = 10B - lockedPrincipalIsk.
 * 3) Plan a new PLANNED cycle.
 * 4) Create a participation for the JY user with amount == remainingPrincipalCap
 *    → should succeed.
 * 5) Plan another PLANNED cycle.
 * 6) Attempt to create a participation with amount > remainingPrincipalCap
 *    → should fail with 400 and "Participation amount exceeds maximum allowed".
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
  logWarning,
  printScenarioHeader,
  printScenarioComplete,
} from '../helpers';

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});

export async function scenario04JingleYieldPrincipalCap(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader(
    '📊',
    'SCENARIO 04: 10B User Principal Cap with Active JY Program',
  );

  if (!config.testUserId) {
    throw new Error(
      'Missing --testUserId. Provide a real user ID for Scenario 04.',
    );
  }

  const apiCall = createApiCall(config);

  // 1) Find all ACTIVE JingleYield programs for this user and compute the total
  //    locked principal. This mirrors the logic in ParticipationService.
  logStep(
    '1️⃣',
    'Finding ACTIVE JingleYield programs and computing total locked principal...',
  );
  const jyPrograms = await prisma.jingleYieldProgram.findMany({
    where: {
      userId: config.testUserId,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!jyPrograms.length) {
    throw new Error(
      '❌ Scenario 04 requires at least one ACTIVE JingleYield program for the test user.',
    );
  }

  const totalJyPrincipal = jyPrograms.reduce(
    (sum, p) => sum + Number(p.lockedPrincipalIsk),
    0,
  );
  logSuccess(
    `Total locked JY principal across ACTIVE programs: ${formatIsk(totalJyPrincipal)} ISK ` +
      `(programs: ${jyPrograms.map((p) =>
        p.id.substring(0, 8),
      ).join(', ')})`,
  );

  const TOTAL_CAP = 10_000_000_000;
  const remainingPrincipalCap = Math.max(0, TOTAL_CAP - totalJyPrincipal);

  if (remainingPrincipalCap <= 0) {
    throw new Error(
      `❌ Remaining principal cap is non-positive (totalJyPrincipal=${formatIsk(
        totalJyPrincipal,
      )}). Adjust test data so total JY principal < 10B.`,
    );
  }

  logSuccess(
    `Remaining user principal cap = ${formatIsk(
      remainingPrincipalCap,
    )} ISK (10B - JY principal).`,
  );

  // 2) Plan a new cycle and create a participation at the cap (should succeed).
  logStep(
    '2️⃣',
    'Planning Cycle A and creating participation at remaining cap (should succeed)...',
  );
  const cycleA = await createCycle(apiCall, 'JY Suite - Principal Cap A');
  ctx.cycleIds.push(cycleA.id);

  const okAmountStr = remainingPrincipalCap.toFixed(2);
  const okParticipation = await apiCall(
    'POST',
    `/ledger/cycles/${cycleA.id}/participations`,
    {
      amountIsk: okAmountStr,
      characterName: 'Cap Test Investor',
      testUserId: config.testUserId,
    },
  );

  logSuccess(
    `Created participation at cap in Cycle A: ${okParticipation.id.substring(
      0,
      8,
    )} amount=${formatIsk(Number(okParticipation.amountIsk))} ISK`,
  );

  // 3) Plan another cycle and attempt to exceed the cap (should fail).
  logStep(
    '3️⃣',
    'Planning Cycle B and attempting participation above cap (should fail)...',
  );
  const cycleB = await createCycle(apiCall, 'JY Suite - Principal Cap B');
  ctx.cycleIds.push(cycleB.id);

  const overAmount = remainingPrincipalCap + 1_000_000_000; // +1B over cap
  const overAmountStr = overAmount.toFixed(2);

  try {
    await apiCall('POST', `/ledger/cycles/${cycleB.id}/participations`, {
      amountIsk: overAmountStr,
      characterName: 'Cap Test Investor',
      testUserId: config.testUserId,
    });

    logWarning(
      'API call unexpectedly succeeded when trying to exceed principal cap.',
    );
    throw new Error(
      '❌ Expected participation creation above cap to fail, but it succeeded.',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // We expect a 400 Bad Request with our specific error message.
    if (!msg.includes('400 Bad Request')) {
      throw new Error(
        `❌ Expected 400 Bad Request when exceeding principal cap, got:\n${msg}`,
      );
    }
    if (!msg.includes('Participation amount exceeds maximum allowed')) {
      throw new Error(
        `❌ Expected error message about principal cap, got:\n${msg}`,
      );
    }
    logSuccess(
      '✓ Creating participation above (10B - JY principal) correctly fails with 400 and cap error.',
    );
  }

  printScenarioComplete();
}


