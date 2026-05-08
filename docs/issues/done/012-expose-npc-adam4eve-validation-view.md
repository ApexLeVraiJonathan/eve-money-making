---
category: enhancement
state: done
---

# Expose NPC vs Adam4EVE Validation View

Type: AFK

## Parent

[`../../prd/market-data-validation-and-retention.md`](../../prd/market-data-validation-and-retention.md)

## What to build

Expose an admin-only validation view that compares gathered NPC market daily aggregates against Adam4EVE daily aggregates. Adam4EVE should be presented as a temporary reference signal, not ground truth.

The view should build on the existing NPC comparison service and make migration confidence review possible from the admin UI, with coverage, volume differences, price differences, ISK differences, successful run counts, and top mismatches sorted by ISK impact.

## Acceptance criteria

- [x] The admin API exposes NPC versus Adam4EVE comparison data for a selected date range and station context.
- [x] The comparison includes coverage, amount difference, order count difference, average price difference, ISK value difference, and top mismatches.
- [x] The comparison clearly treats Adam4EVE as a reference signal rather than ground truth.
- [x] The admin UI shows the comparison summaries and top mismatches on screen.
- [x] The view does not add CSV, PDF, or other export behavior.
- [x] The view does not attempt to compare self-market structure data against Adam4EVE.
- [x] Tests cover comparison response shaping and UI/API integration boundaries.

## Blocked by

- [`010-add-market-data-space-report.md`](010-add-market-data-space-report.md)

