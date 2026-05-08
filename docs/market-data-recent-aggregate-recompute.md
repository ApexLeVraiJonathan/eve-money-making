# Market Data Recent Aggregate Recompute

Parent PRD: [`prd/market-data-validation-and-retention.md`](prd/market-data-validation-and-retention.md)

## Decision

Recent daily aggregate recompute is **not needed for v1** of market data validation and retention. The v1 behavior is forward-only:

- raw NPC snapshots are retained for a short window;
- severe outliers are excluded from aggregate writes going forward;
- borderline anomalies are included but recorded for review;
- historical aggregate rows already written are not rewritten automatically.

Recompute can be added later as a separate AFK implementation slice if live validation shows that typo-scale listings materially polluted recent aggregates before the filtering code was deployed.

## Allowed Scope

Any future recompute must be limited to data still inside the raw snapshot retention window. With the current default policy, that means at most the last `MARKET_RAW_RETENTION_DAYS` days, defaulting to 14 days.

Recompute is only meaningful while the raw inputs still exist:

- `npc_market_snapshots`
- `npc_market_region_types_snapshots`
- `npc_market_runs`
- active station baselines needed to walk adjacent snapshots

Once raw snapshots have been cleaned up, daily aggregates become the durable historical record for that period and must not be reconstructed from partial data.

## Recomputable Dimensions

A future recompute may rebuild daily aggregate rows for the same dimensions the collectors write today:

- `scan_date`
- source-specific location (`station_id` for NPC, `location_id` for self-market)
- `type_id`
- `is_buy_order`
- `has_gone`

For those rows, recompute may replace:

- `amount`
- `order_num`
- `isk_value`
- `high`
- `low`
- `avg`
- `updated_at`

It must preserve raw snapshots, run records, anomaly records, and any aggregate rows outside the requested date/location/source range.

## Safeguards

Before implementing recompute, add operator safeguards:

- Require explicit `source`, date range, and location inputs; no unbounded recompute.
- Reject ranges outside the raw retention window.
- Provide a dry-run mode that reports affected aggregate rows, available raw snapshots, and detected gaps.
- Require an explicit confirmation flag for write mode.
- Write an audit log row or durable run record with operator, parameters, row counts, and before/after totals.
- Recompute into temporary in-memory or temporary-table results first, then replace target aggregate rows transactionally.
- Block recompute when required adjacent snapshots are missing, unless the operator explicitly accepts a partial dry-run-only report.

## Follow-Up

Create a follow-up AFK implementation issue only if the readiness page or operator review shows recent aggregates need repair. Until then, the safer default is to let the forward-only anomaly filter protect new data and keep existing historical aggregates untouched.
