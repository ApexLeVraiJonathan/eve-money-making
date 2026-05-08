---
category: enhancement
state: needs-triage
---

# Document Recent Aggregate Recompute Path

Type: HITL

## Parent

[`../prd/market-data-validation-and-retention.md`](../prd/market-data-validation-and-retention.md)

## What to build

Decide and document whether recent daily market aggregates should be recomputable while raw snapshots are still inside the retention window. This is intentionally HITL because recompute behavior can overwrite data users may already be relying on.

The output should be a small local runbook or design note that explains when recompute is allowed, what it can change, what it must preserve, and whether implementation should proceed as a later AFK slice.

## Acceptance criteria

- [ ] The decision records whether recent aggregate recompute is needed in v1, later, or not at all.
- [ ] The decision explains that recompute is limited to data still inside the raw snapshot retention window.
- [ ] The decision describes which aggregate dimensions can be recomputed and which historical data must remain untouched.
- [ ] The decision identifies operator safeguards needed before any recompute implementation.
- [ ] The decision documents whether a follow-up AFK implementation issue should be created.
- [ ] The document links back to the market data validation and retention PRD.

## Blocked by

- [`015-apply-severe-outlier-filtering-to-aggregates.md`](015-apply-severe-outlier-filtering-to-aggregates.md)

