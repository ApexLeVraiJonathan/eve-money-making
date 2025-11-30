# Listed Units Implementation

**Date**: 2025-11-16  
**Status**: ✅ Complete

## Overview

We introduced an explicit `listedUnits` field to `CycleLine` to fix a critical bug in the Sell Appraiser where rebought items on existing lines would not appear for listing.

## Problem Statement

### Original Logic (Flawed)

The Sell Appraiser used `currentSellPriceIsk === null` as a boolean marker for "this line needs listing":

1. Planner commits items → creates/updates `CycleLine`
2. User lists items → sets `currentSellPriceIsk` and adds broker fees
3. Planner runs again and commits more of the same item to the same destination
   - Existing `CycleLine` is found and `plannedUnits` is incremented
   - **BUT** `currentSellPriceIsk` remains non-null
4. Sell Appraiser filters for `currentSellPriceIsk === null`
   - **Result**: The newly bought units never appear in Sell Appraiser!

### Root Cause

Treating `currentSellPriceIsk` as a binary "listed vs not listed" flag doesn't work when:
- A single `CycleLine` can have multiple buy waves
- Only some units are listed while others remain unlisted
- The line already has a price set from the first listing

## Solution: Quantity-Based Tracking

### New Field: `listedUnits`

Added to `CycleLine`:
```prisma
listedUnits  Int  @default(0)  @map("listed_units")
```

### New Logic

**"Unlisted Units" Concept**:
```typescript
remainingUnits = max(0, unitsBought - unitsSold)  // or plannedUnits if nothing bought yet
unlistedUnits = max(0, remainingUnits - listedUnits)
```

A line **needs listing** if `unlistedUnits > 0`, regardless of whether `currentSellPriceIsk` is set.

### Field Semantics

| Field | Meaning |
|-------|---------|
| `plannedUnits` | Total units planned to be bought for this line |
| `unitsBought` | Total units actually purchased |
| `unitsSold` | Total units sold via wallet transactions |
| `listedUnits` | Total units that have been **put onto the market** (i.e., attached to sell orders) |
| `remainingUnits` | Computed: `unitsBought - unitsSold` (what's in inventory) |
| `unlistedUnits` | Computed: `remainingUnits - listedUnits` (what's not on market yet) |
| `currentSellPriceIsk` | Current/most recent listing price (used for fee validation and profit estimates, **not** a boolean flag) |

## Implementation Details

### 1. Schema Changes

- Added `listedUnits Int @default(0)` to `CycleLine` in Prisma schema
- Applied via `prisma db push` (no migration file, preserves data)
- Updated shared types in `@eve/shared/types`

### 2. Backend Changes

#### CycleLineService

- Updated `listCycleLines` to select and return `listedUnits`
- Rewrote `getUnlistedCycleLines`:
  - Fetches **all** lines for the cycle (not filtered by `currentSellPriceIsk`)
  - Computes `unlistedUnits` per line
  - Returns only lines where `unlistedUnits > 0`

#### PricingService

**`sellAppraiseByCommit`**:
- Calls updated `getUnlistedCycleLines` (now quantity-based)
- Computes `unlistedUnits` per line
- Aggregates by `(destinationStationId, typeId)`
- Returns `quantityRemaining = unlistedUnits` in API response

**`confirmListing`**:
- Continues to accept `quantity` parameter (units being listed now)
- Computes broker fee: `fee = quantity * unitPrice * brokerFeePct`
- Increments `listedUnits` by `quantity`
- Sets `currentSellPriceIsk`

#### Bulk Flows

**`updateBulkSellPrices` (CycleLineService)**:
- Updated DTO to accept optional `quantity` per update
- If `quantity` provided, increments `listedUnits` by that amount
- Always sets `currentSellPriceIsk`

### 3. Frontend Changes

**Sell Appraiser Page** (`apps/web/app/tradecraft/admin/sell-appraiser/page.tsx`):
- Already used `r.quantityRemaining` from API (now equals `unlistedUnits`)
- Updated to send `quantity: r.quantityRemaining` in bulk price update payload
- Broker fee calculation unchanged: uses `quantityRemaining` (correct!)

### 4. Backfill Script

**Location**: `apps/api/scripts/backfill-listed-units.ts`

**Algorithm**:
For each `CycleLine`:
1. `baseListedFromSales = unitsSold` (sold units must have been listed)
2. Fetch active sell orders from ESI for all seller characters
3. For matching orders (same `typeId`, `destinationStationId`):
   - `listedFromOrders = sum(volume_remain)`
4. `calculatedListedUnits = min(baseListedFromSales + listedFromOrders, unitsBought)`
5. Update `listedUnits` if different from current value

**Usage**:
```bash
# Dry run (log only, no writes)
DRY_RUN=true pnpm --filter @eve/api tsx scripts/backfill-listed-units.ts

# Process only open cycles
STATUS=OPEN pnpm --filter @eve/api tsx scripts/backfill-listed-units.ts

# Process specific cycle
CYCLE_ID=<uuid> pnpm --filter @eve/api tsx scripts/backfill-listed-units.ts

# Apply changes to all cycles
pnpm --filter @eve/api tsx scripts/backfill-listed-units.ts
```

## Broker Fee Accuracy

### Before (Incorrect)

Broker fees were sometimes computed from total `unitsBought` or `remainingUnits`, even when only listing a portion.

### After (Correct)

Broker fees are **always** computed from the **quantity being listed in that specific action**:

- **Single listing** (`confirmListing`): `fee = params.quantity * params.unitPrice * feePct`
- **Bulk listing** (Sell Appraiser): `fee = r.quantityRemaining * r.suggestedPrice * feePct`
  - Where `r.quantityRemaining = unlistedUnits` (only the newly unlisted portion)

The same `quantity` used for the fee is also used to increment `listedUnits`, ensuring consistency.

## Edge Cases Handled

1. **Fully sold line**: `remainingUnits = 0` → `unlistedUnits = 0` → does not appear in Sell Appraiser ✓
2. **No units bought yet**: Falls back to `plannedUnits` for pre-listing price checks ✓
3. **Rebuy on already-listed line**: `listedUnits` stays the same, new units increase `remainingUnits`, so `unlistedUnits` becomes positive again ✓
4. **Data anomaly** (`unitsSold > unitsBought`): Backfill clamps `listedUnits` to `unitsBought` ✓
5. **Repricing**: `confirmReprice` does **not** change `listedUnits` (only updates price and relist fees) ✓

## Benefits

1. **Fixes rebuy bug**: Multiple buy waves on the same line now correctly show unlisted portions
2. **Accurate fees**: Broker fees always match the quantity actually being listed
3. **Clear semantics**: Explicit tracking instead of inferring from boolean flags
4. **Extensible**: Supports future scenarios (partial listings, multi-wave buying, etc.)

## Migration Path

1. ✅ Schema change applied via `db push` (preserves data)
2. ✅ Backend services updated to use `unlistedUnits` logic
3. ✅ Listing flows increment `listedUnits` correctly
4. ✅ Frontend sends `quantity` in bulk updates
5. ⏳ Run backfill script in production to set initial `listedUnits` values
6. ✓ Verify Sell Appraiser shows correct items post-backfill

## Testing Recommendations

### Unit/Integration Tests

- Line with `unitsBought`, no sales, no orders → entire `unitsBought` appears as `quantityRemaining`
- Line with some sold and some open orders → `quantityRemaining` equals unsold, unlisted portion
- Line fully sold → does not appear in Sell Appraiser results
- Line rebought on existing line with previous `listedUnits` → only newly bought unlisted units appear
- Broker fee calculations use `unlistedUnits` quantity

### Manual Verification (Post-Backfill)

1. Run backfill script in dry-run mode, review logs
2. Run backfill script (apply changes)
3. Check Sell Appraiser UI:
   - Fully sold items should not appear
   - Partially listed items should show only unlisted portion
   - Rebought items on existing lines should appear with new units
4. Confirm broker fee amounts match `unlistedUnits * price * feePct`

## Related Files

**Schema**:
- `packages/prisma/schema.prisma`

**Backend**:
- `apps/api/src/cycles/services/cycle-line.service.ts`
- `apps/api/src/market/services/pricing.service.ts`
- `apps/api/src/cycles/dto/update-bulk-sell-prices.dto.ts`

**Frontend**:
- `apps/web/app/tradecraft/admin/sell-appraiser/page.tsx`

**Scripts**:
- `apps/api/scripts/backfill-listed-units.ts`

**Types**:
- `packages/shared/src/types/index.ts`

