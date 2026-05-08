---
category: enhancement
state: resolved
---

# Verify Financial Reporting Acceptance

Type: AFK

## Parent

[`../prd/pre-main-tradecraft-acceptance-testing.md`](../prd/pre-main-tradecraft-acceptance-testing.md)

## What to build

Verify seeded financial reporting values for Tradecraft. This slice should prove profit, NAV, fees, payout, and snapshot behavior are coherent after the refactor and match expected values from the canonical acceptance dataset.

## Acceptance criteria

- [x] Tests verify profit values from seeded buys, sells, and fees.
- [x] Tests verify NAV values from seeded deposits, withdrawals, fees, and executions.
- [x] Tests verify transport, broker, relist, and collateral recovery fees affect reporting as expected.
- [x] Tests verify payout suggestions or finalized payout totals from seeded profit share assumptions.
- [x] Tests verify snapshots can be created and read back for the seeded Cycle.
- [x] Tests verify public/user reporting endpoints expose coherent values for browser pages.
- [x] Expected seeded money values are documented near the tests or seed.

## Blocked by

- [`001-create-canonical-tradecraft-acceptance-seed.md`](001-create-canonical-tradecraft-acceptance-seed.md)
- [`002-verify-cycle-lifecycle-and-settlement-report-acceptance.md`](002-verify-cycle-lifecycle-and-settlement-report-acceptance.md)
- [`003-verify-participation-caps-payment-matching-and-rollover-intent.md`](003-verify-participation-caps-payment-matching-and-rollover-intent.md)
