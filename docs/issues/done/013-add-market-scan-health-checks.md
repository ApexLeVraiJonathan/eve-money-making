---
category: enhancement
state: done
---

# Add Market Scan Health Checks

Type: AFK

## Parent

[`../../prd/market-data-validation-and-retention.md`](../../prd/market-data-validation-and-retention.md)

## What to build

Add internal market scan health checks for NPC and self-market gathering. These checks should validate our own pipeline independently of Adam4EVE and feed the admin validation experience.

The health checks should surface scan completeness, successful run counts, obvious collection gaps, and day-to-day stability concerns so that bad or missing scan data is visible before it affects migration confidence.

## Acceptance criteria

- [x] The admin API returns scan health for NPC market gathering.
- [x] The admin API returns scan health for self-market gathering.
- [x] Health output includes successful run counts and missing or incomplete scan windows for the selected period.
- [x] Health output flags unusually large day-to-day changes in market totals for review.
- [x] Health checks do not use Adam4EVE as their authority.
- [x] The admin UI shows scan health alongside market validation data.
- [x] Tests cover complete, missing, and unstable scan-health scenarios.

## Blocked by

- [`010-add-market-data-space-report.md`](010-add-market-data-space-report.md)

