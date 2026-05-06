---
category: enhancement
state: resolved
---

# Verify Participation, Caps, Payment Matching, And Rollover Intent

Type: AFK

## Parent

[`../prd/pre-main-tradecraft-acceptance-testing.md`](../prd/pre-main-tradecraft-acceptance-testing.md)

## What to build

Extend seeded scenario and API coverage for the Participation lifecycle, caps, Payment Matching, Transaction Allocation boundaries, Rollover Intent storage, and rollover outcomes. This slice should prove user money choices survive through validation and settlement.

## Acceptance criteria

- [x] Tests prove normal Participation creation stores the correct user, Cycle, amount, status, and principal values.
- [x] Tests prove unpaid or unvalidated Participations remain distinguishable from validated Participations.
- [x] Tests prove Tradecraft Caps block over-limit Participation changes without mutating Cycle capital.
- [x] Tests prove Payment Matching connects seeded wallet journal rows to pending Participations.
- [x] Tests keep Payment Matching distinct from Transaction Allocation for buy/sell wallet activity.
- [x] Tests prove full-payout or opt-out Rollover Intent produces the expected payout outcome.
- [x] Tests prove initial-only or custom Rollover Intent produces the expected rollover/payout split.
- [x] Tests verify relevant query/API responses expose the state needed by user and admin flows.

## Blocked by

- [`001-create-canonical-tradecraft-acceptance-seed.md`](001-create-canonical-tradecraft-acceptance-seed.md)
