# Pre-Main Tradecraft Acceptance Plan

This plan is the release gate for pushing the current Tradecraft refactor to `main`.
It is intentionally operational, not an ADR: update it as the test surface changes.

## Goal

Prove the app still behaves correctly and remains usable across the full Tradecraft product surface, with deeper checks where refactoring changed money flow, API/BFF wiring, or shared contracts.

The strategy is:

- Business correctness first.
- Deterministic seeded acceptance before dirty-data smoke testing.
- API-level checks for exact state and money invariants.
- UI/browser checks for real user/admin operability.
- Live external integrations checked separately from the core gate.

## Release-Blocking Failures

A failure blocks the push when it affects money movement, auth boundaries, or admin operability.

Blocking examples:

- Wrong ISK totals, profit, NAV, cap, payout, or rollover outcome.
- Broken Payment Matching, validation, refund, payout marking, or admin recovery.
- Broken Cycle Lifecycle transition, Cycle Settlement, Settlement Report, or No Open Cycle Period behavior.
- Lost or incorrectly applied Rollover Intent.
- JingleYield Program behavior producing the wrong Participation, rollover, completion, or backfill outcome.
- API/BFF route failure that prevents web flows from reaching Nest.
- Admin or user pages unusable for the acceptance surface.
- Auth/role behavior allowing the wrong user action or blocking an allowed one.

Non-blocking examples, unless they make a workflow unusable:

- Minor copy issues.
- Minor layout polish.
- Performance variance without visible user impact or timeout.

## Acceptance Surface

The minimum pre-main surface is the full Tradecraft acceptance pass:

- Public/user Tradecraft pages load and show Cycle and Participation state correctly.
- Users can create and manage Participation and Rollover Intent without broken caps or auth behavior.
- Admins can plan, open, and settle Cycles, including entering a No Open Cycle Period.
- Admin financial operations work: wallet import, Transaction Allocation, fees, payouts, profit, NAV, and snapshots.
- Admin Recovery Flows work for imperfect money states.
- JingleYield Program behavior is tested as first-class behavior, not only as normal Participation behavior.
- API/BFF/shared-contract wiring works from web hooks to Next route handlers to Nest API.

## Canonical Seeded Dataset

The deterministic acceptance pass should start from a clean database and one canonical dataset.

The dataset should include:

- One Open Cycle.
- One Planned Cycle.
- Several normal Participations.
- At least one unpaid or unvalidated Participation.
- One full-payout or opt-out Rollover Intent.
- One initial-only or custom Rollover Intent.
- One JingleYield Program case.
- Wallet journal rows that can be Payment Matched.
- Cycle Lines with buys, sells, and fees so profit, NAV, payout, and settlement can be checked.
- At least one imperfect state that requires an Admin Recovery Flow.

Run this gate from a known seeded state so failures point to the code, not leftover dev data.

Seed command:

```powershell
pnpm -C apps/e2e seed:tradecraft acceptance:tradecraft
```

This seed resets Tradecraft data in the configured local/dev database. Do not run it against production.

After the clean seeded pass, run a separate smoke pass against realistic dirty dev data to catch migration/refactor assumptions.

## Automated Gates

Run these before the manual signoff pass:

```powershell
pnpm type-check
pnpm lint
pnpm build
pnpm test:api
pnpm test:web
```

Targeted suites should cover:

- Cycle Lifecycle service behavior.
- Settlement Report strict and recoverable step behavior.
- Participation, caps, Rollover Intent, and Cycle Rollover outcomes.
- Payout, profit, NAV, snapshots, and fee calculations.
- JingleYield Program scenarios.
- Payment Matching and admin recovery behavior.
- API/BFF/shared-contract wiring.

API tests should verify exact state changes and money numbers. UI tests should stay lighter: prove that the user/admin can perform or inspect the flow.

## Browser And Human Checks

Use browser automation for repeatable smoke checks and obvious UI breakage. The domain owner still performs final signoff on money/admin workflows.

Required browser smoke:

- Public Tradecraft overview/history/details pages load.
- User investment pages show Participation state and Rollover Intent controls correctly.
- Admin cycles page can plan/open/settle and show Settlement Report outcomes.
- Admin participations page supports matching, validation, refunds, payout state, and recovery inspection.
- Admin profit/capital/fees/snapshots pages load and show coherent seeded values.
- JingleYield admin/user pages show seeded program state.

Final human signoff should confirm the displayed values and operational flow match the real business expectations.

## Performance Smoke

Performance is a measured smoke check for this push, not a hard benchmark gate.

Block only if a core page or admin action is obviously unusable, times out, or regresses enough to prevent the acceptance flow. Capture rough timings for baseline comparison, especially:

- Tradecraft overview.
- Cycle details.
- Admin cycles.
- Admin participations.
- Profit/capital pages.
- Cycle Settlement action.

## External Integrations

The core gate should not rely on live EVE, Discord, OAuth, or market services.

Use seeded or mocked data for deterministic acceptance. Run live integration smoke checks separately and treat failures as release-blocking only when the app code is clearly broken rather than the external service being unavailable.

## API Contract Gate

Keep this lightweight but explicit:

- Shared API shapes used by both apps live in `packages/shared`.
- Consumers import shared types through package exports, not source/build internals.
- Web calls Next route handlers rather than Nest directly from the browser.
- Next route handlers proxy the expected Nest routes.
- Query keys and hooks invalidate/refetch the data affected by mutations.
- Full workspace type-check passes.

Do not add a heavier schema framework only for this gate unless a concrete contract gap appears.

## Exit Criteria

The branch is ready to push to `main` when:

- Technical gates pass.
- Deterministic seeded acceptance passes.
- Dirty-data smoke finds no release-blocking assumptions.
- Browser smoke finds no unusable critical page or admin/user flow.
- Performance smoke finds no obvious timeout or unusable slowdown.
- Live integration smoke has been checked separately or consciously deferred.
- Domain-owner signoff is complete.
