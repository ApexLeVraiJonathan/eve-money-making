# PRD: Pre-Main Tradecraft Acceptance Testing

## Problem Statement

The Tradecraft branch has had broad refactoring across API, web, shared contracts, Cycle Lifecycle, settlement, participation, rollover, and admin surfaces. Before pushing to `main`, we need confidence that the app still behaves correctly, remains usable, and does not silently break money workflows.

The risk is not just whether the code compiles. The highest-risk failures are wrong ISK totals, broken Participation state, lost Rollover Intent, unusable admin flows, incorrect Settlement Reports, broken API/BFF wiring, and regressions in JingleYield Program behavior.

## Solution

Create and execute a pre-main Tradecraft acceptance testing strategy that treats business correctness as the primary release gate.

The solution uses a deterministic seeded acceptance dataset, exact API-level checks for money/state invariants, lightweight UI/browser checks for operability, technical gates around build/type/lint/unit tests, and final domain-owner signoff. Live EVE, Discord, OAuth, and market integrations are checked separately so the core gate stays deterministic.

## User Stories

1. As the product owner, I want a clear pre-main acceptance gate, so that I can merge refactors without guessing whether core Tradecraft behavior still works.
2. As the product owner, I want blocking failures defined around money movement, auth boundaries, and admin operability, so that the team knows which failures must stop the push.
3. As an admin, I want Cycle planning, opening, and settlement verified, so that the Cycle Lifecycle remains usable after refactoring.
4. As an admin, I want Cycle Settlement verified with strict and recoverable steps, so that failed money workflows stop or continue in the correct places.
5. As an admin, I want Settlement Reports verified, so that I can see which strict steps succeeded and which recoverable steps need follow-up.
6. As an admin, I want No Open Cycle Period behavior verified, so that settling without a successor Cycle does not leave the app in an ambiguous state.
7. As a user, I want Participation creation and management verified, so that my committed ISK position is represented correctly through validation, payout, refund, rollover, or program completion.
8. As a user, I want Rollover Intent verified before and after settlement, so that my rollover choice is stored and applied correctly.
9. As an admin, I want Payment Matching verified, so that incoming wallet payments can be connected to pending Participations.
10. As an admin, I want Transaction Allocation verified separately from Payment Matching, so that buy/sell wallet activity is allocated to Cycle Lines without confusing it with Participation payments.
11. As an admin, I want Tradecraft Caps verified, so that users cannot exceed principal or maximum caps through normal or admin-created Participations.
12. As an admin, I want payout suggestions, payout finalization, and payout marking verified, so that settlement follow-up remains reliable.
13. As an admin, I want refunds verified, so that imperfect Participation states can be resolved through supported Admin Recovery Flows.
14. As an admin, I want JingleYield Program behavior tested as first-class behavior, so that program-specific minimum Cycles, principal handling, interest targets, rollover, backfill, and completion outcomes remain correct.
15. As an admin, I want profit, NAV, fees, and snapshots verified, so that financial reporting remains coherent after the refactor.
16. As a user, I want public Tradecraft overview, history, details, and investment pages to load, so that I can inspect current and past Tradecraft state.
17. As an admin, I want admin pages to load and expose the needed controls, so that I can operate the app without falling back to ad hoc scripts.
18. As a developer, I want shared API contracts verified, so that web and API changes do not drift across package boundaries.
19. As a developer, I want Next route handlers verified against Nest routes, so that browser calls continue to go through the BFF boundary.
20. As a developer, I want query keys and invalidation checked for mutations, so that UI state refreshes after important actions.
21. As a developer, I want existing scenario suites reused where possible, so that we build on prior coverage instead of starting from scratch.
22. As a developer, I want a canonical seeded dataset, so that acceptance failures are deterministic and actionable.
23. As a developer, I want a separate dirty-data smoke pass, so that existing dev data can expose migration or refactor assumptions.
24. As the product owner, I want rough performance smoke timings, so that obviously unusable regressions are caught without inventing premature hard budgets.
25. As the product owner, I want final human signoff after automated and browser checks, so that real business expectations are checked before `main`.

## Implementation Decisions

- Use the existing domain language from `CONTEXT.md`: Cycle Lifecycle, Open Cycle, No Open Cycle Period, Cycle Settlement, Settlement Report, Strict Settlement Step, Recoverable Settlement Step, Cycle Rollover, Rollover Intent, Participation, Payment Matching, JingleYield Program, and Admin Recovery Flow.
- Treat the scope as a full Tradecraft acceptance pass, with deeper automated coverage around behavior changed or made riskier by the refactor.
- Use a deterministic seeded dataset as the primary gate and a dirty-data smoke pass as a separate secondary confidence check.
- Keep live external integrations out of the deterministic gate. EVE, Discord, OAuth, and market integrations get separate smoke checks.
- Keep API tests deep and exact for state changes and money numbers.
- Keep UI tests/browser checks lighter and focused on whether user/admin flows are operable.
- Treat standalone scripts as support tooling unless a script is explicitly promoted into an official operational path.
- Use the existing scenario suites for Participation rollover, Participation increase, and JingleYield as prior art for seeded acceptance behavior.
- Use existing Playwright API/UI tests as prior art for admin Participation and browser operability checks.
- Do not introduce a heavier schema framework solely for this gate unless a concrete contract gap appears.

Major modules to build or modify:

- Canonical seeded acceptance dataset module: creates known Open Cycle, Planned Cycle, Participations, Rollover Intents, JingleYield Program case, wallet journal rows, Cycle Lines, fees, and imperfect admin-recovery states.
- Acceptance runner or checklist module: orchestrates technical gates, seeded scenarios, dirty-data smoke, browser smoke, and human signoff state.
- Cycle Lifecycle acceptance coverage: verifies plan/open/settle/No Open Cycle Period and Settlement Report outcomes.
- Participation and Rollover acceptance coverage: verifies caps, Participation lifecycle, Rollover Intent, payout versus rollover outcomes, opt-out/full/custom/initial-only cases.
- Admin Recovery Flow coverage: verifies product/API-supported recovery for unmatched payments, validation, refunds, payout marking, recoverable settlement failures, and JingleYield rollover backfill.
- Financial reporting coverage: verifies fees, profit, NAV, payout, and snapshots on seeded values.
- API/BFF/shared-contract coverage: verifies shared contracts, package export usage, Next route proxying, web hooks, and query invalidation.
- Browser smoke checklist: verifies public/user/admin pages and controls are usable for the seeded flows.

## Testing Decisions

Good tests for this work verify external behavior and domain invariants, not implementation details. The strongest tests should assert observable state, response shape, database state where appropriate, exact money totals, and user/admin operability.

Testing will prioritize:

- Cycle Lifecycle and Cycle Settlement behavior.
- Settlement Report strict and recoverable step semantics.
- Participation lifecycle and Payment Matching.
- Rollover Intent and Cycle Rollover outcomes.
- Tradecraft Caps enforcement.
- Payout, refund, profit, NAV, fees, and snapshots.
- JingleYield Program scenarios.
- Admin Recovery Flows.
- API/BFF/shared-contract wiring.
- Browser smoke for public, user, and admin Tradecraft pages.

Prior art in the codebase includes:

- Participation rollover scenario suite.
- Participation increase scenario suite.
- JingleYield scenario suite.
- Playwright API tests for admin manual Participation in an Open Cycle.
- Playwright UI tests for admin manual Participation.
- Existing Jest service tests for Cycle Lifecycle, rollover, payout, caps, profit, pricing, market query services, notifications, auth, and jobs.

The technical command gate is:

```powershell
pnpm type-check
pnpm lint
pnpm build
pnpm test
```

Performance testing is a smoke check, not a hard benchmark gate. Block only when a core page or admin action is unusable, times out, or obviously regresses.

## Out of Scope

- Full automation for every UI screen.
- Hard performance budgets before baseline timings exist.
- Running the deterministic acceptance gate against live EVE, Discord, OAuth, or market services.
- Treating every standalone script as an official release-blocking operational path.
- Introducing a new schema or test framework without a concrete contract or testing gap.
- Refactoring unrelated product behavior while building the acceptance gate.

## Further Notes

The operational plan lives in `docs/testing/pre-main-tradecraft-acceptance.md`. This PRD should be broken into concrete tasks for seed data, missing API tests, missing browser smoke checks, command execution, and final domain-owner signoff.

Local markdown is the source of truth for this PRD. Any issue tracker copies are secondary and may drift.
