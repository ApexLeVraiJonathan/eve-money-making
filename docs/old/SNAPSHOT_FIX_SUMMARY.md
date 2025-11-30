# Cycle Snapshot & Capital Display Fix

## Issue Summary

The cycle-details page was displaying incorrect capital distribution data in charts because the snapshot feature was using a flawed calculation that didn't properly account for cash vs inventory.

## Root Cause

The `SnapshotService.createCycleSnapshot()` method was calculating:

```typescript
// INCORRECT (old code)
walletCash = initialCapital + currentProfit;
```

This stored **total capital** in the `walletCashIsk` field, not actual cash. The frontend then added `walletCashIsk + inventoryIsk` to display total, effectively double-counting inventory.

### Why This Was Wrong

**Example scenario:**

- Start: 100M ISK
- Buy: 50M ISK of items (actual wallet now has 50M)
- Sell some for 60M ISK (10M profit, actual wallet now has 110M)
- Inventory remaining: 50M at cost

**Old calculation showed:**

- walletCashIsk = 100M + 10M = **110M ISK** (This is total capital, not cash!)
- inventoryIsk = 50M ISK
- Total displayed = 110M + 50M = **160M ISK** ❌ WRONG

**Correct values should be:**

- Total Capital = 100M + 10M = 110M ISK
- Inventory = 50M ISK
- Cash = 110M - 50M = **60M ISK** ✓ CORRECT
- Total = 60M + 50M = 110M ISK ✓ CORRECT

## Solution

Implemented the correct closed-loop accounting model:

### Accounting Formulas

```
Total Capital = Initial Capital + Net Profit
Inventory Value = Σ[(unitsBought - unitsSold) × (buyCostIsk / unitsBought)]
Cash = Total Capital - Inventory Value
```

Where **Net Profit** includes all expenses:

- Revenue (salesNetIsk)
- Less: Cost of Goods Sold (COGS)
- Less: Broker fees (per line)
- Less: Relist fees (per line)
- Less: Transport fees (cycle-level)
- Plus: Collateral recovery (cycle-level, negative fee)

### Files Changed

#### 1. `apps/api/src/cycles/services/snapshot.service.ts`

**Before:**

```typescript
// 3) Calculate cash position: Initial Capital + Realized Profit
const walletCash = initialCapital + currentProfit;

// 4) Compute inventory value using weighted-average cost (WAC)
const lines = await this.prisma.cycleLine.findMany(...);
let inventoryTotal = 0;
// ... calculate inventory ...

// Store snapshot
await this.prisma.cycleSnapshot.create({
  data: {
    walletCashIsk: walletCash.toFixed(2), // ❌ WRONG - storing total capital
    inventoryIsk: inventoryTotal.toFixed(2),
    cycleProfitIsk: profit.cycleProfitCash,
  },
});
```

**After:**

```typescript
// 3) Calculate total capital: Initial Capital + Net Profit
const totalCapital = initialCapital + currentProfit;

// 4) Compute inventory value using weighted-average cost (WAC)
const lines = await this.prisma.cycleLine.findMany(...);
let inventoryTotal = 0;
// ... calculate inventory ...

// 5) Calculate cash: Total Capital - Inventory
const walletCash = totalCapital - inventoryTotal;

// Store snapshot
await this.prisma.cycleSnapshot.create({
  data: {
    walletCashIsk: walletCash.toFixed(2), // ✓ CORRECT - storing actual cash
    inventoryIsk: inventoryTotal.toFixed(2),
    cycleProfitIsk: profit.cycleProfitCash,
  },
});
```

#### 2. `apps/api/src/cycles/services/cycle.service.ts`

The `getCycleOverview()` method was already using the correct formula (lines 1187-1190):

```typescript
// Portfolio = Starting Capital + Profit
const totalCapital = initial + currentProfit;
// Cash = Portfolio - Inventory
const cash = totalCapital - inventoryValue;
```

No changes needed here.

## Why This Approach is Correct

✅ **Closed-loop accounting** - Only tracks app-managed activities  
✅ **No ESI wallet queries** - Avoids external revenue/expense contamination  
✅ **Verifiable** - All numbers trace back to cycle lines and fees  
✅ **Conservation of capital** - Total = Cash + Inventory always balances

## Testing Instructions

### 1. Create a New Snapshot

For the current cycle, trigger a snapshot creation:

```bash
# Using the API endpoint
POST /ledger/cycles/{cycleId}/snapshot
```

Or via admin UI if available.

### 2. Verify Snapshot Data

Check the database:

```sql
SELECT
  snapshot_at,
  wallet_cash_isk,
  inventory_isk,
  cycle_profit_isk,
  (wallet_cash_isk + inventory_isk) as total_capital
FROM cycle_snapshots
WHERE cycle_id = 'YOUR_CYCLE_ID'
ORDER BY snapshot_at DESC
LIMIT 5;
```

**Expected:**

- `wallet_cash_isk` should be less than `cycle_profit_isk + initial_capital`
- `wallet_cash_isk + inventory_isk` should equal `initial_capital + cycle_profit_isk`

### 3. Check Frontend Displays

Navigate to `/tradecraft/cycle-details` and verify:

#### Capital Distribution Chart (Pie Chart)

- Should show reasonable cash/inventory split
- If all items are in inventory, cash should be small (not negative)
- If most items are sold, cash should be high

#### Capital Over Time Chart (Line Chart)

- Total (blue dashed line) = Cash (orange) + Inventory (brown)
- Total should approximately equal Initial Capital + Profit line
- Cash should increase as items sell
- Inventory should decrease as items sell

#### Realized Cash Profit Chart

- Should show profit progression over time
- Should match the "Current Profit" card value

### 4. Verify Calculations Manually

For a cycle with known data:

```sql
-- Get cycle details
SELECT
  id,
  initial_capital_isk,
  (SELECT SUM(sales_net_isk - ((buy_cost_isk / NULLIF(units_bought, 0)) * units_sold) - broker_fees_isk - relist_fees_isk)
   FROM cycle_lines WHERE cycle_id = c.id) as line_profit,
  (SELECT SUM(amount_isk) FROM cycle_fee_events WHERE cycle_id = c.id) as total_fees
FROM cycles c
WHERE id = 'YOUR_CYCLE_ID';

-- Get inventory value
SELECT
  SUM((units_bought - units_sold) * (buy_cost_isk / NULLIF(units_bought, 0))) as inventory_value
FROM cycle_lines
WHERE cycle_id = 'YOUR_CYCLE_ID'
  AND units_bought > units_sold;
```

Then verify:

- Net Profit = line_profit - total_fees
- Total Capital = initial_capital_isk + Net Profit
- Cash = Total Capital - inventory_value

### 5. Compare Old vs New Snapshots

If you have old snapshots in the database, compare them:

```sql
-- Old snapshots (incorrect)
SELECT * FROM cycle_snapshots
WHERE created_at < '2024-11-14'
ORDER BY snapshot_at DESC LIMIT 3;

-- New snapshots (correct)
SELECT * FROM cycle_snapshots
WHERE created_at >= '2024-11-14'
ORDER BY snapshot_at DESC LIMIT 3;
```

Old snapshots will show `walletCashIsk` values that are too high (equal to total capital).

## Impact

### What This Fixes

✅ Capital Distribution pie chart shows correct cash/inventory split  
✅ Capital Over Time chart displays accurate progression  
✅ Total capital calculations are consistent across all views  
✅ Snapshot data accurately represents system state

### What Remains Unchanged

- Profit calculations (already correct)
- Inventory valuation method (WAC - still correct)
- Fee tracking (already comprehensive)
- Frontend chart rendering logic (already correct)

## Future Considerations

### Data Migration (Optional)

If you want to fix old snapshot data:

```sql
-- This would require recalculating all historical snapshots
-- Not recommended unless historical accuracy is critical
-- The fix automatically applies to all new snapshots
```

### Monitoring

Watch for these indicators that the fix is working:

1. Cash values should be positive (unless heavy losses)
2. Cash + Inventory = Initial + Profit (conservation law)
3. Charts should show logical progression as items sell

## Related Files

- **Backend:**

  - `apps/api/src/cycles/services/snapshot.service.ts` - Fixed
  - `apps/api/src/cycles/services/cycle.service.ts` - Already correct
  - `apps/api/src/cycles/services/profit.service.ts` - Already correct

- **Frontend:**

  - `apps/web/app/tradecraft/cycle-details/page.tsx` - No changes needed
  - Charts automatically reflect corrected data

- **Database:**
  - `packages/prisma/schema.prisma` - Schema unchanged
  - `cycle_snapshots` table stores corrected values

## Summary

The fix ensures that the accounting system maintains a closed loop where all capital is accounted for correctly:

```
Initial Capital
    ↓
Buy Items → Inventory (at cost)
    ↓
Sell Items → Cash (revenue - fees)
    ↓
Total Capital = Cash + Inventory = Initial + Net Profit
```

This provides accurate, verifiable financial tracking without external dependencies.
