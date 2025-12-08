/**
 * Scenario 04: FULL_PAYOUT Rollover + Extra (Numerical Model)
 *
 * Goal:
 * - Capture the intended numerical behavior for FULL_PAYOUT rollovers when the
 *   user adds extra ISK on top of their rolled principal:
 *   1) Effective principal (previous principal + user extra) must never exceed 10B.
 *   2) Total rolled amount (payout + extra) must never exceed 20B; any excess
 *      is paid out to the user instead of being rolled.
 *
 * Notes:
 * - This scenario is **purely numeric** – it does not call HTTP APIs or touch
 *   the database. End-to-end behavior (including PayoutService.processRollovers)
 *   is covered by the dedicated participation-rollover test suite.
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

export async function scenario04FullRolloverExtraModel(
  _config: TestConfig,
  _ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader(
    '🧮',
    'SCENARIO 04: FULL_PAYOUT Rollover + Extra (Model)',
  );

  // ---------------------------------------------------------------------------
  // Case A: Principal cap – 9B base principal + 1B extra → 10B (allowed)
  // ---------------------------------------------------------------------------
  logStep(
    '1️⃣',
    'Case A: P=9B, user extra=1B → expect principal=10B (at cap, but allowed)',
  );

  const basePrincipalA = 9_000_000_000;
  const existingExtraA = 0;
  const newExtraA = 1_000_000_000;

  const newPrincipalA = basePrincipalA + existingExtraA + newExtraA;

  if (newPrincipalA > 10_000_000_000) {
    throw new Error(
      `❌ Case A: Principal exceeded 10B cap: ${formatIsk(newPrincipalA)}`,
    );
  }

  logSuccess(
    `Case A OK: effective principal=${formatIsk(
      newPrincipalA,
    )} ISK (≤ 10B cap).`,
  );

  // ---------------------------------------------------------------------------
  // Case B: Principal cap – attempting to push principal above 10B
  // ---------------------------------------------------------------------------
  logStep(
    '2️⃣',
    'Case B: P=9B, existing extra=1B, new extra=2B → should be rejected (>10B).',
  );

  const basePrincipalB = 9_000_000_000;
  const existingExtraB = 1_000_000_000;
  const newExtraB = 2_000_000_000;

  const newPrincipalB = basePrincipalB + existingExtraB + newExtraB;

  if (newPrincipalB <= 10_000_000_000) {
    throw new Error(
      `❌ Case B: Principal did NOT exceed 10B when it should have: ${formatIsk(
        newPrincipalB,
      )}`,
    );
  }

  logSuccess(
    `Case B OK: proposed principal=${formatIsk(
      newPrincipalB,
    )} ISK would exceed 10B and must be rejected by the service.`,
  );

  // ---------------------------------------------------------------------------
  // Case C: Total cap – payout + extra capped at 20B
  // ---------------------------------------------------------------------------
  logStep(
    '3️⃣',
    'Case C: payout=25B, user extra=1B → rolled total should be capped at 20B.',
  );

  const payoutC = 25_000_000_000; // total payout from previous cycle
  const userExtraC = 1_000_000_000; // extra added on top of rollover

  const totalBeforeCapsC = payoutC + userExtraC; // 26B
  const cappedTotalC = Math.min(totalBeforeCapsC, 20_000_000_000); // 20B

  // Portion funded by payout cannot exceed the payout itself and must leave room
  // for the user extra inside the 20B total cap.
  const rolledFromPayoutC = Math.min(payoutC, cappedTotalC - userExtraC); // 19B
  const rolledTotalC = rolledFromPayoutC + userExtraC; // 20B
  const payoutToUserC = payoutC - rolledFromPayoutC; // 6B remaining to pay out

  if (rolledTotalC > 20_000_000_000) {
    throw new Error(
      `❌ Case C: Rolled total exceeded 20B cap: ${formatIsk(rolledTotalC)}`,
    );
  }

  if (payoutToUserC < 0) {
    throw new Error(
      `❌ Case C: Computed negative payout to user: ${formatIsk(payoutToUserC)}`,
    );
  }

  logSuccess(
    `Case C OK: rolled total=${formatIsk(
      rolledTotalC,
    )} ISK (capped at 20B), payout to user=${formatIsk(
      payoutToUserC,
    )} ISK (excess above cap).`,
  );

  logSuccess(
    '✓ FULL_PAYOUT rollover + extra model obeys 10B principal cap and 20B total cap (payout + extra).',
  );

  printScenarioHeader('✅', 'SCENARIO 04 COMPLETE');
  printScenarioComplete();
}
