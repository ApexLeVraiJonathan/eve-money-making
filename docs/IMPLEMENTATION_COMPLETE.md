# Cycle Accounting Refactor - Implementation Complete

## Summary

Successfully refactored the cycle, commit, transaction, and ledger logic to a simplified, cash-only accounting system. The new system treats wallet transactions as the canonical source of truth and computes fees deterministically.

## What Was Implemented

### 1. Database Schema (Prisma)

**New Models:**

- `CycleLine`: Buy commitment lines per item per destination
- `BuyAllocation`: Links wallet buy transactions to cycle lines
- `SellAllocation`: Links wallet sell transactions to cycle lines
- `CycleFeeEvent`: Cycle-level fees (transport, etc.)
- `CycleSnapshot`: Periodic snapshots of cash, inventory, and profit

**Migration:** `20251015024241_add_cycle_lines_allocations_snapshots`

All models include proper indexes, cascading deletes, and relationships.

### 2. Backend Services

#### AllocationService (`apps/api/src/reconciliation/allocation.service.ts`)

New service handling:

- **Buy allocation**: FIFO top-to-bottom across cycle lines of same type
- **Sell allocation**: Match by character location → destination, FIFO
- **Sales tax calculation**: 3.37% of revenue on each sell
- **Unmatched transaction tracking**: Reports unallocated buys/sells

#### LedgerService Updates (`apps/api/src/ledger/ledger.service.ts`)

New methods:

- `createCycleLine()` - Create buy commitment line
- `listCycleLines()` - List lines with enriched data (type names, station names, profit)
- `updateCycleLine()` - Update planned units
- `deleteCycleLine()` - Delete line and allocations
- `addBrokerFee()` - Record broker fee (1.5%)
- `addRelistFee()` - Record relist fee (0.3%)
- `addTransportFee()` - Record transport fee (cycle-level)
- `listTransportFees()` - List all transport fees for a cycle
- `computeCycleProfit()` - Calculate cash-only profit with line breakdown
- `createCycleSnapshot()` - Create snapshot of current cycle state
- `getCycleSnapshots()` - Retrieve historical snapshots

**Removed:**

- Synthetic opening balance execution entries in `openPlannedCycle()`

### 3. Backend Controllers

#### LedgerController Updates (`apps/api/src/ledger/ledger.controller.ts`)

New endpoints:

- `POST /ledger/cycles/:cycleId/lines` - Create cycle line
- `GET /ledger/cycles/:cycleId/lines` - List cycle lines
- `PATCH /ledger/lines/:lineId` - Update cycle line
- `DELETE /ledger/lines/:lineId` - Delete cycle line
- `POST /ledger/lines/:lineId/broker-fee` - Add broker fee
- `POST /ledger/lines/:lineId/relist-fee` - Add relist fee
- `POST /ledger/cycles/:cycleId/transport-fee` - Add transport fee
- `GET /ledger/cycles/:cycleId/transport-fees` - List transport fees
- `GET /ledger/cycles/:cycleId/profit` - Get cycle profit
- `POST /ledger/cycles/:cycleId/snapshot` - Create snapshot
- `GET /ledger/cycles/:cycleId/snapshots` - Get snapshots

#### ReconciliationController Updates (`apps/api/src/reconciliation/reconciliation.controller.ts`)

- Updated `POST /recon/reconcile` to use `AllocationService.allocateAll()` instead of old reconciliation logic

### 4. Jobs Service Updates (`apps/api/src/jobs/jobs.service.ts`)

**Updated hourly job:**

- Renamed `runWalletImportsAndReconcile()` → `runWalletImportsAndAllocation()`
- Now runs allocation instead of old reconciliation
- Automatically creates snapshots for all open cycles after allocation

### 5. Frontend API Client (`apps/web/app/api/`)

**New files:**

- `cycles/lines.ts` - Full API client for cycle lines, fees, profit, snapshots
- `recon/allocation.ts` - API client for running allocation

**Types defined:**

- `CycleLine` - Line with all fields including computed values
- `CreateCycleLineRequest` / `UpdateCycleLineRequest`
- `TransportFee`
- `CycleProfit` - Profit breakdown with line details
- `CycleSnapshot`
- `AllocationResult` - Allocation statistics

### 6. Frontend Pages (`apps/web/app/arbitrage/cycles/`)

**New pages:**

1. **`[cycleId]/lines/page.tsx`** - Cycle Lines Management

   - View all cycle lines in a table
   - Create new lines (type ID, destination, planned units)
   - Add broker/relist fees via dialogs
   - Delete lines with confirmation
   - Shows live data: planned, bought, sold, remaining, costs, fees, profit

2. **`[cycleId]/profit/page.tsx`** - Cycle Profit View
   - Summary cards: line profit, transport fees, net cash profit
   - Line-by-line profit breakdown table
   - Transport fees history table

**Updated pages:**

- `page.tsx` - Added "Manage lines" and "View profit" links to current cycle section

### 7. Environment Variables

**Added to `env.example.md`:**

```bash
DEFAULT_SALES_TAX_PCT=3.37
DEFAULT_BROKER_FEE_PCT=1.5
DEFAULT_RELIST_FEE_PCT=0.3
WALLET_RESERVE_PER_CHAR=100000000
```

### 8. Documentation

**New docs:**

- `CYCLE_ACCOUNTING_REFACTOR.md` - Comprehensive guide to the new system
- `IMPLEMENTATION_COMPLETE.md` - This file

### 9. Tests

**New test file:**

- `apps/api/test/allocation.spec.ts` - Unit tests for AllocationService
  - Buy allocation FIFO
  - Sell allocation by character location
  - Tax calculation verification

## Key Design Decisions

1. **No inventory in NAV for payouts**: Inventory rolls over but doesn't count toward investor payouts
2. **Fixed fee percentages**: Eliminates ambiguity of matching ESI journal entries to transactions
3. **Character location → destination mapping**: Sells matched via `EveCharacter.location` field
4. **FIFO allocation**: Simple, predictable, and fair
5. **Cycle-scoped transport fees**: Reduces cycle profit but not tied to specific items
6. **CycleLedgerEntry restricted**: Now only for deposits/withdrawals/payouts, not executions

## What Was Changed

### Removed

- Synthetic opening balance execution entries
- Complex time-window-based reconciliation
- Execution entries in `cycle_ledger`

### Kept (but repurposed)

- `PlanCommit` / `PlanCommitLine` - Can be used informally for planning, not for accounting
- `CycleLedgerEntry` - Now only for investor cash flows (deposits, withdrawals, payouts)
- `computeCurrentCapitalNow()` - Still exists for UI insight (includes inventory), but not used for payouts

## Migration Path

### For Existing Cycles

- Old cycles remain intact with their historical ledger entries
- Can continue viewing them using old logic

### For New Cycles

1. Create cycle as normal
2. Create `CycleLine` records for each item+destination commitment
3. Import wallet transactions (hourly job)
4. Run allocation (automatic via hourly job)
5. Record broker/relist/transport fees as they occur
6. View profit via new profit endpoint
7. Close cycle using cash-only profit for payouts

## Verification Checklist

- [x] Schema updated with new models
- [x] Migration created and applied
- [x] Prisma client generated
- [x] AllocationService implemented
- [x] LedgerService methods added
- [x] Controllers updated with new endpoints
- [x] Jobs service updated
- [x] Frontend API client created
- [x] Frontend pages created
- [x] Environment variables documented
- [x] Comprehensive documentation written
- [x] Unit tests created
- [x] Backend compiles successfully
- [x] No linter errors

## Next Steps

### Testing

1. **Manual testing:**

   - Create a new cycle
   - Create cycle lines for test items
   - Import wallet transactions
   - Run allocation manually via API
   - Verify line totals match transactions
   - Add fees and verify profit calculations

2. **E2E tests:**
   - Write full cycle flow test
   - Test buy allocation across multiple lines
   - Test sell matching by character location
   - Test fee accumulation

### Future Enhancements

1. **Auto-fee calculation:**

   - Hook Sell Appraiser "confirm" to auto-POST broker fee
   - Hook Undercut Checker "confirm" to auto-POST relist fee

2. **UI improvements:**

   - Real-time allocation status indicators
   - Visual profit charts using snapshot data
   - Export cycle reports (CSV, PDF)

3. **Advanced features:**
   - Support multiple source stations (Jita, Perimeter)
   - Character-specific fee rates (standings/skills)
   - Bulk line creation from arbitrage results
   - Profit projections based on open orders

## Rollout Plan

1. **Phase 1 (Current)**: Backend + basic frontend in place
2. **Phase 2**: Manual testing with real data
3. **Phase 3**: E2E tests + bug fixes
4. **Phase 4**: Production deployment
5. **Phase 5**: Deprecate old reconciliation logic

## Support

For questions or issues, refer to:

- `docs/CYCLE_ACCOUNTING_REFACTOR.md` - Detailed system documentation
- `cycle.plan.md` - Original implementation plan
- Source code comments in services/controllers

## Conclusion

The refactor successfully simplifies the accounting system while maintaining accuracy and adding transparency. The new system is:

- **Simpler**: Single source of truth, deterministic fees
- **Faster**: FIFO allocation vs. complex reconciliation
- **Clearer**: Explicit line-level and cycle-level profit
- **More accurate**: Fixed percentages eliminate ambiguity
- **Scalable**: Grows linearly with transaction volume

All acceptance criteria from the original plan have been met. ✅
