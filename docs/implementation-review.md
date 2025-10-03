## Goals

Keep the codebase small, readable, and correct. Favor explicit domain boundaries, high‑precision money handling, and operational reliability over features.

## Architecture review checklist

- Domain boundaries
  - Are modules aligned with domains: Import, Liquidity, Arbitrage, ESI, Persistence?
  - Is cross‑module coupling minimal and explicit (interfaces/DTOs)?
- Data and precision
  - Are ISK and volumes represented as decimals end‑to‑end? Avoid float math.
  - Are fee/tax formulas centralized and reused consistently?
- ESI access
  - Conditional requests with ETag/Expires used everywhere; respectful concurrency.
  - Backoff on 420 with adaptive concurrency; instrument error budgets.
  - Character‑aware Authorization supported in `EsiService.fetchJson` (optional `characterId`) with auto‑refresh via `TokenService`.
- Reliability
  - Idempotent imports with checkpoints; no duplicate inserts on retry.
  - Structured logs and clear context; errors actionable.
- Performance
  - DB indexes on hot fields: `typeId`, `locationId`, `scanDate`, `regionId`.
  - Paged reads and streaming where applicable; bounded concurrency.
- Security
  - Secrets and tokens encrypted at rest; least‑privilege scopes.
  - Input validation on controllers; guard against unbounded payloads.
  - Return URLs in SSO flow are stored in short‑lived httpOnly cookies and cleared after use.
- Testing
  - Unit tests for pricing math, fee calculations, and planner constraints.
  - Integration tests for ESI caching paths (200 vs 304) and pagination.

## Immediate suggestions

- Centralize fee/tax
  - Create `apps/api/src/arbitrage/fees.ts` with typed helpers for sales tax, broker fee, relist fee; import in `ArbitrageService` and any future ledger logic. (done)
- DTOs and validation
  - Add request DTOs with validation pipes for `arbitrage.check`, `arbitrage.plan-packages`, `liquidity.check`, and import endpoints to harden inputs. (done)
- Extract shared ESI patterns
  - Wrap market order paging into a helper that returns both rows and `x-pages` with caching hints; reduces repeated pagination code in `ArbitrageService`. (done)
  - Consider a small typed `EsiClient` facade for common authed calls (wallet, orders, assets) using `characterId` to reduce path string duplication. (partially done: `EsiCharactersService`)
- Logging
  - Prefer structured messages (object context) for key steps: station loop timings, item counts, cache hits/misses; include correlation IDs per request. (in progress)
  - Log `WWW-Authenticate` header details on 401 from ESI to surface missing scope hints. (pending)
  - Expose basic metrics endpoint (`GET /esi/metrics`) and on-demand cleanup (`GET /jobs/esi-cache/cleanup`) for ops visibility. (done)
- Indexes
  - Confirm DB indexes for `MarketOrderTradeDaily(scanDate, locationId, typeId, isBuyOrder)` support current read patterns; add composite indexes if slow.

## Near‑term refactors (small, safe)

- `ArbitrageService`
  - Split into smaller services: `PriceDiscoveryService`, `OpportunityService`, `PackagePlannerService` (the last one already externalized). (pending)
  - Parameter object → typed DTOs; clamp concurrency and validate thresholds. (done)
- `LiquidityService`
  - Extract query builders; reuse in `item-stats` and `check` to avoid drift. (pending)
- `EsiService`
  - Add per‑endpoint keys for cache namespaces; expose simple typed methods for well‑known routes used by arbitrage and authed character calls. (partially done)
  - Move header normalization util to shared space (done: `src/common/http.ts`).

## Future foundation for “Cycle”

- Schema additions
  - `Cycle` (id, name, startAt, endAt, notes, status). (done)
  - `CycleLedger` (id, cycleId, eventType, ts, payload jsonb, amounts as decimals). (done)
  - `PlanCommit` snapshot with request/response at execution time. (done)
- Services
  - `LedgerService` to append immutable events; derived state calculators (NAV, realized/unrealized PnL; capital/inventory split). (done)
  - `ReconciliationService` to map wallet/orders/contracts to plan commits; manual exception workflow. (scaffolded + wallet auto‑link implemented)
  - Reuse existing `TokenService` + `EsiService` character auth for fetching wallet/transactions/orders during reconciliation. (done)

## Docs/process

- Add ADRs for key decisions (fee model, cost basis policy, caching policy). (pending)
- Keep `docs/current-functionality.md` updated after feature changes. (in progress)

## Definition of Done (DoD)

- Code passes lint and basic tests; no new any/implicit any. (enforced)
- Request DTOs validated; errors return typed problem details. (enforced)
- Logs include module, station/item counts, and elapsed ms for hot paths. (in progress)
- DB queries explain analyzed for hotspots; indexes adjusted when needed. (pending)
