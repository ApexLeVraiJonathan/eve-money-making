## Overview

Monorepo with NestJS API (`apps/api`) and Next.js UI (`apps/web`). Primary features: market data imports, liquidity analysis, arbitrage opportunity discovery, and multi‑destination package planning.

## Backend (NestJS)

- Modules in `apps/api/src`:
  - `AuthModule`
    - Endpoints in `auth.controller.ts`:
      - `GET /auth/login` (with optional `returnUrl`) → redirects to CCP SSO; stores PKCE/state and optional return URL in httpOnly cookies.
      - `GET /auth/callback` → exchanges code, verifies character, upserts character and token, redirects to `returnUrl` when provided.
      - `GET /auth/characters` → list linked characters with non‑sensitive token metadata.
      - `GET /auth/refresh?characterId=` → refresh access/refresh tokens for a character.
      - `GET /auth/wallet?characterId=` → returns character wallet balance via authed ESI.
      - `DELETE /auth/characters/:id` → unlink character (removes token and character rows).
    - `token.service.ts` handles access token refresh with Prisma + AES‑GCM encrypted refresh tokens (`CryptoUtil`).
    - `EsiService` supports `characterId` in `fetchJson` to inject Bearer tokens and auto‑refresh when near expiry.
  - `ImportModule`
    - Endpoints in `import.controller.ts`:
      - `POST /import/type-ids`, `POST /import/region-ids`, `POST /import/solar-system-ids`, `POST /import/npc-station-ids`, `POST /import/type-volumes` (fetch volumes via ESI),
      - `POST /import/all` (runs a combined import),
      - `POST /import/market-trades/day` (by date), `POST /import/market-trades/missing` (backfill window).
    - `import.service.ts` streams Adam4Eve CSVs into Postgres via Prisma, batches inserts, and pulls missing type volumes and daily market trades; filters trades by tracked stations.
  - `TrackedStationsModule`
    - Endpoints in `tracked-stations.controller.ts`:
      - `POST /tracked-stations` (add station), `GET /tracked-stations`, `GET /tracked-stations/:id`, `DELETE /tracked-stations/:id`.
    - Service uses Prisma to CRUD `TrackedStation` with related `StationId` metadata.
  - `LiquidityModule`
    - Endpoints in `liquidity.controller.ts`:
      - `POST /liquidity/check` computes sell‑side liquidity per tracked station with window coverage and ISK value thresholds.
      - `POST /liquidity/item-stats` returns per‑day buy/sell stats and window averages for a given item/station set.
    - `liquidity.service.ts` aggregates `MarketOrderTradeDaily` rows, enforces coverage thresholds, and returns `LiquidityItemDto[]` per station.
- `ArbitrageModule`

  - Endpoints in `arbitrage.controller.ts`:
    - `POST /arbitrage/check` discovers opportunities using liquidity, live ESI price checks, and fee‑adjusted margins.
    - `POST /arbitrage/plan-packages` transforms opportunities into capacity‑bounded packages across destinations.
  - `arbitrage.service.ts`:
    - Fetches best sell prices at source and destination via `EsiService` with paging and caching.
    - Computes arbitrage quantities (recent daily volume × multiplier, limited by available depth) and fee‑adjusted margins.
    - Plans packages using `libs/arbitrage-packager` with m3 capacities, shipping costs, risk caps, and allocation options.
  - `EsiModule`
    - `esi.service.ts` wraps axios with:
      - ETag/Expires caching backed by `EsiCacheEntry` table,
      - adaptive concurrency based on ESI error‑limit headers,
      - retries/backoff and conditional requests to retrieve headers like `X-Pages`,
      - optional Authorization injection for authed character calls (via `characterId`).
  - `PrismaModule`
    - `prisma.service.ts` provides Prisma client.
  - `LedgerModule`
    - Endpoints in `ledger.controller.ts`:
      - `POST /ledger/cycles` (create), `GET /ledger/cycles` (list)
      - `POST /ledger/cycles/:id/close` (close)
      - `POST /ledger/entries` (append), `GET /ledger/entries?cycleId=` (list)
      - `GET /ledger/nav/:cycleId` (compute NAV totals)
      - `GET /ledger/capital/:cycleId` (compute capital split; supports `?force=true` to bypass 1‑hour cache)
    - `ledger.service.ts` implements Cycle CRUD‑lite, NAV aggregation, and capital computation with weighted‑average cost basis and Jita fallback; creates an Opening Balance commit on new cycles to roll over leftovers.
  - `WalletModule`
    - Endpoints in `wallet.controller.ts`:
      - `GET /wallet-import/character?characterId=` (import one)
      - `GET /wallet-import/all` (import for all linked characters)
      - `GET /wallet-import/transactions` (list enriched wallet transactions)
      - `GET /wallet-import/journal` (list enriched wallet journal entries)
    - `wallet.service.ts` ingests ESI wallet transactions and journal with idempotent inserts and BigInt/Decimal serialization for API responses.
  - `ReconciliationModule`
  - `PricingModule`

    - Endpoints in `pricing.controller.ts`:

      - `POST /pricing/sell-appraise` parses pasted lines in the form "itemName qty", resolves item types, fetches the lowest current sell at the destination station or falls back to the latest `market_order_trades_daily.high`, and returns a tick‑correct suggested sell price strictly below the reference price per the 4 significant‑digit rule.
      - `POST /pricing/undercut-check` fetches our characters' active sell orders, finds the station‑local lowest competitor price (excluding our own orders), and returns per‑character/per‑station updates sorted by item name with tick‑correct suggested prices one step below the competitor.

    - Endpoints in `reconciliation.controller.ts`:
      - `GET /recon/commits`, `GET /recon/commits/:id/status`
      - `POST /recon/link-entry` (manual link)
      - `POST /recon/reconcile` (strict match‑first then write; requires `cycleId`; links to `PlanCommit` when applicable)
    - `reconciliation.service.ts` implements matching by type/station/time window, cycle selection, and idempotent upserts via `(source, sourceId)`.

### Data model (Prisma)

- `TypeId`, `RegionId`, `SolarSystemId`, `StationId`: static universe data.
- `TrackedStation`: user‑selected station list to constrain analysis/imports.
- `MarketOrderTradeDaily`: daily aggregates of market trades per station/type/side.
- `EsiCacheEntry`: persistent cache for ESI GET responses.
- `User`: app users (single‑user today).
- `EveCharacter`: linked characters (id, name, owner hash) → optional relation to `User`.
- `CharacterToken`: per‑character token record (access/refresh, expiry, scopes); refresh token encrypted with AES‑GCM.
- `PlanCommit`, `Cycle`, `CycleLedgerEntry`, `WalletTransaction`, `WalletJournalEntry`, `PlanCommitLine` added.
- `Cycle.initial_injection_isk`, `Cycle.initial_capital_isk` optional fields for initial setup; `cycle_capital_cache` stores hourly snapshots.

## Frontend (Next.js)

- Page `apps/web/app/page.tsx`: UI to submit planner requests and display grouped package plans per destination, totals, and copyable item lists.
- API route `apps/web/app/api/plan-packages/route.ts`: proxies `POST` to `API_BASE/arbitrage/plan-packages`.
- UI components under `components/ui/*` for inputs, cards, buttons, etc.
- Characters management:
  - Page `apps/web/app/characters/page.tsx`: lists linked characters; "Link a character" (web `/auth/login`), remove buttons (DELETE proxy), refresh.
  - Route `apps/web/app/auth/login/route.ts`: redirects to API `/auth/login` and passes a `returnUrl` back to `/characters`.
  - Proxy routes:
    - `apps/web/app/api/auth/characters/route.ts` (GET list)
    - `apps/web/app/api/auth/characters/[id]/route.ts` (DELETE unlink)
  - Metrics & admin:
    - API `GET /esi/metrics` → in-memory counters and error budget snapshot; `GET /jobs/esi-cache/cleanup` → purge expired cache now.
    - Web proxies `apps/web/app/api/metrics/route.ts` and `apps/web/app/api/jobs/esi-cache/cleanup/route.ts`.
    - Admin page `apps/web/app/admin/page.tsx` shows metrics and staleness and provides buttons: purge cache, backfill trades, import all wallets, and reconcile wallet → ledger.
  - Commit status:
    - `apps/web/app/admin/commits/page.tsx` shows per‑commit totals and per‑line progress (planned vs bought/sold) with currency formatting and colors.
  - Transactions and ledger:
    - `apps/web/app/transactions/page.tsx` lists wallet transactions with character/type/station names; currency formatting.
    - `apps/web/app/ledger/page.tsx` lists ledger entries for a selected cycle with a dropdown populated newest→oldest.
    - `apps/web/app/api/ledger/entries/route.ts`, `apps/web/app/api/wallet-import/transactions/route.ts` proxy API reads.
  - Cycles UI:
    - `apps/web/app/cycles/page.tsx` supports initial injection at cycle creation and shows capital totals with per‑station breakdown; includes a Recompute button.
  - Pricing tools:
    - `apps/web/app/sell-appraiser/page.tsx` lets you paste lines and choose a destination tracked station; shows reversed input order with lowest and suggested ticked prices (currency formatted).
    - `apps/web/app/undercut-checker/page.tsx` groups non‑lowest orders by character and station and shows suggested ticked prices; station filters available.
  - Proxy routes:
    - `apps/web/app/api/pricing/sell-appraise/route.ts` → `POST /pricing/sell-appraise` (uses `API_BASE_URL || NEXT_PUBLIC_API_BASE || http://localhost:3000`).
    - `apps/web/app/api/pricing/undercut-check/route.ts` → `POST /pricing/undercut-check`.
    - `apps/web/app/api/tracked-stations/route.ts` → `GET /tracked-stations`.
    - `apps/web/app/cycles/page.tsx` creates and closes cycles; includes a copy‑ID button for each cycle row.

## End‑to‑end flow

1. User links one or more characters via CCP SSO; tokens stored encrypted and refreshed automatically.
2. Static data import (Adam4Eve) populates items, regions, systems, stations.
3. User selects tracked stations.
4. Liquidity analysis pulls recent daily trade aggregates per tracked station.
5. Arbitrage check fetches live prices via ESI and computes opportunities with margin validation against liquidity highs, applying sell‑side fees.
6. Planner builds destination packages within capacity and budget constraints, including shipping cost impacts and exposure caps.
7. Web UI triggers the planner and presents grouped results with copyable shopping lists; you can commit a plan snapshot.
8. Background jobs (disabled in development) can import wallets hourly and reconcile; Admin lets you run them on‑demand.
9. Ledger and transactions pages provide visibility; Commit status tracks planned vs executed per line.

## Notable behaviors and defaults

- Source station default: 60003760 (Jita 4‑4); configurable in requests.
- Fees default: sales tax ≈ 3.37%, broker fee ≈ 1.5% (applied on sell only).
- Arbitrage quantity = recent daily volume × multiplier (default 5), bounded by source order book depth.
- ESI concurrency adapts to error budget; conditional requests used to access `X-Pages` even on cached content.
- Scheduled jobs perform hourly ESI cache cleanup, daily market backfill checks, hourly wallet import + reconciliation, and hourly capital recompute for open cycles; jobs are disabled in development.

## Gaps vs roadmap

- SSO and character linking implemented; tokens encrypted and auto‑refreshed. Wallet import and reconciliation endpoints added.
- Cycles and ledger implemented with `POST /ledger/cycles/:id/close` and UI.
- Auto‑linking uses time/station/type heuristics with a strict match‑first policy; commit enrichment continues to improve matching quality.
- ESI ergonomics: split of markets/universe clients still pending.
- Logging: include `reqId` across Import logs and surface 401 scope hints (in progress).
- No investor/read‑only roles; single‑user assumptions.
