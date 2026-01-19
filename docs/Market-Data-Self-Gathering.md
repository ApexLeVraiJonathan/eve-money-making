## Market Data: Self-Gathering (Replacing/Reducing Adam4EVE)

## Why we’re doing this

Today we import **daily aggregated “market order trades”** from Adam4EVE and use them as a proxy for liquidity and pricing heuristics across Tradecraft (planner, Strategy Lab, liquidity checks).

We want to gather this data ourselves because:

- **Access**: Alliance/private trade hubs are often **player structures** where third parties don’t have market access.
- **Control**: We want to tune *how* trade data is deduced and represent uncertainty more “justly”.
- **Reliability**: Reduce missed days / external incidents and make backfill behavior deterministic for us.

## Current state in this repo (Adam4EVE usage)

### What we ingest

We ingest Adam4EVE’s `MarketOrdersTrades` “daily aggregates” into the Prisma model `MarketOrderTradeDaily` (`market_order_trades_daily`):

- `scanDate` (UTC day start)
- `locationId` (station/structure id)
- `regionId`
- `typeId`
- `isBuyOrder`
- `hasGone`
- `amount`, `high`, `low`, `avg`, `orderNum`, `iskValue`

### Where it is implemented

- **Import logic**: `apps/api/src/game-data/services/import.service.ts`
  - Imports `marketOrderTrades_daily_YYYY-MM-DD.csv` from `https://static.adam4eve.eu/…`
  - Filters to **tracked stations + the configured source station** (planner needs buy pricing from it)
- **Scheduled job**: `apps/api/src/tradecraft/jobs/jobs.service.ts`
  - Runs `importMissingMarketOrderTrades(15)` daily (`EVERY_DAY_AT_10AM`)
- **Direct dev backfill**: `apps/api/scripts/import-market-trades-weekly.cjs`
- **Downstream dependencies**:
  - Liquidity heuristics: `apps/api/src/tradecraft/market/services/liquidity.service.ts`
  - Pricing fallback heuristics: `apps/api/src/tradecraft/market/services/pricing.service.ts`
  - Strategy Lab market coverage + simulations: `apps/api/src/tradecraft/strategy-lab/*`

### Other Adam4EVE dependencies (non-trade data)

The admin import endpoints also pull static ID lists from Adam4EVE:

- `type_ids.csv`
- `region_ids.csv`
- `solarSystem_ids.csv`
- `npcStation_ids.txt`

These can and probably should migrate to CCP SDE/ESI over time (see “Migration away from Adam4EVE”).

## How Adam4EVE produces “MarketOrderTrades”

Adam4EVE’s approach (per their docs) is:

- Take **orderbook snapshots** every ~15 minutes.
- Compare snapshots and detect:
  - **volume changes** on existing orders (interpreted as trades),
  - **disappeared orders** (interpreted as cancellations *or* as fully-filled trades depending on how you count).
- Aggregate those inferred trades into daily metrics per `(location_id, type_id, is_buy_order, has_gone, scanDate)`.

Reference: [Adam4EVE MarketOrdersTrades column description](https://static.adam4eve.eu/MarketOrdersTrades/MarketOrdersTrades.txt).

## Proposed approach: our own “orderbook snapshot → deduced trades → daily aggregates”

### High-level architecture

We build a pipeline per **market location** (NPC station or player structure):

1. **Collector job** periodically fetches the relevant orderbook snapshot from ESI.
2. **Diff engine** compares snapshot \(N\) vs snapshot \(N-1\) and emits “trade events”.
3. **Aggregator job** rolls those events into daily aggregates (compatible with our current `MarketOrderTradeDaily` usage).

The biggest decision is the collection strategy, because ESI offers different primitives for NPC stations vs player structures.

### Data sources in ESI

#### Player structures (our main target)

- **Endpoint**: `GET /markets/structures/{structure_id}`
  - Cached ~5 minutes (per ESI behavior).
  - Returns *all active* orders in that structure (no per-type filter).
  - Requires authenticated access and the character must have access to the structure’s market.

This is the best fit for alliance trade hubs because it directly gives us the structure’s full orderbook.

#### NPC stations (secondary / optional)

ESI does not provide a “list all orders in this station” endpoint. Instead:

- **Regional orders**: `GET /markets/{region_id}/orders/` (paged)
  - Can be filtered by `order_type` and `type_id` (pattern already exists in `apps/api/src/esi/market-helpers.ts`).

This is viable only if we constrain the type universe (e.g., the subset we actually trade), otherwise it becomes very heavy.

Useful discovery/start point: [ESI API Explorer](https://developers.eveonline.com/api-explorer#/).

### Trade deduction algorithm (snapshot diffing)

We can reproduce the core of Adam4EVE’s model while making the uncertainty explicit.

#### Definitions

An order in snapshot has:

- `order_id`, `type_id`, `is_buy_order`, `price`
- `volume_remain`, `volume_total`
- `issued`, `duration`, `location_id`

We store snapshots keyed by `order_id` (plus `location_id`), and for each poll we compute deltas.

#### Confirmed trade volume (robust)

If an order exists in both snapshots:

- \( \Delta = prev.volume\_remain - curr.volume\_remain \)
- If \( \Delta > 0 \), interpret as **confirmed traded volume** of \( \Delta \) at that order’s `price`.

This is the most “just” signal because it is directly observed as a reduction.

#### Disappeared orders (inherently ambiguous)

If an order existed in snapshot \(N-1\) and is missing in snapshot \(N\), it can be:

- **Filled** (trade happened)
- **Canceled / expired** (no trade)

Adam4EVE uses the `has_gone` dimension to represent two counting modes:

- `has_gone = 0`: count only changed orders (safer / lower-bound)
- `has_gone = 1`: treat disappeared orders as fully filled in one transaction (upper-bound)

**Recommendation for our pipeline**:

- Always compute and persist **two parallel aggregates**:
  - **Lower-bound**: deltas only (ignore disappeared orders for volume)
  - **Upper-bound**: deltas + treat disappearances as full fill of `prev.volume_remain`
- Optionally add a third “best-estimate” mode later, but only if we can defend it.

This gives Strategy Lab/liquidity checks better knobs: “be conservative” vs “assume fast fills”.

##### Expiry-aware handling (recommended improvement)

We can reduce false “upper-bound” fills by tracking whether a disappeared order was **near expiry**.

From ESI structure orders we have:

- `issued` (timestamp)
- `duration` (days, integer)

So we can compute:

- `expiresAt = issued + duration days`

Heuristic:

- If an order disappears and it was **within a small expiry window** (e.g., <= 30 minutes or <= 6 hours) of `expiresAt`, treat it as **likely expiry** and **do not** count it as a fill in the “upper-bound” mode.

Notes:

- In ESI payloads, `duration` stays an integer number of days (e.g. 90, 7, 1); it does **not** tick down to “hours remaining”.
  - So “hours left” is derived as `expiresAt - observedAt` using our poll timestamp.
- A `duration = 1` order is **not automatically near expiry** (it could be freshly created). It’s only “likely expired” when `observedAt` is close to `expiresAt` (i.e., the order age is close to 24h).
- This makes the remaining “gone” orders more plausibly “fully filled”.
- It won’t solve cancellations/repricing (some traders do cancel/relist to reprice), but it removes a predictable class of non-trade disappearances.
- The expiry window should be configurable and validated on real data from our target hub.

#### Daily metrics to match our current table

For each day/location/type/side (and for each counting mode):

- **amount**: sum of traded volumes
- **orderNum**: count of trade transactions
  - conservative definition: count of distinct `order_id` with \(\Delta > 0\)
  - upper-bound adds disappeared orders as +1 each
- **iskValue**: sum(tradedVolume * price)
- **high/low**: max/min price across traded orders that day
- **avg**: volume-weighted average price:
  - \( avg = \frac{\sum (v_i \cdot p_i)}{\sum v_i} \)

### Making it more efficient than Adam4EVE (especially for structures)

Adam4EVE snapshots every 15 minutes for only the biggest hubs because it’s expensive at scale.

For **our own alliance structure**, we can be both:

- **more frequent** (e.g., every 5 minutes, aligned with ESI cache time), and
- **more complete** (because we have access).

Efficiency tactics:

- **Snapshot storage is incremental**: keep a “latest snapshot” table keyed by `(location_id, order_id)`; no need to store full history forever.
- **Diff in-memory, write events/batches**: compute deltas in memory and batch write “events” or directly accumulate into daily aggregates.
- **Respect ESI caching**: don’t hammer; schedule at ~cache interval and use ETag-aware caching (we already have `EsiCacheEntry` in Prisma).

### “Just data”: handling bias and missingness

No snapshot-based method can see trades that happen fully between polls (e.g., an order created and fully filled between two 5-minute snapshots).

What we *can* do:

- **Shorter polling interval** reduces but doesn’t eliminate this.
- **Represent uncertainty explicitly**:
  - store lower/upper bounds (deltas-only vs include-gone)
  - track a “coverage” signal per day (how many polls were successfully captured)
- **Avoid overstating precision** in Strategy Lab:
  - treat “daily units sold” as a heuristic, not a fact
  - allow runs to require minimum coverage

## Data model proposal (incremental, compatible with current usage)

### Option A (recommended): add raw “event” + snapshot tables, keep `MarketOrderTradeDaily` as the stable contract

Add:

- `MarketOrderSnapshotLatest`
  - `(location_id, order_id)` primary key
  - fields needed for diffing: `type_id`, `is_buy_order`, `price`, `volume_remain`, `issued`, etc.
  - `observed_at` timestamp
- `MarketOrderTradeEvent`
  - append-only events: `(location_id, order_id, observed_at, delta_volume, price, type_id, is_buy_order, kind)`
  - `kind` could be `DELTA` | `GONE_INFERRED`

Then aggregate daily into existing `MarketOrderTradeDaily` so downstream code keeps working.

### Option B (minimal schema change): write daily aggregates directly

Collector computes deltas and directly upserts daily aggregates.

This is faster to ship but:

- harder to debug and backfill correctly
- loses the ability to re-run aggregation logic as we refine fairness rules

## Auth & access for structure markets

Structure markets require:

- a character token with the correct ESI market scope (structure markets)
- that character must have docking/market access to the structure

Implementation-wise, we already have token plumbing (`EsiTokenService`, character linking). The new market collector should be modeled similarly to our other ESI-driven jobs:

- choose a “system-managed” character or a configured “market-collector character”
- store which structure(s) it is responsible for
- handle refresh failures with clear alerts

## Migration away from Adam4EVE (dependency audit checklist)

### Phase 1: self-gather for our alliance structure(s) only

- Implement structure snapshot collection + deduced trades + daily aggregation for configured structure IDs.
- Keep Adam4EVE import for NPC hubs (Jita, etc.) while we validate.
- Add a “source preference” in code paths that consume market trades:
  - prefer “self-gathered” where present for that location
  - fallback to Adam4EVE otherwise

Initial rollout target (provided):

- **Structure (trade hub)**: `1045667241057`
- **Collector character**: `LeVraiTrader` (`2122151042`)
  - Must have market access to the structure and the required ESI scopes for structure markets.

### Phase 2: optional NPC hub self-gather (curated type universe)

For NPC stations we can self-gather only for types we care about:

- derive type universe from our own usage (planner outputs, tracked items, Strategy Lab universe)
- poll region orders per type (existing paging helper), filter to station, diff by `order_id`

This should be an opt-in because of ESI volume and rate limiting.

### Phase 3: replace Adam4EVE static ID imports

Replace:

- type/region/solar system/station ID lists

With:

- CCP SDE (preferred for static IDs/names)
- or ESI universe endpoints where appropriate

This reduces non-market reliance on Adam4EVE and makes builds/backfills more deterministic.

## Open questions (we should answer early)

- **Exact polling cadence**: 5 minutes aligned to cache vs faster (wasteful) vs slower (miss more).
- **Storage strategy**: event tables (debuggable) vs direct daily aggregation (simpler).
- **How we represent “coverage”** in Strategy Lab / liquidity checks.
- **Do we need per-structure configuration** (tracked structure list, owning corp/alliance, collector character, on/off switch).
- **How to handle merges** if we ingest both sources for the same `(day, location, type)` (add a `source` dimension vs separate tables).

## References

- [Adam4EVE MarketOrdersTrades column description](https://static.adam4eve.eu/MarketOrdersTrades/MarketOrdersTrades.txt)
- [ESI API Explorer](https://developers.eveonline.com/api-explorer#/)
