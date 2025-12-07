/**
 * Scenario 01: Normal Participation Increase (Interactive)
 *
 * Goal:
 * - Verify that a user can increase a normal participation while the cycle
 *   is PLANNED, and that the amount is updated correctly while the status
 *   is reset to AWAITING_INVESTMENT.
 *
 * Flow:
 * 1) Create a PLANNED cycle for the suite.
 * 2) Create a 1B participation for the test user via admin API.
 * 3) Pause and instruct the operator to:
 *    - Open the web app as the test user.
 *    - Go to Tradecraft → Next Cycle.
 *    - Click "Increase Participation" and add 2B ISK.
 * 4) After confirmation, verify via API that:
 *    - Participation amount is 3B.
 *    - Status is AWAITING_INVESTMENT.
 */

import {
  type TestConfig,
  type SharedRolloverContext,
  createApiCall,
  createCycle,
  getParticipations,
  formatIsk,
  logStep,
  logSuccess,
  waitForUser,
  printScenarioHeader,
  printScenarioComplete,
} from '../helpers';

export async function scenario01NormalParticipationIncrease(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader(
    '💹',
    'SCENARIO 01: Normal Participation Increase (Interactive)',
  );

  if (!config.testUserId) {
    throw new Error(
      'Missing --testUserId. Provide a real user ID for Scenario 01.',
    );
  }

  const apiCall = createApiCall(config);

  // 1) Create PLANNED cycle
  logStep('1️⃣', 'Creating PLANNED test cycle for participation increase...');
  const cycle = await createCycle(apiCall, 'PI Suite - Normal Increase');
  ctx.cycleIds.push(cycle.id);
  logSuccess(
    `Cycle created: ${cycle.id.substring(0, 8)} (${cycle.name ?? 'unnamed'})`,
  );

  // 2) Create a 1B participation for the test user
  const initialAmount = 1_000_000_000; // 1B

  logStep(
    '2️⃣',
    `Creating initial 1B participation for test user ${config.testUserId}...`,
  );

  const participation = await apiCall(
    'POST',
    `/ledger/cycles/${cycle.id}/participations`,
    {
      amountIsk: initialAmount.toFixed(2),
      characterName: 'PI Test Investor',
      testUserId: config.testUserId,
    },
  );

  logSuccess(
    `Initial participation created: ${participation.id.substring(
      0,
      8,
    )} amount=${formatIsk(initialAmount)} ISK`,
  );

  // 3) Pause for interactive UI increase
  const delta = 2_000_000_000; // 2B
  await waitForUser(
    config,
    [
      'Open the frontend and log in as the test user.',
      'Navigate to Tradecraft → Next Cycle.',
      `You should see a 1B participation in "PI Suite - Normal Increase".`,
      `Click "Increase Participation" and enter an additional ${formatIsk(
        delta,
      )} ISK (so the total becomes 3B).`,
      '',
      'Do NOT send ISK in-game for this scenario; we are only validating the UI + API wiring.',
    ].join('\n   '),
  );

  // 4) Verify updated participation via API
  logStep(
    '3️⃣',
    'Verifying updated participation amount and status via admin API...',
  );

  const parts = await getParticipations(apiCall, cycle.id);
  const updated = parts.find((p: any) => p.id === participation.id);

  if (!updated) {
    throw new Error('❌ Updated participation not found after increase');
  }

  const amount = Number(updated.amountIsk);
  const expectedTotal = initialAmount + delta;

  if (amount !== expectedTotal) {
    throw new Error(
      `❌ Participation amount mismatch after increase. Expected ${formatIsk(
        expectedTotal,
      )}, got ${formatIsk(amount)}`,
    );
  }

  if (updated.status !== 'AWAITING_INVESTMENT') {
    throw new Error(
      `❌ Expected status AWAITING_INVESTMENT after increase, got ${updated.status}`,
    );
  }

  logSuccess(
    `✓ Participation successfully increased to ${formatIsk(
      amount,
    )} ISK with status AWAITING_INVESTMENT.`,
  );

  printScenarioComplete();
}


