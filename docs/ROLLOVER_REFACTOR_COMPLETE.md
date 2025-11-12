# Rollover Refactor - Complete ✅

## Overview
Successfully implemented a new cycle rollover mechanism that ensures financial independence between cycles and fair investor payouts.

## Problem Solved
**Old System:**
- Unsold inventory rolled over directly to next cycle
- Profit locked in unsold items
- Investor capital carried over to cycles they didn't participate in
- Made profit calculation and payouts difficult

**New System:**
- Admin "buys back" unsold items at cost when cycle closes
- All profit realized at cycle end
- Next cycle purchases rollover items from admin
- Each cycle financially independent

## Implementation Details

### Schema Changes
Added rollover tracking fields to:
- **CycleLine**: `isRollover`, `rolloverFromCycleId`, `rolloverFromLineId`
- **BuyAllocation**: `isRollover`, nullable `walletCharacterId` and `walletTransactionId`
- **SellAllocation**: `isRollover`, nullable `walletCharacterId` and `walletTransactionId`

### Service Changes

#### CycleService
1. **`processRolloverBuyback(cycleId)`**
   - Called during `closeCycleWithFinalSettlement()`
   - Creates synthetic `SellAllocation` for remaining inventory
   - Uses weighted average cost (WAC) from `buyCostIsk / unitsBought`
   - Marks allocations with `isRollover: true`

2. **`processRolloverPurchase(newCycleId, previousCycleId)`**
   - Called after `openPlannedCycle()`
   - Creates synthetic `BuyAllocation` for rollover lines
   - Uses WAC from the newly created cycle line
   - Deducts rollover cost from cycle's `initialCapitalIsk`

3. **`openPlannedCycle()` - Major Refactor**
   - **Removed**: Wallet ISK computation from capital calculation
   - **Initial Capital**: Now ONLY from investor participations + explicit injections
   - **Rollover Lines**: Created with `buyCostIsk` from:
     - Previous cycle's WAC (if available), OR
     - Jita cheapest sell order (ESI fallback)
   - **Performance Optimization**:
     - ESI calls done outside transaction
     - Jita prices fetched in parallel using `Promise.all`
     - Single `createMany` for all cycle lines
   - **Capital Deduction**: Rollover cost explicitly deducted from `initialCapitalIsk`

4. **`fetchJitaCheapestSell(typeId)` - New Method**
   - Fetches cheapest sell order from Jita (The Forge, station 60003760)
   - Used as fallback when item has no recorded `buyCostIsk`
   - Ensures all rollover lines have proper cost basis

#### AllocationService
- `allocateBuys()` and `allocateSells()` now filter with `isRollover: false`
- Synthetic rollover allocations don't interfere with real wallet allocations

### Flow

**Cycle Close (Buyback):**
1. Admin "buys" remaining inventory at original cost
2. Synthetic `SellAllocation` created with `isRollover: true`
3. `unitsSold` updated on `CycleLine`
4. All profit realized for the cycle

**Cycle Open (Purchase):**
1. Previous cycle's rollover items identified
2. New `CycleLine`s created with `isRollover: true`
3. `buyCostIsk` set from previous cycle's WAC or Jita price
4. Synthetic `BuyAllocation` created for each line
5. Rollover cost deducted from `initialCapitalIsk`
6. Capital effectively "returned" to admin

### Capital Flow Example
```
Cycle 1 Close:
- 20B invested
- 17B sold for 19B (2B profit)
- 3B unsold inventory → Admin "buys back" at 3B cost
- Total profit: 2B (fully realized)

Cycle 2 Open:
- 20B new participations
- 3B rollover items purchased from admin
- Initial capital: 20B
- 3B allocated to rollover purchase (reduces available cash)
- Final state: 17B cash, 3B inventory (rollover items)
```

## Testing

### E2E Test Script
Created `apps/api/scripts/e2e-rollover-test.ts`:
- Fully API-driven workflow
- Tests two complete cycles
- Verifies rollover mechanics
- Checks capital breakdown (cash vs inventory)
- Validates profit calculation
- **Interactive pauses** at key points for frontend UI verification

**Key Test Steps:**
1. Create & open Cycle 1 with Jita-priced items
2. Create fake sell transactions (partial sales)
3. Import wallet data and allocate
4. Verify capital breakdown before close
5. Close Cycle 1 (admin buyback)
6. Create & open Cycle 2
7. Verify rollover lines reference Cycle 1
8. Verify capital correctly adjusted for rollover

**Interactive Pauses:**
The test script pauses at 5 key points, allowing you to:
- Check cycle lines in the frontend
- Verify capital breakdown (cash vs inventory)
- Inspect profit calculations after close
- Review rollover line linkage
- Confirm capital adjustments

Simply press ENTER at each pause to continue.

### Manual Testing
Guide available in `docs/ROLLOVER_TESTING_GUIDE.md`

## Benefits

1. **Accurate Profit Tracking**: Profit fully realized each cycle
2. **Fair to Investors**: No capital spillover to next cycle
3. **Clear Financial State**: Each cycle independently auditable
4. **Flexible Payouts**: Can pay investors immediately after cycle close
5. **Admin Accountability**: Rollover items properly tracked as admin's inventory

## Performance

- ESI calls parallelized (O(1) time for all Jita prices)
- Single batch insert for cycle lines (O(1) database operations)
- Transaction optimized (minimal database writes)

## Deployment Notes

1. Run migration: `pnpm --filter @eve-mm/prisma migrate deploy`
2. Regenerate Prisma client: `pnpm --filter @eve-mm/prisma generate`
3. Test in development first
4. **First production cycle after deployment**: Items without buy costs will use Jita prices

## Related Files

- `apps/api/src/cycles/services/cycle.service.ts` - Core logic
- `apps/api/src/wallet/services/allocation.service.ts` - Allocation filtering
- `apps/api/src/esi/market-helpers.ts` - ESI market data
- `packages/prisma/schema.prisma` - Schema changes
- `apps/api/scripts/e2e-rollover-test.ts` - E2E test
- `docs/ROLLOVER_TESTING_GUIDE.md` - Testing guide
- `docs/ROLLOVER_REFACTOR_PLAN.md` - Original plan

## Status: ✅ COMPLETE

All implementation, testing infrastructure, and documentation complete.
Ready for user testing with E2E test script.
