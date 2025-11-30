# Planner Consolidation Fix

## Issue
When creating a planner with items dispersed across multiple packages going to the same destination, committing the plan would create duplicate cycle lines instead of consolidating them.

**Example Scenario:**
- Package 1: 10 missiles → Destination X
- Package 2: 5 missiles → Destination X
- Result: 2 separate cycle lines (one with 10 units, one with 5 units) ❌

**Expected Behavior:**
- Result: 1 consolidated cycle line with 15 units ✅

## Root Cause
In `apps/api/src/market/services/arbitrage.service.ts`, the `commitPlan` method was checking for existing cycle lines **within the loop** while processing each package. The problem was:

1. Package 1's items were added to a `lines` array to be created later
2. Package 2's items (same type+destination) would also be added to the array
3. When `createMany` was called, it created duplicate cycle lines

The check for existing lines only looked at the database, not at the pending items in the `lines` array.

## Solution
The fix consolidates items **before** any database operations:

### Step 1: Consolidate
```typescript
const consolidatedItems = new Map<
  string,
  { typeId: number; destinationStationId: number; units: number }
>();

for (const pkg of plan.packages ?? []) {
  const dst = pkg.destinationStationId;
  for (const it of pkg.items ?? []) {
    const key = `${it.typeId}-${dst}`;
    const existing = consolidatedItems.get(key);
    if (existing) {
      existing.units += it.units;  // Accumulate units
    } else {
      consolidatedItems.set(key, {
        typeId: it.typeId,
        destinationStationId: dst,
        units: it.units,
      });
    }
  }
}
```

### Step 2: Process Consolidated Items
```typescript
for (const item of consolidatedItems.values()) {
  const existing = await tx.cycleLine.findFirst({
    where: {
      cycleId: currentOpen.id,
      typeId: item.typeId,
      destinationStationId: item.destinationStationId,
    },
  });

  if (existing) {
    // Update existing line
    await tx.cycleLine.update({
      where: { id: existing.id },
      data: { plannedUnits: existing.plannedUnits + item.units },
    });
  } else {
    // Create new line
    linesToCreate.push({
      cycleId: currentOpen.id,
      typeId: item.typeId,
      destinationStationId: item.destinationStationId,
      plannedUnits: item.units,
    });
  }
}
```

## Benefits
1. **No Duplicate Lines**: Guarantees one cycle line per unique `typeId + destinationStationId` combination
2. **Cleaner Data**: Makes cycle accounting and reporting more accurate
3. **Better Performance**: Fewer database operations and cleaner queries
4. **Correct Totals**: Total planned units reflect the actual consolidated amount

## Testing
To verify the fix works:

1. Create a planner at `/tradecraft/admin/planner`
2. Generate a plan where items are split across multiple packages going to the same destination
3. Commit the plan
4. Check the cycle lines at `/tradecraft/admin/cycles/[cycleId]/lines`
5. Verify that each item+destination combination has only ONE cycle line with the correct total units

## Files Modified
- `apps/api/src/market/services/arbitrage.service.ts` - `commitPlan()` method

## Date
November 14, 2024

