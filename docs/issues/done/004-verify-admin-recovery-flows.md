---
category: enhancement
state: resolved
---

# Verify Admin Recovery Flows

Type: AFK

## Parent

[`../prd/pre-main-tradecraft-acceptance-testing.md`](../prd/pre-main-tradecraft-acceptance-testing.md)

## What to build

Verify product/API-supported Admin Recovery Flows for imperfect money workflow states. This slice covers recovery actions that admins need when Participation payment, payout, refund, or settlement follow-up is not perfectly clean.

## Acceptance criteria

- [x] Tests prove admins can inspect unmatched Participation payment inputs or unmatched donations from the seeded state.
- [x] Tests prove admins can validate a pending Participation payment and produce the expected Participation and ledger state.
- [x] Tests prove admins can mark a Participation refund without corrupting Cycle totals.
- [x] Tests prove admins can mark payout follow-up state where supported by the product/API.
- [x] Tests prove recoverable Settlement Report failures are visible for admin follow-up.
- [x] Tests prove JingleYield rollover backfill works for the seeded imperfect state.
- [x] Tests do not treat standalone scripts as release-blocking operational paths unless explicitly documented.

## Blocked by

- [`001-create-canonical-tradecraft-acceptance-seed.md`](001-create-canonical-tradecraft-acceptance-seed.md)
- [`002-verify-cycle-lifecycle-and-settlement-report-acceptance.md`](002-verify-cycle-lifecycle-and-settlement-report-acceptance.md)
- [`003-verify-participation-caps-payment-matching-and-rollover-intent.md`](003-verify-participation-caps-payment-matching-and-rollover-intent.md)
