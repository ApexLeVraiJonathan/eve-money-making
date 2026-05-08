---
category: enhancement
state: needs-triage
---

# Apply Severe Outlier Filtering To Aggregates

Type: AFK

## Parent

[`../prd/market-data-validation-and-retention.md`](../prd/market-data-validation-and-retention.md)

## What to build

Apply shared NPC and self-market anomaly decisions during daily aggregate generation. Severe outliers should be excluded from durable aggregate values when enough reference data exists, while borderline anomalies should remain included but flagged.

This should protect pricing and liquidity heuristics from obvious typo-scale listings without rewriting raw snapshots or aggressively filtering legitimate market movement.

## Acceptance criteria

- [ ] Severe high outliers default to prices at least 10x above the reference price.
- [ ] Severe low outliers default to prices at most 0.1x of the reference price.
- [ ] Borderline high outliers default to prices at least 3x above the reference price.
- [ ] Borderline low outliers default to prices at most 0.33x of the reference price.
- [ ] Severe outliers are excluded from durable daily aggregate amount, high, low, average, order count, and ISK value calculations where applicable.
- [ ] Borderline anomalies remain included in aggregates and are recorded as flagged.
- [ ] Buy and sell side severity is interpreted side-aware, with bad low sell orders and bad high buy orders treated as especially dangerous.
- [ ] Filtering applies going forward first and does not rewrite historical aggregates.
- [ ] Tests cover severe exclusion, borderline inclusion, side-aware severity, and aggregate value effects.

## Blocked by

- [`014-add-market-anomaly-recording.md`](014-add-market-anomaly-recording.md)

