---
category: enhancement
state: done
---

# Apply Severe Outlier Filtering To Aggregates

Type: AFK

## Parent

[`../../prd/market-data-validation-and-retention.md`](../../prd/market-data-validation-and-retention.md)

## What to build

Apply shared NPC and self-market anomaly decisions during daily aggregate generation. Severe outliers should be excluded from durable aggregate values when enough reference data exists, while borderline anomalies should remain included but flagged.

This should protect pricing and liquidity heuristics from obvious typo-scale listings without rewriting raw snapshots or aggressively filtering legitimate market movement.

## Acceptance criteria

- [x] Severe high outliers default to prices at least 10x above the reference price.
- [x] Severe low outliers default to prices at most 0.1x of the reference price.
- [x] Borderline high outliers default to prices at least 3x above the reference price.
- [x] Borderline low outliers default to prices at most 0.33x of the reference price.
- [x] Severe outliers are excluded from durable daily aggregate amount, high, low, average, order count, and ISK value calculations where applicable.
- [x] Borderline anomalies remain included in aggregates and are recorded as flagged.
- [x] Buy and sell side severity is interpreted side-aware, with bad low sell orders and bad high buy orders treated as especially dangerous.
- [x] Filtering applies going forward first and does not rewrite historical aggregates.
- [x] Tests cover severe exclusion, borderline inclusion, side-aware severity, and aggregate value effects.

## Blocked by

- [`014-add-market-anomaly-recording.md`](014-add-market-anomaly-recording.md)

