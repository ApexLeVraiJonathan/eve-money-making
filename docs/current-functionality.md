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

### Data model (Prisma)

- `TypeId`, `RegionId`, `SolarSystemId`, `StationId`: static universe data.
- `TrackedStation`: user‑selected station list to constrain analysis/imports.
- `MarketOrderTradeDaily`: daily aggregates of market trades per station/type/side.
- `EsiCacheEntry`: persistent cache for ESI GET responses.
- `User`: app users (single‑user today).
- `EveCharacter`: linked characters (id, name, owner hash) → optional relation to `User`.
- `CharacterToken`: per‑character token record (access/refresh, expiry, scopes); refresh token encrypted with AES‑GCM.

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
    - Admin page `apps/web/app/admin/page.tsx` shows metrics and exposes cleanup.

## End‑to‑end flow

1. User links one or more characters via CCP SSO; tokens stored encrypted and refreshed automatically.
2. Static data import (Adam4Eve) populates items, regions, systems, stations.
3. User selects tracked stations.
4. Liquidity analysis pulls recent daily trade aggregates per tracked station.
5. Arbitrage check fetches live prices via ESI and computes opportunities with margin validation against liquidity highs, applying sell‑side fees.
6. Planner builds destination packages within capacity and budget constraints, including shipping cost impacts and exposure caps.
7. Web UI triggers the planner and presents grouped results with copyable shopping lists.

## Notable behaviors and defaults

- Source station default: 60003760 (Jita 4‑4); configurable in requests.
- Fees default: sales tax ≈ 3.37%, broker fee ≈ 1.5% (applied on sell only).
- Arbitrage quantity = recent daily volume × multiplier (default 5), bounded by source order book depth.
- ESI concurrency adapts to error budget; conditional requests used to access `X-Pages` even on cached content.

## Gaps vs roadmap

- SSO and character linking implemented; tokens encrypted and auto‑refreshed. Basic wallet test endpoint added.
- No Cycle or ledger entities yet; no reconciliation of plan→actual.
- No investor/read‑only roles; single‑user assumptions.
