# Estimated Profit Calculation Fix

## Issue
The "Estimated Profit" displayed on the `/tradecraft/cycle-details` page was calculated incorrectly:

1. **Double-subtracted sales tax** - Sales tax was subtracted from gross revenue to get net revenue, then subtracted again as "estimatedFees"
2. **Missing cost basis** - Did not account for the weighted average cost (WAC) of remaining inventory units
3. **Misleading breakdown** - Per-line `currentProfit` in the breakdown subtracted entire `buyCostIsk` instead of just COGS for sold units

## Solution

### Updated Formula
**Estimated Total Profit = Current Realized Profit + Σ(Additional Profit from Remaining Inventory)**

Where for each line:
- **WAC (Weighted Average Cost)** = buyCostIsk / unitsBought
- **Remaining Units** = unitsBought - unitsSold
- **Additional Profit** = remainingUnits × (currentSellPrice × (1 - salesTaxPct) - WAC)

This correctly accounts for:
- Cost basis of remaining inventory (WAC × remainingUnits)
- Sales tax on future sales (applied once, not double-counted)
- Already-paid broker/relist fees (not re-applied to remaining inventory)

### Example Calculation

Given a line with:
- 100 units bought at 1,000,000 ISK total (10,000 ISK/unit WAC)
- 40 units sold generating 600,000 ISK net revenue
- 10,000 ISK broker fees + 5,000 ISK relist fees
- 60 units remaining
- Current sell price: 18,000 ISK/unit
- Sales tax: 5%

**Current Realized Profit:**
```
= SalesNet - COGS - BrokerFees - RelistFees
= 600,000 - (10,000 × 40) - 10,000 - 5,000
= 600,000 - 400,000 - 10,000 - 5,000
= 185,000 ISK
```

**Estimated Additional Profit:**
```
Gross Revenue = 60 × 18,000 = 1,080,000 ISK
Sales Tax = 1,080,000 × 0.05 = 54,000 ISK
Net Revenue = 1,080,000 - 54,000 = 1,026,000 ISK
Cost Basis = 60 × 10,000 = 600,000 ISK
Additional Profit = 1,026,000 - 600,000 = 426,000 ISK
```

**Total Estimated Profit:**
```
= 185,000 + 426,000 = 611,000 ISK
```

Or per remaining unit:
```
= 18,000 × (1 - 0.05) - 10,000
= 17,100 - 10,000
= 7,100 ISK per unit × 60 units = 426,000 ISK
```

## Files Changed

### `apps/api/src/cycles/services/profit.service.ts`
- Updated `computeEstimatedProfit()` method to:
  1. Calculate WAC and COGS for each line
  2. Fix `currentLineProfit` to use COGS instead of total `buyCostIsk`
  3. Compute `estimatedAdditionalProfit` = netRevenue - costBasis (where costBasis = WAC × remainingUnits)
  4. Sum `totalAdditionalProfit` and add to `currentProfit` for final `estimatedTotalProfit`
- Updated service documentation to reflect corrected formula

## Testing

The fix was verified with:
1. ✅ TypeScript compilation successful
2. ✅ No linter errors
3. ✅ Manual calculation test passed
4. ✅ Formula matches accounting principles

## Impact

- **Frontend**: No changes required - the UI already displays `cycle.profit.estimated` from the API
- **API**: Backend calculation now correctly represents potential profit if all inventory sells at current prices
- **Accuracy**: Users will now see realistic estimated profit that accounts for:
  - Actual cost of goods (not inflated by counting unsold inventory costs)
  - Proper tax treatment (sales tax applied once, not twice)
  - True margin on remaining inventory

## Date
November 16, 2025

