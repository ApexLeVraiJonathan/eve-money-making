## Backlog

A prioritized list of not‑done work. Completed items live in `docs/current-functionality.md`.

### Now

- Character assets importer

  - Outcome: Persist character assets from ESI (per character) with idempotent, resumable imports.
  - Acceptance: `POST /import/assets` writes rows; reruns skip duplicates; basic DTO validation and tests.

- Orders/contracts → ledger (minimum path)

  - Outcome: Normalize sell fills and shipping contract fees into `CycleLedgerEntry` with provenance.
  - Acceptance: Endpoint(s) create entries with unique source keys; partial fills handled; shows in `/ledger` views.

- Observability and ops hardening
  - Outcome: Structured logs with `reqId` across Import/Liquidity/ESI; admin shows 401 scope hints and staleness prominently.
  - Acceptance: Logs include `reqId` end‑to‑end; `/admin` surfaces “missing scopes/401” and stale data warnings.

### Next

- Cycle lifecycle and state

  - Outcome: Add endpoints to transition cycle state (executing → closing → settled) and persist transitions.
  - Acceptance: Validated transitions with audit timestamps; rejected invalid moves; basic UI affordance.

- Cycle analytics (NAV and splits)

  - Outcome: Compute NAV and capital/inventory/cash split; expose via API and surface in UI.
  - Acceptance: API returns NAV with components; UI renders values for a selected cycle.

- Cost basis selection and persistence

  - Outcome: Choose FIFO or Moving Average policy; apply consistently in reconciliation/valuation.
  - Acceptance: Policy stored and used in calculations; smoke tests cover both policies.

- Reconciliation breadth

  - Outcome: Extend reconciliation to match orders/fills and contracts to plan lines with tolerances.
  - Acceptance: Links created/updated with `matchStatus`; ambiguous cases flagged for manual review.

- ESI ergonomics
  - Outcome: Extract typed ESI clients for markets/universe in addition to characters.
  - Acceptance: Shared helpers used by services; reduced duplication in pagination/headers.

### Later

- Stability and risk controls

  - Outcome: Opportunity scoring (30/90‑day volume, depth, density) and blacklist/whitelist from outcomes.
  - Acceptance: Scoring visible in UI; lists persisted and honored during planning.

- Analytics and UX

  - Outcome: Cycle dashboard (NAV, ROI curves) and item analytics (cohort profit, sell‑through, unit economics).
  - Acceptance: Pages render with real data; basic filters and drill‑downs.

- Multi‑user/investor (optional)
  - Outcome: Investor ledger (in‑game only) and read‑only portal.
  - Acceptance: Read‑only access with immutable logs; no off‑game payments.
