# Consolidating Duplicate Cycle Lines - Production Fix Guide

## Problem

Due to the planner bug (now fixed), duplicate cycle lines were created in production with the same `cycleId`, `typeId`, and `destinationStationId`. When using the Sell-Appraiser feature, selecting one item would select all duplicates, causing broker fees to be multiplied by the number of duplicates.

**Example:**
- 116,162 Mjolnir Rage Rockets split into 3 cycle lines
- When listed in Sell-Appraiser, broker fees were charged 3x
- Database shows 3 separate cycle lines with the same item/destination

## Solution

The `consolidate-duplicate-cycle-lines.ts` script will:

1. **Find duplicate groups** - Cycle lines with same `cycleId`, `typeId`, and `destinationStationId`
2. **Consolidate into one line** - Keep the oldest line as the primary
3. **Sum quantities and costs**:
   - `plannedUnits`, `unitsBought`, `buyCostIsk`
   - `unitsSold`, `salesGrossIsk`, `salesTaxIsk`, `salesNetIsk`
   - `relistFeesIsk`
4. **Fix broker fees** - Divide total by duplicate count (undoes the multiplication)
5. **Migrate related records**:
   - `BuyAllocation` - Move to primary line
   - `SellAllocation` - Move to primary line
   - `PackageCycleLine` - Update package links
6. **Delete duplicate lines** - Clean up the database

## Usage

### Step 1: Dry Run (Preview)

First, run in preview mode to see what will be consolidated:

```bash
cd apps/api
npx tsx scripts/consolidate-duplicate-cycle-lines.ts
```

This will show:
- Number of duplicate groups found
- Item names and stations affected
- Current values and consolidated values
- No changes will be made to the database

### Step 2: Review Output

Example output:
```
Found 15 groups with duplicate cycle lines:

1. Mjolnir Rage Rocket → Station 60008494
   Cycle: 766b1910...
   Duplicate Count: 3 lines
   Primary Line ID: e8357cf0...
   Duplicate Line IDs: 23521db9..., af3112e3...
   Consolidated Values:
     - plannedUnits: 38700 + 38700 + 38762 = 116162
     - unitsSold: 38700 + 38700 + 38762 = 116162
     - brokerFeesIsk: (325834.41 + 325834.41 + 325834.41) / 3 = 325834.41 ISK
```

### Step 3: Execute Consolidation

If the preview looks correct, run with `--execute`:

```bash
npx tsx scripts/consolidate-duplicate-cycle-lines.ts --execute
```

### Optional: Consolidate Specific Cycle

To consolidate only a specific cycle:

```bash
# Dry run for specific cycle
npx tsx scripts/consolidate-duplicate-cycle-lines.ts --cycle-id=766b1910-639e-477a-86f0-378a1cbcbc59

# Execute for specific cycle
npx tsx scripts/consolidate-duplicate-cycle-lines.ts --cycle-id=766b1910-639e-477a-86f0-378a1cbcbc59 --execute
```

## What Gets Consolidated

### Fields That Are Summed
- `plannedUnits` - Total planned across all duplicates
- `unitsBought` - Total bought
- `buyCostIsk` - Total cost
- `unitsSold` - Total sold
- `salesGrossIsk` - Total gross sales
- `salesTaxIsk` - Total sales tax
- `salesNetIsk` - Total net sales
- `relistFeesIsk` - Total relist fees

### Fields That Are Fixed
- `brokerFeesIsk` - **Divided by duplicate count** (fixes the multiplication bug)

### Fields That Are Preserved
- `currentSellPriceIsk` - Found from whichever line has a non-null value (only one will have the price)
- `isRollover` - Kept from first line (all will be `false` since bug doesn't affect rollover lines)
- `rolloverFromCycleId` - Kept from first line (all will be `null`)
- `rolloverFromLineId` - Kept from first line (all will be `null`)

### Related Records That Are Migrated
- **BuyAllocations** - Moved to primary line, duplicates are merged
- **SellAllocations** - Moved to primary line, duplicates are merged
- **PackageCycleLines** - Updated to reference primary line

## Safety Features

1. **Transaction-based** - All operations in a single transaction, rolls back on error
2. **Dry run by default** - Must explicitly use `--execute` flag
3. **Duplicate detection** - Merges related records if they already exist on primary
4. **Oldest line kept** - Primary line is always the oldest (first created)

## Verification After Running

After consolidation, verify:

1. **Check cycle lines count**:
   ```sql
   SELECT cycleId, typeId, destinationStationId, COUNT(*) as count
   FROM cycle_lines
   GROUP BY cycleId, typeId, destinationStationId
   HAVING COUNT(*) > 1;
   ```
   Should return 0 rows.

2. **Check broker fees** - Should match actual in-game fees, not multiplied

3. **Check totals** - Verify that `unitsSold` matches actual quantities sold

4. **Check Sell-Appraiser** - Items should now appear only once

## Example: Mjolnir Rage Rocket Case

**Before Consolidation:**
- Line 1: 38,700 units, 325,834.41 ISK broker fees
- Line 2: 38,700 units, 325,834.41 ISK broker fees
- Line 3: 38,762 units, 325,834.41 ISK broker fees
- **Total broker fees recorded: 977,503.23 ISK** ❌

**After Consolidation:**
- Line 1 (consolidated): 116,162 units, **325,834.41 ISK broker fees** ✅
- Lines 2 & 3: Deleted
- **Total broker fees recorded: 325,834.41 ISK** (matches in-game)

## Files Created

- `apps/api/scripts/consolidate-duplicate-cycle-lines.ts` - The consolidation script

## Related Documentation

- `docs/PLANNER_CONSOLIDATION_FIX.md` - Fix for the root cause bug
- `apps/api/src/market/services/arbitrage.service.ts` - Fixed `commitPlan()` method

## Date
November 14, 2024

