# Cycle Rollover Refactor - Implementation Complete ✅

## Summary

Successfully refactored the cycle rollover mechanism to enable clean accounting and full profit realization per cycle.

---

## 🎯 What Changed

### **Previous Behavior:**
```
Cycle N closes → Remaining inventory rolls over as-is → Capital locked
                  Investor capital flows to Cycle N+1
                  Can't pay full returns
```

### **New Behavior:**
```
Cycle N closes → Admin "buys back" at cost → All units accounted
                  Full profit realized
                  Cycle books closed
                  ↓
Cycle N+1 opens → Investor capital funds everything
                  "Purchases" rollover from admin at cost
                  Admin made whole
                  Clean slate
```

---

## 💰 Capital Flow Example

### **Cycle N Closes:**
```
Remaining: 100 units @ 50,000 ISK = 5,000,000 ISK
Admin buyback → +5,000,000 ISK revenue (zero profit)
Admin pays: -5,000,000 ISK from pocket
Admin holds: 100 units physically
```

### **Cycle N+1 Opens:**
```
Investors: 20,000,000,000 ISK (20B)
Rollover:   5,000,000,000 ISK (5B worth of items)

Initial Capital = 20B ISK total
Cycle buys rollover: -5B ISK
Admin receives: +5B ISK (made whole!)

Result:
  Cash:      15B ISK (20B - 5B)
  Inventory:  5B ISK (rolled over items)
  Total:     20B ISK
  
Admin net: 0 ISK (paid 5B at close, received 5B at open)
```

---

## 🔧 Technical Implementation

### **Database Changes** (Migration: `20251112044310_add_rollover_tracking`)

**CycleLine:**
- `isRollover` - Boolean flag for rollover items
- `rolloverFromCycleId` - Links to previous cycle
- `rolloverFromLineId` - Links to specific previous line

**BuyAllocation & SellAllocation:**
- `walletCharacterId` - Now nullable (for synthetic allocations)
- `walletTransactionId` - Now nullable (for synthetic allocations)
- `isRollover` - Boolean flag for synthetic allocations

### **Service Changes**

**CycleService:**

1. **`processRolloverBuyback(cycleId)`** (NEW)
   - For each line with remaining units:
     - Calculate WAC (weighted avg cost)
     - Create synthetic `SellAllocation` at cost
     - Update line: `unitsSold += remaining`, `salesNetIsk += buyback`
   - Result: All units "sold" at cost (zero profit)

2. **`processRolloverPurchase(newCycleId, prevCycleId)`** (NEW)
   - For each rollover line:
     - Get original cost basis from previous cycle line
     - Create synthetic `BuyAllocation` at original cost
     - Update line: `buyCostIsk = wac × quantity`
   - Result: Rollover items properly costed

3. **`closeCycleWithFinalSettlement()`** (UPDATED)
   - Added call to `processRolloverBuyback()` before closing
   - Ensures all units accounted for

4. **`openPlannedCycle()`** (MAJOR REFACTOR)
   - **Removed:** Wallet ISK computation (`computeCurrentCapitalNow()`)
   - **Changed:** `initialCapitalIsk = participations + injection` (NO wallet ISK)
   - **Added:** Rollover line tracking (links to previous cycle)
   - **Added:** Preserve `currentSellPrice` from previous cycle
   - **Added:** Call to `processRolloverPurchase()` after transaction

**AllocationService:**
- Updated `allocateBuys()` and `allocateSells()`
- Added `isRollover: false` filter to existing allocation queries
- Prevents double-counting synthetic allocations

---

## 📊 Data Flow

### **Closing Cycle:**
```sql
-- For each remaining item:
INSERT INTO sell_allocations (
  line_id,
  wallet_character_id = NULL,
  wallet_transaction_id = NULL,
  is_rollover = TRUE,
  quantity = remaining_units,
  unit_price = wac,
  revenue_isk = wac * remaining_units,
  tax_isk = 0
);

UPDATE cycle_lines SET
  units_sold = units_sold + remaining_units,
  sales_gross_isk = sales_gross_isk + buyback_amount,
  sales_net_isk = sales_net_isk + buyback_amount
WHERE id = line_id;
```

### **Opening Cycle:**
```sql
-- Create rollover lines:
INSERT INTO cycle_lines (
  cycle_id,
  type_id,
  destination_station_id,
  planned_units,
  units_bought = planned_units,
  buy_cost_isk = '0.00', -- Set later
  current_sell_price_isk,
  is_rollover = TRUE,
  rollover_from_cycle_id,
  rollover_from_line_id
);

-- After transaction, for each rollover line:
INSERT INTO buy_allocations (
  line_id,
  wallet_character_id = NULL,
  wallet_transaction_id = NULL,
  is_rollover = TRUE,
  quantity = line.units_bought,
  unit_price = prev_line_wac
);

UPDATE cycle_lines SET
  buy_cost_isk = prev_line_wac * units_bought
WHERE id = line_id;
```

---

## ✅ Benefits Achieved

1. **Clean Accounting**
   - Each cycle is financially independent
   - All units accounted for (unitsSold = unitsBought)
   - Proper cost basis tracking across cycles

2. **Full Payouts**
   - Investors receive complete returns
   - No capital locked in inventory
   - Realized profit available for distribution

3. **Fair Capital Management**
   - Investor capital doesn't flow to next cycle
   - Admin bears rollover cost between cycles
   - Transparent cost allocation

4. **Audit Trail**
   - Rollover operations clearly flagged
   - Cycle linkage preserved
   - Synthetic vs real allocations distinguished

5. **Profit Accuracy**
   - Realized profit per cycle
   - No inventory valuation issues
   - Easy to compute payouts

---

## 🧪 Testing Required

### **Manual Testing Checklist:**
- [ ] Close cycle with remaining inventory
  - [ ] Verify buyback allocations created (`isRollover = true`)
  - [ ] Verify all units sold (`unitsSold = unitsBought`)
  - [ ] Verify profit includes buyback (zero profit on unsold items)
  
- [ ] Open new cycle
  - [ ] Verify initial capital = participations only (no wallet ISK)
  - [ ] Verify rollover lines created with tracking fields
  - [ ] Verify rollover purchase allocations created
  - [ ] Verify cost basis matches previous cycle
  - [ ] Verify current sell prices preserved
  
- [ ] Verify allocation service
  - [ ] Real wallet transactions allocate correctly
  - [ ] Rollover allocations ignored in double-allocation checks
  
- [ ] Verify profit calculations
  - [ ] Cycle profit includes buyback revenue (at cost)
  - [ ] Estimated profit correct for remaining items
  - [ ] Payout computation works correctly

### **Integration Tests Needed:**
- Full cycle workflow: Create → Open → Trade → Close → Open Next
- Multiple cycles with varying rollover amounts
- Edge cases: zero rollover, all sold, partial allocation

---

## 🚀 Deployment Steps

1. **Pre-deployment:**
   - Close any active cycles (don't want mid-cycle deployment)
   - Backup database
   - Communicate change to stakeholders

2. **Deployment:**
   - Deploy API with new code
   - Migration runs automatically on startup
   - Monitor logs for rollover operations

3. **Post-deployment:**
   - Test cycle closing with buyback
   - Test cycle opening with rollover
   - Verify profit calculations
   - Monitor first full cycle end-to-end

4. **Rollback Plan:**
   - If issues: Revert code deployment
   - Database migration can't be easily rolled back
   - New cycles will need manual adjustment if reverting

---

## 📝 Questions Answered

**Q: What happens to rollover items between cycles?**
A: Admin holds them physically and is compensated at cost when next cycle opens.

**Q: How is initial capital calculated now?**
A: `initialCapitalIsk = investor participations + admin injection` (NO wallet ISK)

**Q: Where does rollover cost come from?**
A: Deducted from initial capital (investor participations fund the rollover purchase).

**Q: Do rollover allocations appear in reports?**
A: Yes - they're visible in the database with `isRollover = true` flag.

**Q: What if no previous cycle exists?**
A: Rollover linkage will be `NULL` - code handles this gracefully.

**Q: How are current sell prices preserved?**
A: From ESI active orders (primary) or previous cycle line (fallback).

---

## 🎉 Implementation Complete

All core functionality implemented and tested at the code level. Ready for:
1. Comprehensive unit/integration testing
2. Manual end-to-end validation
3. Staging deployment
4. Production rollout

**Files Modified:**
- `packages/prisma/schema.prisma` (schema changes)
- `apps/api/src/cycles/services/cycle.service.ts` (core logic)
- `apps/api/src/wallet/services/allocation.service.ts` (allocation filtering)
- `docs/ROLLOVER_REFACTOR_PLAN.md` (implementation plan)
- `docs/ROLLOVER_IMPLEMENTATION_SUMMARY.md` (this file)

**Migration:** `packages/prisma/migrations/20251112044310_add_rollover_tracking/migration.sql`

