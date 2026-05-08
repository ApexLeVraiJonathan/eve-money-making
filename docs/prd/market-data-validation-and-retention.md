# PRD: Market Data Validation and Retention

## Problem Statement

The NPC market and self-market collectors were added to produce our own market trade data and reduce reliance on Adam4EVE. After running for multiple months, the database has grown quickly and is now around 80 GB. The suspected cause is raw NPC market snapshot history, especially repeated full JSON snapshots taken during scheduled scans.

The product risk is twofold. First, unbounded raw snapshot growth can make the database expensive and harder to operate. Second, before we replace Adam4EVE in pricing and liquidity workflows, we need confidence that our gathered NPC and self-market aggregates are stable, explainable, and protected from obvious price typos or manipulation.

Adam4EVE is useful as a temporary reference signal for NPC markets, but it is not ground truth and does not cover self-market player structures. The migration decision needs to rely on our own scan health, our own accepted market history, ESI market context, and transparent anomaly reporting.

## Solution

Build a small market data reliability layer around the existing NPC and self-market gathering pipeline.

The solution has four staged slices:

1. Add database space reporting and automatic cleanup for disposable raw NPC market data.
2. Add an admin-only NPC versus Adam4EVE comparison view using existing comparison logic, treating Adam4EVE as a reference signal only.
3. Add internal validation health checks for NPC and self-market scans.
4. Add shared outlier detection, anomaly recording, and aggregate filtering for NPC and self-market data.

Raw NPC snapshots are treated as short-lived operational state, not durable historical product data. Daily aggregate market data remains the durable product and is retained indefinitely.

## User Stories

1. As the product owner, I want to see which market tables consume database space, so that I can understand what is driving the 80 GB database size.
2. As the product owner, I want market space reporting to include table size, index size, total size, row counts, and oldest/newest timestamps, so that large JSON rows are not hidden behind simple row counts.
3. As the product owner, I want raw NPC snapshots older than the retention window deleted automatically, so that the database does not grow forever.
4. As the product owner, I want a manual cleanup trigger, so that I can recover space pressure without waiting for the next scheduled cleanup.
5. As the product owner, I want cleanup to preserve daily aggregate market data, so that long-term trends and reference prices remain available.
6. As the product owner, I want cleanup to physically delete disposable raw rows rather than archive them, so that v1 stays simple and actually reduces database pressure.
7. As the product owner, I want cleanup to rely on normal database vacuum behavior, so that the app does not trigger disruptive full-table locks.
8. As an admin, I want a daily cleanup job that is separate from the 15-minute market gathering job, so that scan correctness and retention maintenance are easy to reason about separately.
9. As an operator, I want retention windows to be configurable with safe defaults, so that I can adjust retention without changing code.
10. As an admin, I want an on-screen market reliability dashboard, so that I can evaluate migration readiness without running ad hoc database queries.
11. As an admin, I want the dashboard to show NPC versus Adam4EVE comparison summaries by day, so that I can spot large differences while remembering Adam4EVE is only a reference signal.
12. As an admin, I want top NPC versus Adam4EVE mismatches sorted by ISK impact, so that investigation starts with differences that matter most.
13. As an admin, I want coverage metrics for NPC comparison rows, so that missing data is visible separately from price or volume disagreement.
14. As an admin, I want daily amount, order count, average price, and ISK value differences shown, so that comparison covers both volume and price behavior.
15. As the product owner, I want no export requirement in v1, so that the admin surface stays focused on on-screen review.
16. As the product owner, I want Adam4EVE comparison limited to NPC market calibration, so that we do not pretend Adam4EVE can validate self-market structures it cannot see.
17. As the product owner, I want self-market readiness inferred from the same gathering method plus internal health checks, so that we can migrate without external structure-market reference data.
18. As an admin, I want scan completeness checks, so that failed or incomplete ESI collection days are visible.
19. As an admin, I want day-to-day stability checks, so that wild changes in totals are highlighted for review.
20. As an admin, I want price sanity checks, so that obvious typo listings do not silently poison pricing and liquidity heuristics.
21. As an admin, I want anomaly counts and examples visible in the dashboard, so that excluded or suspicious orders are explainable.
22. As an admin, I want severe outliers automatically excluded from daily aggregates, so that a listing such as 20B instead of 20M does not distort our data.
23. As an admin, I want borderline anomalies included but flagged, so that normal market volatility is not over-filtered.
24. As the product owner, I want raw snapshots left untouched during their retention window, so that recent observed evidence remains available for debugging.
25. As the product owner, I want outlier filtering applied during aggregate generation and reporting, so that durable daily aggregates avoid severe bad prices.
26. As the product owner, I want outlier reference prices based on our own accepted history and ESI market context, so that we do not depend on Adam4EVE for anomaly decisions.
27. As the product owner, I want regional ESI market depth used as fallback context when local history is sparse, so that thin markets can still be evaluated carefully.
28. As the product owner, I want side-aware severity for buy and sell orders, so that bad low sell orders and bad high buy orders are treated as especially dangerous.
29. As the product owner, I want conservative initial thresholds, so that only obvious severe outliers are auto-excluded in v1.
30. As an admin, I want anomaly records retained longer than raw snapshots, so that exclusions remain explainable after raw operational data is pruned.
31. As the product owner, I want no manual anomaly override in v1, so that the first implementation stays deterministic and rule-driven.
32. As the product owner, I want outlier filtering applied going forward first, so that we avoid risky historical rewrites.
33. As an admin, I want a manual recent recompute option considered for data still inside the raw snapshot retention window, so that recent days can be corrected after rule changes.
34. As the product owner, I want a simple global migration readiness status, so that the decision to replace Adam4EVE is not fragmented by source or location.
35. As the product owner, I want readiness based on at least 14 days of new validation signals, so that the final switch is based on the system after cleanup and anomaly reporting exist.
36. As the product owner, I want existing months of data used for historical comparison where possible, so that previous collection history still informs confidence.
37. As the product owner, I want Adam4EVE kept temporarily as a comparison and rollback reference after migration, so that the switch can be reversed if new evidence appears.

## Implementation Decisions

- Treat raw NPC market snapshots as disposable operational state. They are needed for diffing and recent debugging, not long-term product history.
- Use a default raw NPC retention window of 14 days.
- Prune failed, partial, and successful raw NPC run data with the same 14-day default unless a row is still needed for the latest active baseline.
- Keep daily aggregate market data indefinitely.
- Physically delete expired raw rows. Do not archive them in v1.
- Do not run app-triggered full vacuum operations. Rely on normal database vacuum behavior and expose enough reporting to confirm logical cleanup.
- Add configurable retention defaults for raw market data, anomaly data, and cleanup enablement.
- Add a separate daily cleanup job rather than folding cleanup into the 15-minute market gathering job.
- Add a manual admin cleanup trigger and a market database space report.
- Include exact database table and index size metrics where the database exposes them, not only row counts.
- Keep the comparison and validation tooling admin-only.
- Treat Adam4EVE as a temporary reference signal, not ground truth.
- Use NPC market comparison against Adam4EVE to calibrate the gathering method, then apply the same confidence to self-market with internal checks because Adam4EVE does not cover player structures.
- Split validation into Adam4EVE comparison for NPC markets and internal self-consistency checks for both NPC and self-market scans.
- Add a small admin UI in v1 with tables and filters rather than complex charts.
- Do not add CSV or report export in v1.
- Use a global migration readiness status rather than per-source readiness. Individual reports can still show which source or location caused a problem.
- Use readiness states such as not ready, watch, and ready candidate rather than a numeric score.
- Require at least 14 days of healthy validation signals after the new cleanup, comparison, health, and anomaly reporting are available before fully replacing Adam4EVE in production consumers.
- Keep Adam4EVE import and comparison temporarily after the switch as a rollback/reference path.
- Share anomaly detection logic between NPC and self-market from v1.
- Do not mutate retained raw snapshots when detecting outliers.
- Apply outlier decisions during aggregate generation and validation reporting.
- Automatically exclude only severe outliers when sufficient reference data exists.
- Include borderline anomalies in aggregates but flag them for review.
- Start with severe thresholds of 10x above reference price and 0.1x below reference price.
- Start with borderline thresholds of 3x above reference price and 0.33x below reference price.
- Base reference prices on our own accepted recent history first.
- Use ESI regional market depth as fallback or context when local history is sparse.
- Do not use Adam4EVE as an outlier reference.
- Use side-aware severity so that bad low sell orders and bad high buy orders receive higher priority.
- Add a durable anomaly record with a 90-day default retention window.
- Apply anomaly filtering going forward first. Historical recompute is optional and limited to recent raw data still inside the retention window.

Major modules to build or modify:

- Market retention module: owns raw data retention policy, cleanup execution, cleanup reporting, and manual cleanup triggering.
- Market space reporting module: reports market table row counts, timestamp ranges, table sizes, index sizes, and total sizes.
- Market validation dashboard module: presents database space, cleanup status, comparison summaries, scan health, anomaly summaries, and global readiness.
- NPC comparison module: adapts existing NPC versus Adam4EVE comparison into the admin validation experience and readiness inputs.
- Market health module: evaluates scan completeness, day-to-day stability, successful run counts, and gaps for NPC and self-market collectors.
- Market anomaly module: evaluates candidate order prices against accepted local history and ESI market context, emits anomaly decisions, and records anomaly explanations.
- Aggregate filtering integration: applies severe anomaly exclusions and borderline flags before durable daily aggregate updates.
- Configuration module: exposes retention, cleanup enablement, and threshold defaults through existing application configuration patterns.

## Testing Decisions

Good tests for this work verify external behavior and data invariants, not implementation details. The strongest tests should assert retention boundaries, cleanup safety, comparison summaries, anomaly decisions, aggregate effects, and admin API response shapes.

Testing will prioritize:

- Cleanup preserves the active/latest NPC baseline needed for future diffs.
- Cleanup deletes expired raw NPC snapshots and run metadata outside the configured retention window.
- Cleanup does not delete daily aggregate market data.
- Cleanup respects disabled cleanup configuration.
- Space reporting returns table size, index size, total size, row count, and oldest/newest timestamp data for known market tables.
- NPC versus Adam4EVE comparison treats Adam4EVE as a reference signal and reports coverage, volume differences, price differences, ISK differences, and top mismatches.
- Global readiness returns not ready, watch, or ready candidate based on validation inputs.
- Scan health detects missing or incomplete scan days.
- Severe high and low outliers are excluded when sufficient reference data exists.
- Borderline outliers are included but flagged.
- Outlier detection does not use Adam4EVE as a reference.
- Sparse-history cases fall back to ESI market context or mark insufficient reference data rather than excluding aggressively.
- Buy and sell side severity is interpreted correctly.
- Anomaly records contain enough explanation to understand what was observed, which reference was used, which threshold applied, and what action was taken.
- Anomaly retention deletes old anomaly rows while preserving recent explanations.
- Aggregate generation excludes severe anomalies from durable daily aggregate values.
- Existing market query behavior remains compatible with current consumers.

Prior art in the codebase includes:

- Existing NPC market comparison service behavior.
- Existing NPC and self-market collector service tests.
- Existing market limit and query tests.
- Existing scheduled job patterns.
- Existing admin web pages and Tradecraft API hook patterns.

Suggested command gate:

```powershell
pnpm type-check
pnpm lint
pnpm test
```

Database migration tests should be run with the normal Prisma migration workflow used by the project. Any destructive production cleanup should first be validated against a database copy or local database with representative market rows.

## Out of Scope

- Replacing all Adam4EVE static ID imports.
- Treating Adam4EVE as ground truth.
- Exporting comparison or anomaly reports.
- Building complex charts or long-form generated reports.
- Manual anomaly override workflows.
- Archiving raw NPC snapshots before deletion.
- Running full vacuum operations from the application.
- Recomputing all historical daily aggregates.
- Keeping per-source or per-location readiness statuses.
- Changing ESI polling cadence unless scan health data later proves it is necessary.
- Refactoring unrelated pricing, liquidity, or Tradecraft behavior while building this reliability layer.

## Further Notes

This PRD extends the existing market self-gathering plan. The earlier plan explains why self-gathered market data exists and how snapshot diffing maps to daily aggregate data. This PRD covers the next step: operating that data safely, validating it, and deciding when it is reliable enough to replace Adam4EVE for production market-data consumers.

Local markdown is the source of truth for this PRD. Issue tracker copies, if created later, are secondary and may drift.

