## Product vision

Build a steady, data‑driven arbitrage assistant for EVE Online. Start as a personal tool, harden data fidelity and operations, then optionally expose read‑only views for others. The endgame could include investor‑style reporting, but only after consistent, audited profitability and in compliance with CCP EULA.

Constraints and principles

- Keep scope small, reliable, and operable by one person.
- Favor correctness and auditability over features.
- Avoid EULA gray areas; no real‑money flows.

## Roadmap (phased)

### Phase 1 — Foundations (now)

- SSO and character linking
  - Use CCP SSO so characters can be linked and authorized for ESI.
  - Encrypt refresh tokens at rest; handle revocation and rotation.
  - Scopes in use: wallet, orders, assets, contracts; optional UI waypoints.
  - Web: `/characters` page to link/unlink and list characters; login supports `returnUrl` to route back to web after callback.
- Reliable ESI ingestion
  - Respect ETag/Expires; backoff on 420; track error budget headers.
  - Idempotent importers with checkpoints per character/endpoint.
  - Normalize into an immutable ledger of wallet, orders, assets, contracts.
- Data correctness and precision
  - Use high‑precision decimals for ISK/volume/fees.
  - Centralize fee/tax formulas (broker, sales, relist, shipping).

Acceptance criteria

- Able to link multiple characters to one user and refresh tokens automatically (done).
- Imports run on schedule and are resumable; no duplicate rows.
- ISK math is consistent across modules; fees reused from one source.

### Phase 2 — Make “Cycle” first‑class

- Lifecycle: planned → executing → monitoring → closing → settled.
- Data model
  - Cycle entity (start/end, target capital, notes).
  - CycleLedger events: contribution, package_committed, buy_fill, shipment_fee, listing, sale_fill, relist_fee, write_off, withdrawal.
  - Derived state: capital vs inventory vs cash; realized vs unrealized PnL.
- Cost basis
  - Choose a policy (FIFO or Moving Average) and keep it consistent.
- Persist and reconcile
  - Persist plan‑package “commit” snapshots at execution time.
  - Reconcile to real wallet transactions (buys), contracts (shipping), and orders/fills (sales). Handle partial fills and exceptions.
  - Use authed ESI with `characterId` for wallet/transactions/orders, with auto‑refresh.

Acceptance criteria

- A cycle’s NAV, realized/unrealized PnL, and capital/inventory split are computed from ledger events.
- Each planned item is matched to real transactions or flagged for manual review.

### Phase 3 — Stability and risk controls

- Opportunity scoring using 30/90‑day volume, spread depth, m3/ISK density.
- Blacklist/whitelist from realized outcomes and sell‑through.
- Inventory aging, alerts for stale stock; repricing bands; “exit at market”.

Acceptance criteria

- Top picks avoid thin/fragile markets; stale items are surfaced with actions.

### Phase 4 — Analytics and UX

- Cycle dashboard: NAV, ROI, realized/unrealized curves, capital vs inventory.
- Item analytics: cohort profit, repeatability score, sell‑through, unit economics.
- Operational “Today” view: buy/list/ship/reprice/reconcile checklist.

Acceptance criteria

- One page answers: what to buy, what to list, what to ship, what to fix.

### Phase 5 — Multi‑user/investor (optional, later)

- Investor ledger (in‑game only): contributions/withdrawals, NAV‑based shares, per‑investor PnL.
- Read‑only portal; immutable logs and signed cycle reports.

Acceptance criteria

- Fully read‑only for external viewers; no off‑game payment promises.

## Implementation notes

Single sign‑on (SSO)

- CCP SSO: https://developers.eveonline.com/docs/services/sso/
- Plan for scopes: wallet, market orders, structure markets, assets, contracts.

Ingestion and caching

- Use conditional requests (If‑None‑Match) and persist ETag/Expires.
- Honor X‑Esi‑Error‑Limit headers; adapt concurrency.

Cycle reconciliation

- Store plan‑package commits when you decide to execute.
- Reconcile by type_id, time window, and tolerances; support manual overrides.

Strategy hardening

- Prefer repeatable movers; penalize thin books and volatile spreads.
- Track variance plan→actual; feed dynamic blacklist/whitelist.

Operations and safety

- Background jobs/queues for imports and reconciliations.
- Structured logs and metrics (staleness, ESI error budget, queue depth).
- Role‑based access (owner vs viewer); regular DB backups and migrations.

## Current status (high level)

- Existing: liquidity checks, arbitrage discovery, multi‑destination package planner, station/type imports, ESI cache with error‑budget handling, Next.js UI to trigger planning.
- Next focus: SSO + immutable Cycle ledger + reconciliation UI.
