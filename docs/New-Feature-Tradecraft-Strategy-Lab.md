# Tradecraft Strategy Lab (Paper Trading / Backtesting)

## Why

Today we have:

- **Planner knobs** in `apps/web/app/tradecraft/admin/planner/page.tsx` that generate a plan via `POST /arbitrage/plan-packages`.
- **Commit** via `POST /arbitrage/commit` which updates `CycleLine.plannedUnits` and creates `CommittedPackage` records.
- **Cycle intel** at `GET /ledger/cycles/:cycleId/lines/intel` which combines:
  - realized P&L from `cycle_lines` (via wallet allocations/fees), and
  - “market risk” using **daily market trade aggregates** in `market_order_trades_daily`.

We see some positions that are consistently good, and some that are consistently terrible. We need a way to:

- systematically test different knob settings (“strategies”),
- track performance over time,
- and learn what settings/items to prefer or blacklist,
- **without risking principal**.

This document proposes a **Strategy Lab**: a paper trading / backtesting subsystem that reuses the existing planner + market data to simulate outcomes and compare strategies.

---

## Current-state map (what we can reuse)

### Planner → API

- **Endpoint**: `POST /arbitrage/plan-packages`
- **DTO**: `apps/api/src/tradecraft/market/dto/plan-packages-request.dto.ts` (`PlanPackagesRequest`)
- **Service**: `apps/api/src/tradecraft/market/services/arbitrage.service.ts`

Key detail: the “knobs” are already formalized as a validated DTO:

- shipping costs, package capacity, investment size
- per-item budget share
- allocation mode + spreadBias + destination caps
- liquidity filters (windowDays, minCoverageRatio, minISK, minTrades/day)
- arbitrage constraints (maxInventoryDays, minMargin%, price deviation filter, minTotalProfit, inventory behavior)
- fee assumptions (salesTaxPercent, brokerFeePercent)
- package quality filters (min net profit, min ROI%, shipping multiplier, densityWeight)
- courier contract presets (blockade/dst/auto)

### Commit → DB

- **Endpoint**: `POST /arbitrage/commit` (admin-only)
- **Behavior**: consolidates package items and updates/creates `CycleLine` rows (and creates `CommittedPackage` / `CommittedPackageItem` / `PackageCycleLine`).

### Cycle intel → DB + market data

- **Endpoint**: `GET /ledger/cycles/:cycleId/lines/intel` (admin-only)
- **Service**: `apps/api/src/tradecraft/cycles/services/cycle-lines-intel.service.ts`
- Pulls:
  - `cycle_lines` for units + realized sales/cogs/fees + optional `currentSellPriceIsk`
  - `market_order_trades_daily` (latest row per destination+type) for market-low proxy

### Market history data source (already exists)

We already ingest **daily aggregated trades** into `MarketOrderTradeDaily`:

- **Ingestion**: `apps/api/src/game-data/services/import.service.ts` imports `marketOrderTrades_daily_YYYY-MM-DD.csv` (Adam4EVE) but **filters to tracked stations**.
- **Scheduled job**: `apps/api/src/tradecraft/jobs/jobs.service.ts` runs `importMissingMarketOrderTrades(15)` daily (`CronExpression.EVERY_DAY_AT_10AM`).
- **Tracked stations**: CRUD via `apps/api/src/tradecraft/market/tracked-stations.controller.ts`.

This is a great foundation for Strategy Lab: we already have the long-running historical time series we need.

### Knob presets (already exists)

- **Parameter profiles**: `GET/POST/PATCH/DELETE /parameter-profiles`
- DB model: `ParameterProfile` with `params` as JSON.

Strategy Lab should _reuse_ this concept but add performance tracking + backtests.

---

## Goals / Non-goals

### Goals

- **Versioned strategies**: store a named strategy with the exact planner payload (knobs).
- **Paper runs**: simulate buy+sell outcomes over time using historical market data.
- **Comparable metrics**: profit, ROI, profit/day, max drawdown, win-rate, tail risk, capital efficiency.
- **Explainability**: per-run drill-down to “which items/destinations hurt or helped”.
- **Calibration**: optionally infer realistic sell-through rates from real cycles.
- **Actionable feedback**:
  - recommended default knobs,
  - blacklist suggestions,
  - “this strategy works in regime X, fails in regime Y”.

### Non-goals (initially)

- Perfect market microstructure (order queue position, undercut wars, partial fills across price ladder).
- Real execution / wallet effects.
- Live auto-trading.

We can add sophistication later; Phase 1 should already provide value.

---

## Core concept: Strategy, Run, Simulation

### Strategy (a named set of knobs)

Store:

- `name`, `description`
- `params`: **exact `PlanPackagesRequest` payload** (or a superset with Strategy-Lab-specific fields)
- ownership + timestamps (admin-only initially)

### Run (a backtest / paper-sim)

A Run is a specific execution of a Strategy across a time range with fixed assumptions:

- date range (e.g., 2025-10-01 → 2025-12-31)
- initial capital/budget
- sell model (see below)
- fee model
- station universe (tracked stations)
- data availability requirements (must have `MarketOrderTradeDaily` coverage)

### Simulation model (MVP)

We need a fill model for “how fast can we sell the inventory we bought”:

1. **Volume share model (simple, configurable)**

   - assume we can sell `sellSharePct` of daily sell volume (`MarketOrderTradeDaily.amount`) at destination per day.

2. **Calibrated capture model (recommended mid-term)**
   - infer capture rate from your own operations:
     - actual sold units per day vs daily market volume
     - stratify by station and/or by item liquidity bucket
   - then use that capture rate for the sim.

Important: the simulation should track **inventory lockup** and **time-to-sell**, not just mark-to-market.

---

## Data model (proposed Prisma tables)

This is the minimum schema that enables runs + analytics without overbuilding.

### `TradeStrategy`

- `id` (uuid)
- `name` (unique)
- `description` (optional)
- `params` (Json) — planner knobs payload (compatible with `PlanPackagesRequest`)
- `isActive` (bool)
- `createdBy` (user id, optional)
- `createdAt`, `updatedAt`

### `TradeStrategyRun`

- `id` (uuid)
- `strategyId` (fk)
- `status` (`QUEUED` | `RUNNING` | `COMPLETED` | `FAILED` | `CANCELLED`)
- `startDate`, `endDate`
- `initialCapitalIsk` (Decimal)
- `sellModel` (enum: `VOLUME_SHARE` | `CALIBRATED_CAPTURE`)
- `sellSharePct` (Decimal, optional; for VOLUME_SHARE)
- `assumptions` (Json) — fees, pricing choice, etc.
- `startedAt`, `finishedAt`
- `summary` (Json) — cached metrics for quick list rendering
- `error` (string, optional)

### `TradeStrategyRunDay`

Daily snapshots for charting and metrics:

- `runId` (fk), `date`
- `cashIsk`
- `inventoryCostIsk` (cost basis remaining)
- `inventoryMarkIsk` (mark-to-market using destination daily low/avg)
- `realizedProfitIsk`, `unrealizedProfitIsk`
- `navIsk` (cash + inventoryMark)
- indexes on `(runId, date)`

### `TradeStrategyRunPosition`

One row per (destinationStationId, typeId) position opened by the plan:

- `runId`, `destinationStationId`, `typeId`
- `plannedUnits`
- `buyUnitPriceIsk` (assumption: derived from source station daily data)
- `sellUnitPriceModel` (how we price sells in sim: low/avg/nextTick)
- `unitsSold`, `unitsRemaining`
- `costBasisIskRemaining`
- `realizedProfitIsk`
- `createdAt`, `updatedAt`

### `TradeStrategyBlacklistItem` (optional in early phases)

- `id`, `strategyId` (nullable for global blacklist)
- `typeId`
- `reason` (string), `notes` (optional)
- `createdAt`, `updatedAt`

---

## API surface (proposed)

All endpoints below are **admin-only** (same guard pattern as planner commit/intel).

### Strategies

- `GET /strategy-lab/strategies`
- `POST /strategy-lab/strategies`
- `GET /strategy-lab/strategies/:id`
- `PATCH /strategy-lab/strategies/:id`
- `DELETE /strategy-lab/strategies/:id` (soft-delete recommended)

### Runs

- `POST /strategy-lab/runs` — create and start a run
- `GET /strategy-lab/runs` — list runs + summary metrics
- `GET /strategy-lab/runs/:id` — run detail (days + positions + settings)
- `POST /strategy-lab/runs/:id/cancel`

### Calibration (Phase 2)

- `POST /strategy-lab/calibration/recompute`
- `GET /strategy-lab/calibration` — inspect current capture rates/segments

---

## UI surface (proposed)

Add under Tradecraft admin:

- `/tradecraft/admin/strategy-lab`
  - **Leaderboard**: rank strategies and runs by profit/day, ROI, drawdown, stability.
  - **Run detail**: NAV chart, realized/unrealized split, inventory days, “worst offenders” table.
  - **Strategy editor**: choose an existing Planner/Parameter Profile as a base, then tweak.

Implementation notes (match repo rules):

- Use app router pages under `apps/web/app/tradecraft/admin/strategy-lab/*`.
- Use `@eve/ui` components and TanStack Query hooks under `apps/web/app/tradecraft/api/*`.
- Use `useApiClient()` (don’t call `fetch` directly).

---

## Simulation specifics (MVP assumptions)

This is where we must be explicit, otherwise we’ll “optimize knobs for fantasy”.

### Pricing sources: Backtest vs Forward Test

There are two practical modes, with different tradeoffs:

- **Backtest mode (fast iteration, uses historical aggregates)**:

  - Uses `MarketOrderTradeDaily` so we can simulate _past windows_ immediately (e.g. last 30/90/180 days) and test many strategies quickly.
  - Pricing proxies (no full order book history):
    - **source station buy price**: source station `avg` or `high` (more conservative) for `isBuyOrder=false` at the source station.
    - **destination sell price**: destination station `low` (more conservative) or `avg` (less conservative).

- **Forward-test mode (slow iteration, higher fidelity, uses live ESI over time)**:
  - Uses ESI (we already have it) to record **daily snapshots** of the relevant items/markets for a strategy, then simulates outcomes as time progresses.
  - This is ideal to “graduate” the best strategies from backtesting into real-world validation **without risking principal**.
  - Note: by definition, this requires waiting for time to pass (can’t instantly test last 30 days unless we already recorded snapshots).

Defaults should be conservative to avoid overestimating profit (especially in Backtest mode).

### Fees

Reuse the existing fee logic used in cycle intel and pricing:

- `getEffectiveSell(price, feeInputs)` (sales tax + broker fee)

Make fees configurable per run (but default to `AppConfig.arbitrage().fees`).

### Fill model

#### Model A: `VOLUME_SHARE`

For each day and each position:

- `dailySellCapUnits = floor(MarketOrderTradeDaily.amount * sellSharePct)`
- `unitsSoldToday = min(unitsRemaining, dailySellCapUnits)`
- apply revenue at chosen daily price proxy, minus fees

#### Model B: `CALIBRATED_CAPTURE` (Phase 2)

Compute capture rates from your real ops, then apply:

- `sellSharePct = f(stationId, liquidityBucket, maybe typeGroup)`

This makes simulations match how much volume you actually capture.

---

## Metrics (what we should compute and store)

At minimum (per run):

- total profit, ROI
- profit/day (and/or profit per 1B/day)
- max drawdown (NAV-based)
- percent of days with positive realized profit
- “inventory time”: average/median days to sell through
- top winners/losers (by realized profit, by drawdown contribution)

And per position:

- realized profit, unrealized profit at end
- time-to-sell, average daily sold units
- market regime sensitivity (optional later)

---

## Phased implementation plan

### Phase 0 — Alignment + foundations (1–2 days)

- Document the exact **assumptions** for pricing proxy and fill model.
- Confirm the “source station” for arbitrage (likely Jita) and which tracked destination stations matter.
- Decide whether Strategy Lab strategies are:
  - separate from `ParameterProfile` (recommended), or
  - stored as a new `ParameterProfileScope = STRATEGY` (possible, but mixes concerns).

Deliverable:

- This doc + a small architecture diagram (optional).

### Phase 1 — MVP Strategy Lab (paper-sim, volume-share) (3–7 days)

Backend:

- Add new Prisma models (`TradeStrategy`, `TradeStrategyRun`, `TradeStrategyRunDay`, `TradeStrategyRunPosition`).
- Implement `/strategy-lab/*` controllers/services.
- Implement simulation engine using `MarketOrderTradeDaily` + `PlanPackagesRequest` payload.
  - Run generates a plan (either:
    - reuse packager directly with a “historical pricing mode”, or
    - create a dedicated “historical plan builder” that uses `MarketOrderTradeDaily` instead of live ESI station orders).
- Persist daily snapshots + position details.

Jobs:

- Optional: run simulations synchronously for short ranges; for long ranges, run in a background job (cron or “manual step” endpoint).

Frontend:

- Add `/tradecraft/admin/strategy-lab`:
  - create/edit strategy (JSON editor is fine at first)
  - start a run (pick date range, initial capital, sellSharePct)
  - view runs list + drilldown with NAV chart

Success criteria:

- You can compare 5–10 strategies over 30–90 days and identify “obviously bad” knob combos/items.

### Phase 1.5 — Graduate winners to Forward Tests (ESI snapshotting) (3–7 days)

Goal: once Phase 1 identifies a small set of promising strategies, validate them with higher-fidelity data.

Backend:

- Add a small “snapshot” subsystem that, daily:
  - resolves the strategy’s planned positions (typeId + destinationStationId, plus source station),
  - queries ESI for the current price inputs needed by the sim (e.g., cheapest sell, or a small depth ladder),
  - stores snapshots in a new table (e.g., `TradeStrategyForwardSnapshot`).

Frontend:

- “Start forward test” action on a strategy/run
- Basic charting of forward-test NAV vs the backtest estimate

Success criteria:

- We can run a handful of forward tests in parallel and see whether the backtest assumptions are optimistic/pessimistic and where.

### Phase 2 — Calibration (capture-rate) + blacklist suggestions (5–10 days)

Backend:

- Add calibration job/service:
  - Compute capture rates from **real cycle sell allocations** vs `MarketOrderTradeDaily.amount`.
  - Store calibration output (either as a table, or cached JSON in a single row keyed by version).
- Extend simulation fill model to use calibration.
- Add basic blacklist table and a job to propose blacklist candidates based on recurring negative contribution.

Frontend:

- Add “calibration status” panel (when last computed, how many samples, per-station rates).
- Add “suggested blacklist” tab with accept/reject workflow.

Success criteria:

- Paper results roughly match observed “time-to-sell” and loss frequency for known cycles.

### Phase 3 — Better realism + optimization workflows (10–20 days)

Add one or more:

- **Walk-forward testing** (avoid overfitting):
  - optimize knobs on window A, evaluate on subsequent window B.
- **Grid search / Bayesian optimization** for a subset of knobs.
- **Regime segmentation**:
  - weekends vs weekdays, patch weeks, high volatility periods.
- **Orderbook-aware model (optional)**:
  - use limited ESI scans for current runs and keep them small, or store periodic “best sell” snapshots.

Success criteria:

- Strategy Lab produces stable, interpretable recommendations and reduces catastrophic losers.

---

## Engineering notes / risks

- **Historical planning vs current planning**: today `ArbitrageService.check()` relies on live ESI station sell orders. For true backtests, we need a “historical price proxy mode” built on `MarketOrderTradeDaily`. That is the key technical fork to resolve in Phase 1.
- **Data coverage**: `MarketOrderTradeDaily` import filters to tracked stations; Strategy Lab runs should validate that the requested period has sufficient coverage for the stations/items involved.
- **Conservatism**: default assumptions should be pessimistic (use destination `low`, include fees, cap daily fill).
- **Performance**: store daily snapshots and per-position rows; avoid recomputing everything on every UI load.

---

## Next decisions (you choose)

1. **Backtest planning mode**: should we:

   - add a new endpoint `POST /arbitrage/plan-packages-historical`, or
   - add a new module `strategy-lab` that plans from market history and then reuses the existing packager?

2. **Pricing proxy** (MVP):

   - source buy price: `avg` vs `high`
   - destination sell price: `low` vs `avg` vs `nextCheaperTick(low)`

3. **What do we optimize for by default?**
   - raw profit, profit/day, max drawdown constraint, or capital efficiency.
