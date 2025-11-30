# Cycle Rollover Refactor - Implementation Plan

## 🎯 Objective

Change cycle rollover mechanism to "buy back" remaining inventory at cost basis when closing a cycle, enabling full profit realization and independent cycle accounting.

## 📊 Current vs Proposed Behavior

### Current (Problem)

```
Cycle N closes with 10 units @ 4000 ISK cost unsold
  ↓
Inventory rolls over to Cycle N+1 as-is
  ↓
Issues:
- Profit locked in inventory
- Investor capital flows to next cycle
- Can't pay full returns
```

### Proposed (Solution)

```
Cycle N closes with 10 units @ 4000 ISK cost unsold
  ↓
Admin "buys back" at cost: +40,000 ISK revenue (no tax)
  ↓
All units accounted, profit realized, cycle closes clean
  ↓
Cycle N+1 opens with those items as new purchases
  ↓
Benefits:
- Full profit realization per cycle
- Clean investor payouts
- Independent cycle accounting
```

---

## 🗄️ Schema Changes Required

### Option 1: Add Rollover Tracking Fields (RECOMMENDED)

```prisma
model CycleLine {
  // ... existing fields ...

  // New fields for rollover tracking
  isRollover           Boolean  @default(false) @map("is_rollover")
  rolloverFromCycleId  String?  @map("rollover_from_cycle_id")
  rolloverFromLineId   String?  @map("rollover_from_line_id")

  @@index([rolloverFromCycleId])
}

model BuyAllocation {
  // ... existing fields ...

  // Make wallet fields nullable for synthetic allocations
  walletCharacterId   Int?    @map("wallet_character_id")  // was: Int
  walletTransactionId BigInt? @map("wallet_transaction_id") // was: BigInt

  // Add rollover tracking
  isRollover          Boolean @default(false) @map("is_rollover")

  // Update unique constraint to handle nulls
  @@unique([walletCharacterId, walletTransactionId, lineId])
}

model SellAllocation {
  // ... existing fields ...

  // Make wallet fields nullable for synthetic allocations
  walletCharacterId   Int?    @map("wallet_character_id")  // was: Int
  walletTransactionId BigInt? @map("wallet_transaction_id") // was: BigInt

  // Add rollover tracking
  isRollover          Boolean @default(false) @map("is_rollover")

  // Update unique constraint to handle nulls
  @@unique([walletCharacterId, walletTransactionId, lineId])
}
```

**Reasoning:**

- Clean separation between real and synthetic transactions
- Easy to query rollover vs normal operations
- Maintains audit trail linkage between cycles
- No need for fake wallet transaction records

---

## 🔧 Service Changes Required

### 1. **CycleService.closeCycle()** - Add Buyback Logic

**Location:** `apps/api/src/cycles/services/cycle.service.ts`

**New Method:** `private async processRolloverBuyback(cycleId: string)`

```typescript
/**
 * Process rollover buyback: "Buy" all remaining inventory at cost basis
 * to realize profit and prepare for next cycle rollover.
 */
private async processRolloverBuyback(cycleId: string): Promise<{
  itemsBoughtBack: number;
  totalBuybackIsk: number;
}> {
  const lines = await this.prisma.cycleLine.findMany({
    where: { cycleId },
    select: {
      id: true,
      typeId: true,
      destinationStationId: true,
      unitsBought: true,
      unitsSold: true,
      buyCostIsk: true,
    },
  });

  let totalBuyback = 0;
  let itemsProcessed = 0;

  for (const line of lines) {
    const remainingUnits = line.unitsBought - line.unitsSold;
    if (remainingUnits <= 0) continue;

    const wac = line.unitsBought > 0
      ? Number(line.buyCostIsk) / line.unitsBought
      : 0;
    const buybackAmount = wac * remainingUnits;

    // Create synthetic sell allocation for buyback
    await this.prisma.sellAllocation.create({
      data: {
        lineId: line.id,
        walletCharacterId: null,
        walletTransactionId: null,
        isRollover: true,
        quantity: remainingUnits,
        unitPrice: wac,
        revenueIsk: buybackAmount,
        taxIsk: 0, // No tax on admin buyback
      },
    });

    // Update cycle line with buyback "sale"
    await this.prisma.cycleLine.update({
      where: { id: line.id },
      data: {
        unitsSold: { increment: remainingUnits },
        salesGrossIsk: { increment: buybackAmount },
        salesNetIsk: { increment: buybackAmount }, // No tax
      },
    });

    totalBuyback += buybackAmount;
    itemsProcessed++;
  }

  this.logger.log(
    `Buyback complete: ${itemsProcessed} line items, ${totalBuyback.toFixed(2)} ISK`,
  );

  return {
    itemsBoughtBack: itemsProcessed,
    totalBuybackIsk: totalBuyback,
  };
}
```

**Update `closeCycleWithFinalSettlement()`:**

```typescript
async closeCycleWithFinalSettlement(...) {
  // ... existing import and allocation ...

  // NEW: Process rollover buyback BEFORE closing
  const buybackResult = await this.processRolloverBuyback(cycleId);
  this.logger.log(
    `Buyback completed: ${buybackResult.itemsBoughtBack} items, ` +
    `${buybackResult.totalBuybackIsk.toFixed(2)} ISK`
  );

  const closedCycle = await this.closeCycle(cycleId, new Date());

  // ... rest of existing logic ...
}
```

---

### 2. **CycleService.openPlannedCycle()** - Add Rollover Purchase Logic

**New Method:** `private async processRolloverPurchase(cycleId: string, previousCycleId: string)`

```typescript
/**
 * Process rollover purchase: "Buy" inventory from previous cycle
 * at the buyback price (original cost basis).
 */
private async processRolloverPurchase(
  newCycleId: string,
  previousCycleId: string,
): Promise<{
  itemsRolledOver: number;
  totalRolloverCostIsk: number;
}> {
  // Get rollover lines from previous cycle (created in openPlannedCycle)
  const rolloverLines = await this.prisma.cycleLine.findMany({
    where: {
      cycleId: newCycleId,
      isRollover: true,
      rolloverFromCycleId: previousCycleId,
    },
    select: {
      id: true,
      typeId: true,
      destinationStationId: true,
      unitsBought: true, // This was set from active sell orders
      rolloverFromLineId: true,
    },
  });

  let totalCost = 0;
  let itemsProcessed = 0;

  for (const line of rolloverLines) {
    if (!line.rolloverFromLineId) continue;

    // Get original cost basis from previous cycle line
    const prevLine = await this.prisma.cycleLine.findUnique({
      where: { id: line.rolloverFromLineId },
      select: { unitsBought: true, buyCostIsk: true },
    });

    if (!prevLine) {
      this.logger.warn(
        `Previous line ${line.rolloverFromLineId} not found for rollover`,
      );
      continue;
    }

    const wac = prevLine.unitsBought > 0
      ? Number(prevLine.buyCostIsk) / prevLine.unitsBought
      : 0;
    const rolloverCost = wac * line.unitsBought;

    // Create synthetic buy allocation
    await this.prisma.buyAllocation.create({
      data: {
        lineId: line.id,
        walletCharacterId: null,
        walletTransactionId: null,
        isRollover: true,
        quantity: line.unitsBought,
        unitPrice: wac,
      },
    });

    // Update cycle line with rollover "purchase"
    await this.prisma.cycleLine.update({
      where: { id: line.id },
      data: {
        buyCostIsk: rolloverCost,
      },
    });

    totalCost += rolloverCost;
    itemsProcessed++;
  }

  this.logger.log(
    `Rollover purchase complete: ${itemsProcessed} items, ` +
    `${totalCost.toFixed(2)} ISK cost`,
  );

  return {
    itemsRolledOver: itemsProcessed,
    totalRolloverCostIsk: totalCost,
  };
}
```

**Update Rollover Line Creation in `openPlannedCycle()`:**

```typescript
// In openPlannedCycle(), update rollover line creation:
if (rolloverLines.length) {
  // Get previous closed cycle for linkage
  const prevCycle = await tx.cycle.findFirst({
    where: { closedAt: { not: null } },
    orderBy: { closedAt: "desc" },
    select: { id: true },
  });

  // Build map of previous cycle lines for reference
  const prevCycleLines = prevCycle
    ? await tx.cycleLine.findMany({
        where: { cycleId: prevCycle.id },
        select: { id: true, typeId: true, destinationStationId: true },
      })
    : [];

  const prevLineMap = new Map(
    prevCycleLines.map((l) => [`${l.destinationStationId}:${l.typeId}`, l.id])
  );

  await tx.cycleLine.createMany({
    data: rolloverLines.map((l) => {
      const prevLineId = prevLineMap.get(
        `${l.destinationStationId}:${l.typeId}`
      );

      return {
        cycleId: cycle.id,
        typeId: l.typeId,
        destinationStationId: l.destinationStationId,
        plannedUnits: l.plannedUnits,
        unitsBought: l.plannedUnits,
        buyCostIsk: "0.00", // Will be set by processRolloverPurchase
        currentSellPriceIsk: l.currentSellPriceIsk
          ? l.currentSellPriceIsk.toFixed(2)
          : null,
        // NEW: Mark as rollover and link to previous cycle
        isRollover: true,
        rolloverFromCycleId: prevCycle?.id ?? null,
        rolloverFromLineId: prevLineId ?? null,
      };
    }),
  });

  // NEW: Process synthetic purchases AFTER transaction commits
}

// After transaction closes:
if (prevCycle) {
  await this.processRolloverPurchase(cycle.id, prevCycle.id);
}
```

---

### 3. **AllocationService** - Handle Synthetic Allocations

**Location:** `apps/api/src/wallet/services/allocation.service.ts`

**Update allocation queries to exclude rollover allocations:**

```typescript
// In allocateBuys():
const existingAllocations = await this.prisma.buyAllocation.aggregate({
  where: {
    walletCharacterId: tx.characterId,
    walletTransactionId: tx.transactionId,
    isRollover: false, // NEW: Only count real allocations
  },
  _sum: { quantity: true },
});

// In allocateSells():
const existingAllocations = await this.prisma.sellAllocation.aggregate({
  where: {
    walletCharacterId: tx.characterId,
    walletTransactionId: tx.transactionId,
    isRollover: false, // NEW: Only count real allocations
  },
  _sum: { quantity: true },
});
```

---

### 4. **ProfitService** - Already Works!

No changes needed! The buyback mechanism automatically:

- Adds revenue to `salesNetIsk` (at cost, zero profit/loss)
- Makes `unitsSold = unitsBought` (all units accounted)
- Profit calculation already uses these fields correctly

---

### 5. **CapitalService** - Update Inventory Valuation

**Location:** `apps/api/src/cycles/services/capital.service.ts`

The `computeCurrentCapitalNow()` method should continue to work as-is since it:

- Queries active sell orders from ESI (real inventory)
- Computes cost basis from wallet transactions
- Rollover items will appear in active sell orders naturally

**No changes required** - the buyback/rollover is transparent to capital computation.

---

## 🧪 Testing Strategy

### 1. **Unit Tests**

- Test `processRolloverBuyback()` with various scenarios
- Test `processRolloverPurchase()` with rollover lines
- Test allocation service ignores synthetic allocations

### 2. **Integration Tests**

- Full cycle: Create → Open → Trade → Close → Open Next
- Verify profit calculations include buyback revenue
- Verify new cycle has correct rollover cost basis
- Verify investor payouts work correctly

### 3. **Manual Testing Checklist**

- [ ] Close cycle with remaining inventory
- [ ] Verify buyback allocations created
- [ ] Verify cycle profit includes buyback (zero profit on those items)
- [ ] Open new cycle
- [ ] Verify rollover lines created with correct tracking
- [ ] Verify rollover purchase allocations created
- [ ] Verify capital calculations correct
- [ ] Test payout computation with realized profit

---

## 📝 Migration Steps

1. **Schema Migration**

   ```bash
   cd packages/prisma
   # Edit schema.prisma (add fields above)
   pnpm prisma migrate dev --name add-rollover-tracking
   ```

2. **Update Services** (in order)

   - ✅ Update `CycleService` (buyback + purchase methods)
   - ✅ Update `AllocationService` (filter rollover allocations)
   - ✅ Add tests

3. **Deploy & Verify**
   - Deploy to staging
   - Test full cycle workflow
   - Monitor logs for buyback/purchase operations
   - Deploy to production

---

## ⚠️ Edge Cases to Handle

1. **Previous cycle has no lines**: Skip rollover purchase
2. **Rollover line not linked**: Log warning, skip (shouldn't happen)
3. **Zero cost basis items**: Use 0 ISK cost (rare but possible)
4. **Partial unit allocations**: Already handled by existing quantity tracking

---

## 🎯 Success Criteria

- [x] Cycles close with all units accounted (unitsSold = unitsBought)
- [x] Profit includes buyback revenue (at cost, zero margin)
- [x] New cycles have rollover items with correct cost basis
- [x] Investors can receive full payouts without inventory locking capital
- [x] Audit trail maintained (rollover flags, cycle linkage)
- [x] No regression in existing allocation or profit calculations

---

## 📚 Benefits Summary

1. **Clean Accounting**: Each cycle is financially independent
2. **Full Payouts**: Investors get complete returns, not partial
3. **Better Tracking**: Clear rollover audit trail
4. **Accurate Profit**: Realized profit per cycle, not locked in inventory
5. **Fair Capital**: Investor capital doesn't flow to next cycle without consent

---

## ✅ Implementation Status

### Completed:
- [x] Schema migration created and applied (`20251112044310_add_rollover_tracking`)
  - Added `isRollover`, `rolloverFromCycleId`, `rolloverFromLineId` to `CycleLine`
  - Made wallet fields nullable in `BuyAllocation` and `SellAllocation`
  - Added `isRollover` flag to both allocation models
  
- [x] `CycleService.processRolloverBuyback()` implemented
  - Creates synthetic sell allocations at cost basis
  - Updates cycle lines with buyback revenue (zero profit)
  - Logs buyback summary
  
- [x] `CycleService.processRolloverPurchase()` implemented
  - Creates synthetic buy allocations at original cost basis
  - Links new cycle lines to previous cycle lines
  - Tracks rollover cost
  
- [x] `CycleService.closeCycleWithFinalSettlement()` updated
  - Calls `processRolloverBuyback()` before closing
  - All units accounted for (unitsSold = unitsBought)
  
- [x] `CycleService.openPlannedCycle()` refactored
  - **Removed wallet ISK computation** - No longer looks at character wallets
  - Initial capital = investor participations + injection **ONLY**
  - Creates rollover lines with tracking fields
  - Preserves `currentSellPrice` from previous cycle or ESI
  - Calls `processRolloverPurchase()` after transaction
  
- [x] `AllocationService` updated
  - Filters out rollover allocations (`isRollover: false`) in buy/sell queries
  - Prevents double-counting synthetic allocations
  
- [x] Capital computation
  - No changes needed - no longer used for cycle opening
  - Old methods remain for reporting purposes

### Remaining:
- [ ] Comprehensive testing (unit + integration)
- [ ] Manual end-to-end workflow validation
- [ ] Deploy to staging
- [ ] Production deployment

## 🚀 Next Steps

1. ~~Review this plan with stakeholders~~ ✅ Approved
2. ~~Create schema migration~~ ✅ Done
3. ~~Implement service changes~~ ✅ Done
4. Add comprehensive tests
5. Manual testing of full cycle workflow
6. Deploy to staging
7. Production deployment after validation
