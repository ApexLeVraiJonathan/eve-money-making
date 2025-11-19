<!-- c87371f9-4fef-4a1e-acd4-829214fcd7c7 16d56801-d833-4344-8e59-637a22a48bc7 -->
# Investor Rollover – New E2E Scenario Suite Plan

## Scope & Goals

- Redesign the rollover feature tests into a clear **ordered scenario suite** that exercises all key behaviors and edge cases.
- Target **local/dev environment only**, using dedicated test users and cycles so we can safely create/close cycles and manipulate data.
- Build tests so they are primarily run **sequentially via a suite runner**, with each scenario depending on state produced by earlier scenarios.
- Include **optional interactive pauses** to allow manual UI/UX verification at key checkpoints.

## Behaviors & Edge Cases to Cover

### Core Functional Behaviors

- **First-time cap**: New investor limited to 10B; attempts above 10B rejected with clear error.
- **Cap promotion to 20B**: After at least one successful rollover, `determineMaxParticipation` moves the user to a 20B cap.
- **Rollover creation preconditions**:
- Rollover opt-in only allowed into `PLANNED` cycles.
- Rollover requires an active participation in the current `OPEN` cycle with valid statuses.
- **Rollover types**:
- **FULL_PAYOUT**: Roll over initial + profit up to 20B; residual paid out.
- **INITIAL_ONLY**: Only original principal rolls; entire profit is paid out.
- **CUSTOM_AMOUNT**: Custom amount ≤ initial; surplus between total payout and custom amount is paid out.
- **20B cap on rollover amount**: If payout exceeds 20B, rollover is capped and the excess is paid out.
- **Auto-validation**: Rollover participations are auto-validated (`OPTED_IN`) when the source cycle closes and `processRollovers` runs.
- **Opt-out rules**: Investors can opt-out while the target cycle is `PLANNED` (including rollovers), with correct status transitions / deletions.
- **Memos & payment matching**:
- Rollover memos follow `ROLLOVER-{cycleId:8}-{fromParticipationId:8}`.
- Standard participations use `ARB-{cycleId:8}-{userId:8}`; `matchParticipationPayments` respects these for non-rollover deposits.

### Validation & Error Edge Cases

- **Custom amount > initial** is rejected with a clear message.
- **Participation above cap** (10B or 20B depending on history) is rejected and doesn’t create a dangling record.
- **Rollover without eligible source** (no active participation in current `OPEN` cycle) is rejected.
- **Opt-out invalid states**: Opt-out attempts in `OPEN` or later cycles are rejected with appropriate errors.
- **Idempotency-ish checks**: Re-running `openPlannedCycle` / `processRollovers` in tests shouldn’t create duplicate rollovers for the same source participation.

## Proposed Scenario Chain (@scenarios)

All scenarios will live under `apps/api/scripts/tests/participation-rollover/scenarios` and share a common helper layer in `helpers/`. They will be designed to run **in order** via a suite runner, and each will accept a shared context object (with API config, test user IDs, and key IDs produced by previous steps).

1. **01-first-time-investor-baseline.test.ts**

- Creates a fresh test user (via `testUserId`) and Cycle 1.
- Verifies `GET /ledger/participations/max-amount` returns 10B for that user.
- Creates a 10B participation and verifies attempts >10B fail.
- Matches a donation, opens Cycle 1, and confirms capital and participation status.

2. **02-full-payout-rollover-happy-path.test.ts**

- Reuses the same test user and Cycle 1 from Scenario 1.
- Generates profit in Cycle 1, creates Cycle 2 plus a rollover participation (`FULL_PAYOUT`).
- Opens Cycle 2 (closing Cycle 1), triggers `processRollovers`, and verifies:
- Rollover participation auto-validates to `OPTED_IN`.
- Rollover amount equals total payout (or 20B if capped).
- Original participation’s `payoutAmountIsk` reflects any non-rolled payout.
- Confirms user’s cap is now 20B.

3. **03-initial-only-rollover-flow.test.ts**

- From the post-Scenario-2 state, creates Cycle 3 and a rollover (`INITIAL_ONLY`) from the current `OPEN` cycle participation.
- Generates additional profit so total payout is strictly greater than the initial amount.
- Opens Cycle 3, then verifies:
- Rollover participation amount equals the initial principal.
- Surplus (profit) is marked as payout on the prior participation.

4. **04-custom-amount-rollover-flow.test.ts**

- Builds on Scenario 3 state; creates Cycle 4 for testing custom amount.
- First attempts to create a rollover with `customAmountIsk` > initial, expecting validation error.
- Then creates a valid custom-amount rollover (e.g. 5B), opens the cycle, and verifies:
- Rollover participation reflects exactly the custom amount.
- The payout on the source participation equals total payout − custom amount.

5. **05-excess-payout-above-20b.test.ts**

- Configures a cycle to generate very large profit so that payout > 20B.
- Creates a `FULL_PAYOUT` rollover into the next cycle, opens it, and verifies:
- Rollover participation is capped at 20B.
- The excess (payout − 20B) is correctly recorded as `payoutAmountIsk` on the source.

6. **06-opt-out-planned.test.ts**

- Creates a fresh PLANNED cycle and a participation (or rollover) for the test user.
- After donation matching, while the cycle is still `PLANNED`, calls the opt-out endpoint.
- Verifies that the participation is either deleted (if still `AWAITING_INVESTMENT`) or set to `OPTED_OUT` with `optedOutAt` (if `OPTED_IN`).
- Also attempts opt-out on a non-PLANNED cycle (e.g., one of the earlier cycles) and asserts a proper error.

7. **07-negative-paths-and-guardrails.test.ts** (optional but recommended)

- Rollover creation with no `OPEN` cycle or no eligible participation → error.
- Trying to create multiple participations for the same user/cycle → observe idempotent behavior.
- Invalid `rollover.type` or malformed payloads, ensuring DTO validation errors are clear.

## Test Harness & Execution Model

- **Helpers**: Centralize API calls, test context, and common operations in `helpers/` (you already have a good base there; we’ll refine it rather than re-invent it).
- **Shared context**: Introduce a `SharedRolloverContext` type that can hold IDs and amounts (cycle IDs, participation IDs, testUserIds, last payout values) to pass between scenarios in the suite runner.
- **Suite runner**: Create a single `participation-rollover.suite.ts` that:
- Parses CLI flags (API URL, token/apiKey, logistics characterId, `--interactive`).
- Instantiates the shared context and runs Scenarios 01 → 06/07 in order.
- Handles failures with clear output but stops further scenarios when a critical precondition fails.
- **Standalone execution**: Each scenario file keeps a small `if (require.main === module)` block so it can be run individually for debugging, but the primary, supported path is via the suite runner.

## Interactive Pauses for UI/UX Validation

- Provide a `waitForUser` helper (or reuse the existing one) that blocks on ENTER with a clear prompt.
- Gate pauses behind a `--interactive` or `--no-pauses` flag in the suite config:
- Non-interactive mode: no pauses → suitable for quick regression runs.
- Interactive mode: insert pauses after key transitions:
- After creating the first participation and opening Cycle 1.
- After creating rollover participations and opening the next cycle (to inspect UI states).
- After opt-out operations to inspect admin views.

## Implementation Todos

- **design-scenario-api**: Finalize the shared `TestConfig`, `SharedRolloverContext`, and helper functions contract that all scenarios will use.
- **implement-ordered-scenarios**: Rewrite the existing rollover tests into the new ordered `01`–`06/07` scenario files, using the agreed behaviors and edge cases.
- **add-suite-runner**: Implement `participation-rollover.suite.ts` to run all scenarios sequentially with CLI flags and optional `--interactive` pauses.
- **document-usage**: Add a short doc section (or README snippet) explaining how to run the suite in dev, recommended flags, and where in the UI to look during pauses.
- **cleanup-legacy-e2e**: Once the new suite is green, deprecate or simplify the old `e2e-participation-rollover-test.ts` to either call the suite or be removed to avoid duplication.

### To-dos

- [ ] Verify rollover-related database migrations and regenerate Prisma client in dev, staging, and production environments before exercising the feature.
- [ ] Run and stabilize all participation rollover scenario scripts (01, 02, 03, 04, 05, 09) against the dev API using a test database, fixing any logic or data issues until passing.
- [ ] Execute the main e2e-participation-rollover-test.ts script against dev and staging (with and without interactive pauses) to validate the full flow across backend and frontend.
- [ ] Manually QA the frontend opt-in dialog and related investor views to ensure rollover messaging, caps, and error handling are correct and user-friendly.
- [ ] Roll out the feature to staging and then production, run smoke tests, monitor logs/metrics, and publish user-facing release notes about the new auto reinvest options and caps.