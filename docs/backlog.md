## Backlog

A prioritized list of not‑done work. Completed items live in `docs/current-functionality.md`.

### To Do

- Cycle analytics (NAV and splits)

  - Outcome: Compute NAV and capital/inventory/cash split; expose via API and surface in UI.
  - Acceptance: API returns NAV with components; UI renders values for a selected cycle.

- Reconciliation breadth

  - Outcome: Extend reconciliation to match orders/fills and contracts to plan lines with tolerances.
  - Acceptance: Links created/updated with `matchStatus`; ambiguous cases flagged for manual review.

// Removed completed items (now listed in current-functionality.md):
// - Sell Appraiser
// - Undercut checker

### Backlog

- Cycle lifecycle and state

  - Outcome: Add endpoints to transition cycle state (executing → closing → settled) and persist transitions.
  - Acceptance: Validated transitions with audit timestamps; rejected invalid moves; basic UI affordance.

- ESI ergonomics

  - Outcome: Extract typed ESI clients for markets/universe in addition to characters.
  - Acceptance: Shared helpers used by services; reduced duplication in pagination/headers.

- Stability and risk controls

  - Outcome: Opportunity scoring (30/90‑day volume, depth, density) and blacklist/whitelist from outcomes.
  - Acceptance: Scoring visible in UI; lists persisted and honored during planning.

- Analytics and UX

  - Outcome: Cycle dashboard (NAV, ROI curves) and item analytics (cohort profit, sell‑through, unit economics).
  - Acceptance: Pages render with real data; basic filters and drill‑downs.

- Multi‑user/investor (optional)
  - Outcome: Investor ledger (in‑game only) and read‑only portal.
  - Acceptance: Read‑only access with immutable logs; no off‑game payments.
