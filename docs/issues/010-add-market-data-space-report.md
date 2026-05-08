---
category: enhancement
state: needs-triage
---

# Add Market Data Space Report

Type: AFK

## Parent

[`../prd/market-data-validation-and-retention.md`](../prd/market-data-validation-and-retention.md)

## What to build

Build an admin-visible market data space report that shows which market tables are consuming database space. The report should make raw NPC snapshot growth visible without requiring ad hoc database queries.

The slice should expose a complete path from database metrics through the API to the admin UI. It should include actual table size, index size, total size, row count, and oldest/newest timestamp information for the market tables that matter to NPC market, self-market, Adam4EVE imports, and anomaly tracking once present.

## Acceptance criteria

- [ ] An admin API endpoint returns market table size, index size, total size, row count, oldest timestamp, and newest timestamp where available.
- [ ] The report includes known high-growth market tables, especially raw NPC market snapshots and run metadata.
- [ ] The report includes daily aggregate market tables without implying they should be pruned.
- [ ] The admin UI presents the report in an on-screen table.
- [ ] The report handles empty or missing timestamp ranges without failing.
- [ ] Tests cover the returned report shape and at least one representative table-size result.

## Blocked by

None - can start immediately.

