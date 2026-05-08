---
category: enhancement
state: resolved
---

# Verify JingleYield Program Acceptance

Type: AFK

## Parent

[`../prd/pre-main-tradecraft-acceptance-testing.md`](../prd/pre-main-tradecraft-acceptance-testing.md)

## What to build

Verify JingleYield Program behavior as first-class Tradecraft behavior rather than as a normal Participation variant. This slice should prove program rules still produce the expected Participation, rollover, cap, and completion outcomes.

## Acceptance criteria

- [x] Tests prove an admin can create or seed a JingleYield Program case for a user.
- [x] Tests prove JingleYield Participations are linked to the correct program and Cycle.
- [x] Tests prove minimum Cycle rules affect completion as expected.
- [x] Tests prove principal handling works for locked and adjustable cases represented in the seeded scenarios.
- [x] Tests prove interest-target completion behavior works when the seeded data reaches the target.
- [x] Tests prove JingleYield Rollover Intent and rollover/backfill behavior produce expected outcomes.
- [x] Tests prove Tradecraft Caps interact correctly with active JingleYield Program principal.

## Blocked by

- [`001-create-canonical-tradecraft-acceptance-seed.md`](001-create-canonical-tradecraft-acceptance-seed.md)
- [`003-verify-participation-caps-payment-matching-and-rollover-intent.md`](003-verify-participation-caps-payment-matching-and-rollover-intent.md)
