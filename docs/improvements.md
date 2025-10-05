## App Improvements (Architecture, Logic, Code Quality)

Principles

- Keep it simple; prefer small, high‑impact changes
- Centralize defaults; make behavior explicit via config
- Improve observability enough to debug issues quickly

### Prioritized Recommendations

#### P0 — Quick wins (safe, small, high value) — Completed

- Bold defaults into a single config module (Done)
  - Create `apps/api/src/common/config.ts` exporting runtime config: default source station (currently 60003760), fee percents, volume multipliers, ESI knobs. Allow env overrides.
  - Replace scattered literals/usages in `arbitrage`, `liquidity`, and controllers with the config import.
- Propagate request IDs end‑to‑end (Done)
  - Web → API: Forward or generate `x-request-id` in Next.js proxies (e.g., `apps/web/app/api/**/route.ts`). API already sets/reads IDs via `RequestIdMiddleware`.
  - Benefit: Correlate a single request across web/API/ESI logs.
- Add lightweight request logging (Done)
  - Add a Nest interceptor that logs `{method, path, status, ms, reqId}`. Register globally in `main.ts`.
  - Keep output single‑line to stay readable.
- Cap and periodically prune ESI in‑memory cache (Done)
  - `EsiService` keeps a `Map` cache. Add a simple cap (e.g., 5k entries via `ESI_MEM_CACHE_MAX=5000`) and prune LRU/oldest on insert.
  - Add a periodic prune (e.g., every 5 minutes) to drop expired entries.
- Validate query params consistently (Partial: applied to `/arbitrage/commits`)
  - Use `ZodValidationPipe` for GET query parsing (e.g., `arbitrage.commits` currently `Number()` casts). Define small zod schemas for `limit/offset`, etc., to avoid NaN/negative input.
- Document required secrets (Done)
  - Add `ENCRYPTION_KEY` (used by `CryptoUtil`) to `env.example.md` with a short note and example.

#### P1 — Architecture and logic improvements — Completed

- Clarify ESI client boundaries (Done)
  - Keep `EsiService` as the single integration point; move header normalization and tiny HTTP helpers into it or `common/http.ts` to avoid accidental duplication.
  - Add tiny typed helpers for common ESI patterns (paged GET with `X-Pages`, conditional GET with ETag) so call‑sites are smaller. (Done via `EsiService.fetchPaged`; `market-helpers` updated)
- Central fee/tick rules (Done)
  - Fees already centralized in `arbitrage/fees.ts`. Co‑locate business defaults and expose a single `getEffectiveSell(price, config)` helper used by pricing and arbitrage to prevent drift.
  - Helper added (`getEffectiveSell`) and used in arbitrage/pricing.
- Pagination everywhere lists data (Done)
  - Replace hardcoded `take: 500` with `(limit, offset)` on list endpoints and UI pages. Keep sensible caps (e.g., max 1000).
  - Wallet endpoints accept `sinceDays`, `limit`, `offset`; ledger entries and recon linked entries support `limit`/`offset`; recon commits validated with Zod.
- Consistent error envelope
  - `ZodValidationPipe` returns `{ error: 'ValidationError', issues }`. Mirror this for ESI and internal errors: `{ error: 'EsiError' | 'InternalError', message, reqId }`.
  - Map Axios/ESI failures to typed Nest exceptions with a safe client message.

#### P1 — Code quality & DX — Completed

- Shared ESLint/TS config (Done)
  - Ensure API and Web use the same `eslint.config.mjs` base and `tsconfig` strictness. Prefer `noImplicitAny`, `exactOptionalPropertyTypes` on where feasible.
- Safer decimal handling at API edges
  - You already serialize Prisma `Decimal` and `BigInt` to strings in responses. Document this in `docs/current-functionality.md` and keep consistent across new endpoints.

#### P2 — Scalability and resilience (nice to have) — Completed (rate limiting skipped)

- Rate limiting for public endpoints
  - Add a simple Nest throttler guard for unauthenticated endpoints (Health, metrics) to avoid accidental hammering.
- Background job toggles (Done)
  - Env toggles added: `ENABLE_JOBS` gate and per‑job flags `JOB_CLEANUP_ENABLED`, `JOB_DAILY_IMPORTS_ENABLED`, `JOB_WALLETS_ENABLED`, `JOB_CAPITAL_ENABLED`.
- Observability breadcrumbs (Done)
  - ESI requests log debug lines with `reqId` on success and retry; logging interceptor provides request timing.

### File‑level suggestions (how/where)

- Web proxies: forward request IDs
  - Update each Next API route to forward/generate `x-request-id`:
  - `apps/web/app/api/pricing/sell-appraise/route.ts`, `apps/web/app/api/pricing/undercut-check/route.ts`, `apps/web/app/api/plan-packages/route.ts`, `apps/web/app/api/**/route.ts`.
- API request logging
  - Add `apps/api/src/common/logging.interceptor.ts` and register globally in `main.ts`.
- Query validation with Zod
  - `apps/api/src/arbitrage/arbitrage.controller.ts` (`GET /arbitrage/commits`): introduce a zod schema for `limit/offset` via `@UsePipes`.
  - Repeat for similar GETs (`ledger`, `wallet` list endpoints) where applicable.
- ESI memory cache caps
  - `apps/api/src/esi/esi.service.ts`: add a `ESI_MEM_CACHE_MAX` cap and prune oldest when over cap; add a simple interval to drop expired entries.
- Config consolidation
  - Create `apps/api/src/common/config.ts` for defaults + env overrides. Replace scattered literals in `arbitrage.service.ts`, `liquidity.service.ts`, controllers.
- Env docs
  - Update `env.example.md` with `ENCRYPTION_KEY=generate-a-strong-secret` and a one‑line description.

### Rationale snapshot

- Simplicity first: These changes keep the codebase small, make behavior explicit, and improve debuggability.
- Low risk: Mostly additive (config, logging, validation) with contained edits.
- Scalable enough: Basic cache control, pagination, and typed error envelopes carry into larger datasets and production workflows without enterprise overhead.
