---
category: enhancement
state: resolved
---

# Verify Cycle Lifecycle And Settlement Report Acceptance

Type: AFK

## Parent

[`../prd/pre-main-tradecraft-acceptance-testing.md`](../prd/pre-main-tradecraft-acceptance-testing.md)

## What to build

Add or adapt acceptance coverage proving the Cycle Lifecycle works end to end from the canonical seed. The tests should verify planning, opening, settling, No Open Cycle Period behavior, and Settlement Report contents from the public product/API behavior rather than internal implementation details.

## Acceptance criteria

- [x] Tests prove an admin can open a Planned Cycle through the Cycle Lifecycle Entry Point.
- [x] Tests prove opening a Planned Cycle settles the prior Open Cycle first.
- [x] Tests prove settling an Open Cycle without a successor creates a No Open Cycle Period.
- [x] Tests prove Strict Settlement Step failure blocks the unsafe transition.
- [x] Tests prove Recoverable Settlement Step failure is surfaced without incorrectly blocking the next Open Cycle.
- [x] Tests assert Settlement Report `settledCycleId`, `targetCycleId`, step order, step status, and recoverable failures.
- [x] Tests verify there is at most one Open Cycle after the transition.
- [x] Tests can be run from the documented acceptance seed.

## Blocked by

- [`001-create-canonical-tradecraft-acceptance-seed.md`](001-create-canonical-tradecraft-acceptance-seed.md)
