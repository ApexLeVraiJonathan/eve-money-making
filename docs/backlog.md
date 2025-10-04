## Backlog

A prioritized list of not‑done work. Completed items live in `docs/current-functionality.md`.

### To Do

- Cycle analytics (NAV and splits)

  - Outcome: Compute NAV and capital/inventory/cash split; expose via API and surface in UI.
  - Acceptance: API returns NAV with components; UI renders values for a selected cycle.

- Reconciliation breadth

  - Outcome: Extend reconciliation to match orders/fills and contracts to plan lines with tolerances.
  - Acceptance: Links created/updated with `matchStatus`; ambiguous cases flagged for manual review.

- Sell Appraiser

  - Outcome: After a plan is executed, compute per-item sell prices at a selected destination by matching the current lowest sell order and adjusting to the valid market tick; allow pasting an item list and show results in reverse input order.

  - Acceptance: API returns for each parsed line {itemName, quantity, destinationStationId, lowestSell|null, suggestedSellPriceTicked}; UI page accepts lines with no headers in the form "itemName qty" (item names may contain spaces; the final single space separates the integer quantity), lets me choose destination from `tracked-stations`, and renders a table (last pasted line first). If sell orders exist at the destination, suggestedSellPriceTicked is the next valid tick strictly below the current lowest sell; if none exist, use the latest `market_order_trades_daily.high` at that station for the item and tick-align down (at or below the high). All ticking follows the 4 significant‑digit rule.

- Undercut checker

  - Outcome: Find my posted sell orders that are not the cheapest, per character and per location, and compute the tick‑correct price needed to regain the lowest sell.

  - Acceptance: API returns, grouped by character and station, only orders to update sorted by itemName A→Z with fields {orderId, itemName, remaining, currentPrice, competitorLowest, suggestedNewPriceTicked}. If our order is already the lowest at that location (across all our linked characters), it is omitted; competitorLowest excludes our own orders. UI renders groups per character/location; suggestedNewPriceTicked is one valid tick strictly below competitorLowest using the same 4 significant‑digit tick rule.

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
