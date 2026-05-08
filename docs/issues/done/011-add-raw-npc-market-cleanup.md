---
category: enhancement
state: done
---

# Add Raw NPC Market Cleanup

Type: AFK

## Parent

[`../../prd/market-data-validation-and-retention.md`](../../prd/market-data-validation-and-retention.md)

## What to build

Add configurable cleanup for disposable raw NPC market data so the database does not grow indefinitely from repeated full JSON snapshots. Cleanup should run automatically on a separate daily schedule and also be available as a manual admin action.

The cleanup path should preserve the current NPC baseline needed for future diffs, preserve daily aggregate market data indefinitely, and physically delete expired raw NPC snapshots and run metadata without archiving.

## Acceptance criteria

- [x] Cleanup uses a configurable raw market retention window with a default of 14 days.
- [x] Cleanup can be enabled or disabled through application configuration.
- [x] A separate daily job invokes raw NPC cleanup outside the 15-minute market gathering job.
- [x] A manual admin API action can trigger cleanup on demand.
- [x] Cleanup preserves the latest active NPC baseline needed for future scans.
- [x] Cleanup deletes expired raw NPC snapshots and eligible run metadata outside the retention window.
- [x] Cleanup does not delete NPC, self-market, or Adam4EVE daily aggregate tables.
- [x] Cleanup does not run application-triggered full vacuum operations.
- [x] Tests cover retention boundaries, disabled cleanup, active baseline preservation, and aggregate preservation.

## Blocked by

- [`010-add-market-data-space-report.md`](010-add-market-data-space-report.md)

