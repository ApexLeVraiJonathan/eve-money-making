---
category: enhancement
state: needs-triage
---

# Add Market Anomaly Recording

Type: AFK

## Parent

[`../prd/market-data-validation-and-retention.md`](../prd/market-data-validation-and-retention.md)

## What to build

Add shared anomaly recording for NPC and self-market order prices. This slice should make suspicious prices explainable without changing aggregate behavior yet.

Anomaly decisions should use our own accepted recent history first and ESI regional market depth as fallback context when local history is sparse. Adam4EVE must not be used as an outlier reference. The system should retain anomaly records for 90 days by default and show anomaly counts/examples in the admin validation UI.

## Acceptance criteria

- [ ] A durable anomaly record exists for market source, location or structure, type, side, observed price, observed volume, reference price, threshold, severity, action, scan timestamp, and reason code.
- [ ] Anomaly retention is configurable with a default of 90 days.
- [ ] The anomaly evaluator can classify severe, borderline, normal, and insufficient-reference cases.
- [ ] Reference prices come from accepted local history first.
- [ ] ESI regional market depth can be used as fallback or context when local history is sparse.
- [ ] Adam4EVE is not used as an outlier reference.
- [ ] Raw snapshots are not mutated by anomaly recording.
- [ ] The admin UI shows anomaly counts and representative examples.
- [ ] Tests cover anomaly classification, sparse-history behavior, and 90-day retention.

## Blocked by

- [`010-add-market-data-space-report.md`](010-add-market-data-space-report.md)

