---
category: enhancement
state: ready-for-agent
---

# Create Canonical Tradecraft Acceptance Seed

Type: AFK

## Parent

[`../prd/pre-main-tradecraft-acceptance-testing.md`](../prd/pre-main-tradecraft-acceptance-testing.md)

## What to build

Build a deterministic Tradecraft acceptance seed that creates the known data required by the pre-main acceptance gate. The seed should make downstream tests meaningful without depending on leftover dev data or live external services.

The seeded state should include an Open Cycle, a Planned Cycle, normal Participations, Rollover Intents, one JingleYield Program case, wallet journal rows for Payment Matching, Cycle Lines with trading activity, fees, and at least one imperfect state for an Admin Recovery Flow.

## Acceptance criteria

- [x] A clean local/dev database can be seeded with the canonical Tradecraft acceptance dataset.
- [x] The seed includes one Open Cycle and one Planned Cycle with stable identifiers or discoverable names.
- [x] The seed includes several normal Participations, including at least one unpaid or unvalidated Participation.
- [x] The seed includes at least one full-payout or opt-out Rollover Intent and one initial-only or custom Rollover Intent.
- [x] The seed includes one JingleYield Program case with specialized Participation behavior.
- [x] The seed includes wallet journal rows that can be Payment Matched.
- [x] The seed includes Cycle Lines, buys, sells, and fees sufficient to verify profit, NAV, payout, and settlement behavior.
- [x] The seed includes at least one imperfect money workflow state that requires an Admin Recovery Flow.
- [x] The seed is documented with the command to run it and the expected destructive behavior in local/dev environments.

## Blocked by

None - can start immediately.
