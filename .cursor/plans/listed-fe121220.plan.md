<!-- fe121220-c729-42cd-897b-d2f71a74be13 ce9c70c6-49bc-43d1-99ea-322cacea2417 -->
# Plan: Introduce listedUnits and fix Sell Appraiser rebuy behavior

## Overview

We will add an explicit `listedUnits` quantity to `CycleLine`, change Sell Appraiser logic to use unlisted units (remaining minus listed) instead of `currentSellPriceIsk === null`, and backfill `listedUnits` in production using existing sales data and live sell orders (similar to the undercut checker). We will also ensure that broker fees are always calculated from the **newly listed units** (unlisted portion being listed now), not from total units bought, so fee amounts stay accurate.

## 1. Data model and schema changes

- **Add listedUnits to CycleLine**
- In `packages/prisma/schema.prisma`, extend the `CycleLine` model with an integer field (e.g. `listedUnits Int @default(0) @map("listed_units")`).
- Generate and run a Prisma migration for this change.
- Regenerate Prisma client and ensure all API apps use the updated client.

- **Wire into shared typings**
- If any shared DTOs/types expose line-level quantities (e.g. in `@eve/shared/types`), extend them where appropriate to include `listedUnits` (only where this concept is needed; avoid bloating public types unnecessarily).

## 2. Core backend logic changes (Sell Appraiser & listing flows)

- **Redefine “needs listing” in PricingService**
- In `apps/api/src/market/services/pricing.service.ts`, update `sellAppraiseByCommit` so it no longer calls `getUnlistedCycleLines` (which filters on `currentSellPriceIsk: null`).
- Instead, fetch the relevant `CycleLine`s for the cycle (including `unitsBought`, `unitsSold`, `listedUnits`, `typeId`, `destinationStationId`, and pricing fields).
- For each line, compute:
- `remainingUnits = max(0, unitsBought - unitsSold)` (or fall back to planned units if `unitsBought == 0`, as today).
- `unlistedUnits = max(0, remainingUnits - listedUnits)`.
- Use `unlistedUnits` as the quantity to aggregate per `(destinationStationId, typeId)` and as `quantityRemaining` in the `SellAppraiseByCommitItem` results.
- Filter out any line/group where `unlistedUnits <= 0` so fully-listed lines (including those fully sold) do not appear.

- **Update cycle line facade methods if needed**
- In `CycleLineService` (`apps/api/src/cycles/services/cycle-line.service.ts`), either:
- Deprecate `getUnlistedCycleLines` in favor of a method that returns all lines for a cycle including `listedUnits`, or
- Reimplement `getUnlistedCycleLines` to apply the new quantity-based logic rather than the `currentSellPriceIsk: null` filter.

- **Update confirm-listing / bulk flows to maintain listedUnits and fee accuracy**
- In `PricingService.confirmListing`, continue to accept a **quantity parameter that represents the number of units being listed now** (not total units bought). Use that `quantity` both to:
- Compute the broker fee: `fee = quantity * unitPrice * brokerFeePct`, and
- Increment `listedUnits` by exactly that `quantity`.
- In bulk flows used by the Sell Appraiser commit mode:
- Ensure the backend endpoint reached by `/ledger/fees/broker/bulk` and `/ledger/lines/sell-prices/bulk` uses the **same unlisted quantity** that Sell Appraiser shows (`quantityRemaining` from the API, which will now be `unlistedUnits`) to compute broker fees and to increment `listedUnits`.
- Do **not** recompute fees based on `unitsBought` or total `remainingUnits`; always base the amount on the delta being listed in this action.
- Keep `confirmReprice` semantics unchanged (repricing only updates relist fees and price, not `listedUnits`), so it does not alter the listed vs unlisted split.

## 3. Backfill listedUnits for existing data (script using sales + ESI orders)

- **Define backfill algorithm per line**
- For each `CycleLine` in active/important cycles:
- Compute `baseListedFromSales = unitsSold` (assume any sold units must have been listed at some point).
- Fetch our characters’ active sell orders from ESI, reusing the logic from `undercutCheck` in `PricingService`:
- Use `CharacterService.getSellerCharacters()` and `EsiCharactersService.getOrders()`.
- For each order, use `type_id`, `location_id` (station), `volume_remain`, and original volume if available.
- For each line, find all active sell orders that match its `typeId` and `destinationStationId`.
- For each such order, treat only `volume_remain` as **currently listed but unsold**.
- Compute `listedFromOrders = sum(volume_remain for matching orders)`.
- Set the candidate `listedUnitsRaw = baseListedFromSales + listedFromOrders`.
- Clamp to a sane range: `listedUnits = min(listedUnitsRaw, unitsBought)` so we never mark more units listed than we bought.

- **Implement a one-off script**
- Add a script under `apps/api/scripts/` (e.g. `backfill-listed-units.ts`) that:
- Bootstraps Prisma and any required services (game data, character, ESI) similarly to the existing comprehensive e2e script.
- Optionally limits to cycles with `status = OPEN` or recent `createdAt` to avoid unnecessary historical work, depending on your needs.
- Iterates through target `CycleLine`s, computes `listedUnits` as above, logs a concise before/after line, and updates the database.
- Supports a dry-run mode (no writes, only logging) to validate behavior in staging/production before committing changes.

- **Guard against edge cases**
- Document and handle cases where:
- `unitsSold > unitsBought` (data anomaly) – cap `listedUnits` at `unitsBought`.
- No matching orders and `unitsSold == 0` – keep `listedUnits = 0` so those lines show in Sell Appraiser as entirely unlisted.
- A line is fully sold: `remainingUnits = 0` and `listedUnits >= unitsSold` – Sell Appraiser will not show it because `unlistedUnits <= 0`, which is desired.

## 4. Frontend alignment (Sell Appraiser page)

- **Keep API surface mostly the same**
- The frontend `SellAppraiserPage` already relies on `SellAppraiseByCommitItem.quantityRemaining` from the backend.
- After backend changes, `quantityRemaining` will represent `unlistedUnits`, so the UI behavior (which uses `quantityRemaining` to compute fees and show quantities) will naturally align with the new model and with broker fees being based on newly listed units.

- **Ensure fee calculation uses unlisted units**
- Review `apps/web/app/tradecraft/admin/sell-appraiser/page.tsx` to confirm that the broker fee preview and the payload sent to bulk fee/sell-price endpoints both use the `quantityRemaining` field from the API (which will be unlisted units) when computing fee amounts.
- If any other frontend flows (e.g. manual listing forms) currently derive broker fees from `unitsBought` or total remaining, update them to explicitly use the **number of units being listed in that action** instead.

- **Optional UI improvements**
- Consider updating explanatory copy or internal comments in `apps/web/app/tradecraft/admin/sell-appraiser/page.tsx` to clarify that in commit mode, the quantities shown are "remaining units that have not yet been listed", not just “lines without a sell price”.

## 5. Testing & validation

- **Unit / integration tests**
- Add backend tests for `sellAppraiseByCommit` covering:
- Line with units bought, no sales, no orders → entire `unitsBought` appears as `quantityRemaining`.
- Line with some sold and some open orders → `quantityRemaining` equals unsold, unlisted portion as per `listedUnits`.
- Line fully sold (with or without orders) → does not appear in results.
- Line rebought on an existing `CycleLine` with previous `listedUnits` → only the newly bought but not yet listed quantity appears.
- Add tests (or scenario checks) around broker fee calculations to verify they always use the same unlisted-unit quantity that updates `listedUnits`.

- **Script dry run and rollout**
- Run the backfill script in a non-production environment (or against a snapshot) with dry-run logging to verify that `listedUnits` values look correct for representative lines.
- Run the script in production with careful logging and monitoring.
- After backfill, manually verify in the UI that:
- Fully sold items no longer appear in Sell Appraiser.
- Rebuy scenarios now show only the new units needing listing.
- Broker fee amounts look correct relative to the units actually being listed.

## 6. Documentation updates

- **Update domain docs**
- In relevant docs (e.g. `docs/CYCLE_ACCOUNTING_REFACTOR.md` or a new short note), describe the meaning of `listedUnits`, how it interacts with `unitsBought`, `unitsSold`, and `currentSellPriceIsk`, and how Sell Appraiser uses `unlistedUnits`.
- Document that broker fees are always computed from the number of units being listed in that specific action (and that this same quantity is used to increment `listedUnits`), not from total units bought.