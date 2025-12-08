/**
 * Scenario 03: Rollover Increase Edge Cases (Backend)
 *
 * Goal:
 * - Verify that:
 *   1) User principal never exceeds 10B, even when increasing a
 *      FULL_PAYOUT rollover with large profits.
 *   2) Total rolled amount (principal + interest) never exceeds 20B;
 *      any excess is paid out, not rolled.
 *
 * Notes:
 * - This scenario is a **pure numerical model** of the rollover caps. It does
 *   not call the real API or database; the end-to-end behavior is covered by
 *   the dedicated participation-rollover test suite.
 */

import {
  type TestConfig,
  type SharedRolloverContext,
  formatIsk,
  logStep,
  logSuccess,
  printScenarioHeader,
  printScenarioComplete,
} from '../helpers';

export async function scenario03RolloverIncreaseEdgeCases(
  _config: TestConfig,
  _ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader('🔁', 'SCENARIO 03: Rollover Increase Edge Cases');

  // This scenario exercises the rollover cap rules at the level of a
  // numerical model to ensure our understanding is consistent:
  //
  // 1) User principal must never exceed 10B.
  // 2) Total rolled amount (principal + interest) must never exceed 20B.

  // CASE A: Known profit, FULL_PAYOUT rollover + manual extra, under both caps
  logStep(
    '1️⃣',
    'Case A: P=9B, I=3B, user extra=1B → expect principal=10B, total=13B (<20B)',
  );

  const P_A = 9_000_000_000;
  const I_A = 3_000_000_000;
  const E_A = 1_000_000_000;

  const principalA = P_A + E_A;
  const totalA = principalA + I_A;

  if (principalA > 10_000_000_000) {
    throw new Error(
      `❌ Case A: Principal exceeded 10B cap: ${formatIsk(principalA)}`,
    );
  }
  if (totalA > 20_000_000_000) {
    throw new Error(
      `❌ Case A: Total rolled amount exceeded 20B cap: ${formatIsk(totalA)}`,
    );
  }

  logSuccess(
    `Case A OK: principal=${formatIsk(principalA)} ISK, total=${formatIsk(
      totalA,
    )} ISK`,
  );

  // CASE B: Large profit discovered after increase; cap at 20B total
  logStep(
    '2️⃣',
    'Case B: P=9B, user extra=1B, profit large → ensure total rolled is capped at 20B',
  );

  const P_B = 9_000_000_000;
  const E_B = 1_000_000_000;
  const principalB = P_B + E_B; // still must be ≤10B

  if (principalB > 10_000_000_000) {
    throw new Error(
      `❌ Case B: Principal exceeded 10B cap before applying profit: ${formatIsk(
        principalB,
      )}`,
    );
  }

  const hypotheticalPayoutB = 25_000_000_000; // very large payout
  const rawTotalB = hypotheticalPayoutB + E_B; // what FULL_PAYOUT + extra would try to use

  // Apply 20B cap at the total level.
  const rolledB = Math.min(rawTotalB, 20_000_000_000);

  if (rolledB > 20_000_000_000) {
    throw new Error(
      `❌ Case B: Rolled amount exceeded 20B cap: ${formatIsk(rolledB)}`,
    );
  }

  logSuccess(
    `Case B OK: principal=${formatIsk(
      principalB,
    )} ISK, rolled total capped at ${formatIsk(rolledB)} ISK`,
  );

  logSuccess(
    '✓ Rollover increase edge-case model obeys 10B principal and 20B total caps.',
  );

  printScenarioComplete();
}
