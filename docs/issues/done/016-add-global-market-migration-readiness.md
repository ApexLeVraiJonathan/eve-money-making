---
category: enhancement
state: done
---

# Add Global Market Migration Readiness

Type: AFK

## Parent

[`../../prd/market-data-validation-and-retention.md`](../../prd/market-data-validation-and-retention.md)

## What to build

Add a simple global migration readiness status for replacing Adam4EVE-backed market data with our gathered market data. The status should combine NPC comparison, scan health, and anomaly signals into a cautious readiness state.

Readiness should be global rather than per source or location. Individual reports can explain which source or location caused concern, but the migration decision should remain one overall status.

## Acceptance criteria

- [x] The admin API returns one global readiness state.
- [x] Readiness states include not ready, watch, and ready candidate.
- [x] Readiness considers NPC versus Adam4EVE comparison as a reference signal only.
- [x] Readiness considers NPC and self-market scan health.
- [x] Readiness considers severe and borderline anomaly activity.
- [x] Ready candidate requires at least 14 days of healthy validation signals after the new validation/reporting system is in place.
- [x] Existing months of data can be included as historical context without bypassing the 14-day new-signal gate.
- [x] The admin UI shows the global readiness state and the main reasons behind it.
- [x] Tests cover not ready, watch, and ready candidate scenarios.

## Blocked by

- [`012-expose-npc-adam4eve-validation-view.md`](012-expose-npc-adam4eve-validation-view.md)
- [`013-add-market-scan-health-checks.md`](013-add-market-scan-health-checks.md)
- [`015-apply-severe-outlier-filtering-to-aggregates.md`](015-apply-severe-outlier-filtering-to-aggregates.md)

