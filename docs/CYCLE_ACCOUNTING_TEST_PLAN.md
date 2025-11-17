# 🧪 Test Checklist - Refactored Cycle Accounting System

## Prerequisites Setup

- [x] At least 2 LOGISTICS characters linked:
  - [x] 1 BUYER character (e.g., for Jita purchases)
  - [x] 1 SELLER character (e.g., for Dodixie/Hek sales)
- [x] Characters have `location` set in database (match their home station)
- [x] Backend server running (`cd apps/api && npm run start:dev`)
- [x] Frontend server running (`cd apps/web && npm run dev`)
- [x] Database is accessible and migrated to latest schema

### ⚠️ Known Frontend Issues (RESOLVED)

✅ **Fixed Issues**:

- Sell Appraiser and Undercut Checker now use `cycleId` instead of `planCommitId`
- `/api/pricing/confirm-listing` and `/api/pricing/confirm-reprice` routes now pass auth headers correctly
- `/api/jobs/wallets/run` now bypasses `ENABLE_JOBS` check for manual triggers

**New pages** (may require component installation):

- `/arbitrage/cycles/[cycleId]/lines` - Needs `alert-dialog` component
- `/arbitrage/cycles/[cycleId]/profit` - Needs `alert-dialog` component

---

## 1️⃣ Cycle Creation & Planning

**Location**: `/arbitrage/cycles`

### Create New Cycle

- [x] Click "Create New Cycle" button
- [x] Enter cycle name (e.g., "Test Cycle Oct 15")
- [x] Select start date/time
- [x] Optionally enter initial injection amount (e.g., "1000000000" for 1B ISK)
- [x] Click "Create" → Success message appears
- [x] New cycle appears in "Current Cycle" or "Planned Cycles" section

### Verify Cycle Display

- [x] Cycle shows correct name, start date, status ("Planned" or "Open")
- [x] If initial injection entered, shows correct capital amount
- [x] "Manage Lines" link is visible
- [x] "View Profit" link is visible

---

## 2️⃣ Participation Management (Investor Opt-In)

**Location**: `/arbitrage/cycles/opt-in` (investor view) and `/arbitrage/admin/participations` (admin view)

### Investor Opt-In to Next Cycle

**Location**: `/arbitrage/cycles/opt-in`

- [x] Navigate to opt-in page
- [x] See next cycle information (if planned cycle exists)
- [x] Enter investment amount (e.g., "500000000" for 500M ISK)
- [x] Optionally enter character name for tracking
- [x] Click "Opt-In" → Participation created with status "pending"
- [x] System displays:
  - [x] Payment instructions
  - [x] Designated character to send ISK to
  - [x] Required memo (contains participation ID)
  - [x] Amount to send

### Send ISK In-Game

- [x] Log in to EVE Online
- [x] Send ISK to designated character
- [x] **Critical**: Use exact memo provided (e.g., "cycle-participation-abc123")
- [x] Send exact amount committed

### Admin: Validate Participation

**Location**: `/arbitrage/admin/participations`

- [x] Navigate to participations admin page
- [x] See list of pending participations
- [x] Click "Validate" or "Match Journal" button
- [x] System searches wallet journal for matching:
  - [x] Amount (matches participation amount)
  - [x] Memo (matches participation ID)
  - [x] Transaction date (recent)
- [x] If match found:
  - [x] Participation status → "validated"
  - [x] `validatedAt` timestamp set
  - [x] `walletJournalId` linked
- [x] If no match:
  - [x] Shows error/warning
  - [x] Manual validation option available

### Verify Participation

**Method 1 - Frontend**:
**Location**: `/arbitrage/cycles` or user dashboard

- [x] See "My Participation" section
- [x] Shows investment amount
- [x] Shows status (pending/validated)
- [x] Shows estimated payout (if cycle is running)

---

## 3️⃣ Arbitrage Planning

**Location**: `/arbitrage/admin/planner`

### Plan Buy Opportunities

- [x] Edit JSON payload or use quick params to configure:
  - [x] Package capacity (m³)
  - [x] Investment ISK
  - [x] Max packages
  - [x] Per-item share
  - [x] Shipping costs by station
- [x] Click "Run planner" → Loading indicator appears
- [x] Results show grouped by destination station:
  - [x] Overview with total spend, gross profit, shipping, net profit
  - [x] Packages per destination
  - [x] Aggregated items list per destination
  - [x] Copyable item list (name\tquantity format)

### Commit Plan to Cycle

- [x] Optionally enter commit memo
- [x] Click "Commit plan" button
- [x] System creates `CycleLine` records from the plan
- [x] Alert shows: "Plan committed: [commit-id]"
- [x] Items saved as `CycleLine` records linked to current cycle

---

## 4️⃣ Cycle Lines Management

**Location**: `/arbitrage/admin/lines` (ADMIN-ONLY PAGE)

### View Cycle Lines

**Note**: This page requires the `alert-dialog` component to be installed first:

```bash
cd apps/web && npx shadcn@latest add alert-dialog
```

- [x] Navigate via "Manage Lines" link in admin sidebar (under Cycles)
- [x] Page automatically loads latest open cycle (or most recent if none open)
- [x] Can optionally override with query parameter: `/arbitrage/admin/lines?cycleId=your-cycle-id`
- [x] Page shows which cycle is being used (first 8 characters of cycle ID)
- [x] See list of all planned items for the cycle
- [x] Each line shows:
  - [x] Item type name
  - [x] Destination station name
  - [x] Planned units
  - [x] Units bought (initially 0)
  - [x] Units sold (initially 0)
  - [x] Units remaining (calculated)
  - [x] Buy cost ISK
  - [x] Sales revenue ISK
  - [x] Broker fees ISK
  - [x] Relist fees ISK

---

## 5️⃣ Buying Phase

**Location**: In-game EVE Online + Admin triggers

### Execute Buys In-Game

- [x] Log in to BUYER character in-game
- [x] Navigate to Jita (or source station)
- [x] Buy items from cycle lines using market orders
- [x] Note: Buys can be partial (multiple orders for same item)

### Import Wallet Transactions

**Location**: `/arbitrage/admin/triggers`

- [x] Navigate to "Wallets" tab
- [x] Set "Days back" parameter (e.g., 15)
- [x] Click "Import Wallets" button with refresh icon
- [x] Toast shows "Importing wallet transactions..."
- [x] After completion, success message with count
- [x] Verify in backend console/logs that transactions imported

### Run Buy Allocation

**Location**: `/arbitrage/admin/triggers` → "Jobs" tab

- [x] Look for "Run Wallets" button (imports + allocates)
- [x] Click button → System:
  1. Imports latest wallet transactions
  2. Runs allocation for buys
  3. Runs allocation for sells
- [x] Check backend logs for allocation results:
  - [x] Number of buy transactions allocated
  - [x] Number of cycle lines updated
  - [x] Any errors or unmatched transactions

### Verify Buy Allocations

**Method 1 - Frontend** (if lines page is working):
**Location**: `/arbitrage/cycles/[cycleId]/lines`

- [x] Return to cycle lines page
- [x] Verify `Units Bought` increased for affected lines
- [x] Verify `Buy Cost ISK` updated with total cost
- [x] Check `Units Remaining` = `Planned Units` initially (since nothing sold yet)

## 6️⃣ Transport & Listing Phase

### Transport Items

- [x] Move items in-game from source to destination station (manual, out-of-game via contract service)
- [x] **Important**: Contract tracking is NOT currently working from ESI
- [x] **Important**: No automatic way to match transport contracts to cycles

### Record Broker Fees (Initial Listing)

**Location**: `/arbitrage/admin/sell-appraiser`

**Why manual tracking matters**: Broker fees (1.5%) are charged when you CREATE the sell order, NOT when items sell. If you list at 100 ISK but later sell at 90 ISK, the broker fee was still based on 100 ISK. This is why we can't infer broker fees from sell transactions.

**Workflow**:

- [x] Navigate to `/arbitrage/admin/sell-appraiser`
- [x] Check "Use latest open commit" (should auto-load current cycle)
- [x] Click "Appraise" → System fetches remaining inventory and suggests prices
- [x] Review suggested prices (based on current market lowest sell)
- [x] Check items you're listing
- [x] List items in-game at the suggested prices
- [x] Return to appraiser page
- [x] Click "Confirm Listed" → Records 1.5% broker fee for selected items

---

## 7️⃣ Selling Phase

### Execute Sells In-Game

- [x] Log in to SELLER character in-game
- [x] Items sell gradually via market orders at destination station
- [x] Note: Multiple partial sales may occur
- [x] **Important**: Seller character's `location` in database MUST match the destination station for sells to allocate correctly

### Import Wallet Transactions & Run Allocation

**Location**: `/arbitrage/admin/triggers` → "Jobs" tab

- [x] Click "Run Wallets" button (same as buy phase)
- [x] System automatically:
  1. Imports latest wallet transactions (buys AND sells)
  2. Runs buy allocation
  3. Runs sell allocation
- [x] Check backend logs for results

---

## 7️⃣.5️⃣ Price Management & Relist Fees

**Location**: `/arbitrage/admin/undercut-checker`

**📘 See [UNDERCUT_CHECKER_GUIDE.md](./UNDERCUT_CHECKER_GUIDE.md) for detailed features and best practices.**

### Check for Undercuts

**Why this matters**: Competitors may list items cheaper than you. The undercut checker identifies your orders that need price updates to remain competitive.

**Workflow**:

- [x] Navigate to `/arbitrage/admin/undercut-checker`
- [x] Configure:
  - [x] Check "Use latest open commit" (auto-loads current cycle for profitability tracking)
  - [x] Select **Grouping Mode** (Per Character recommended - reduces duplicate orders)
- [x] Click "Run Check" → System compares your sell orders vs market
- [x] Results grouped by character and station with intelligent filtering:
  - [x] Only shows orders where competitor volume is significant (15% of original order volume)
  - [x] Groups duplicate orders per item (shows only primary order with most volume)
  - [x] Auto-deselects loss-making reprices (red highlight with ⚠️ warning icon)
- [x] Each row shows:
  - [x] Warning indicator (⚠️) if reprice would result in a loss
  - [x] Item name
  - [x] Remaining quantity
  - [x] Your current price
  - [x] Competitor's lowest price (filtered by volume threshold)
  - [x] Suggested new price (0.01 ISK cheaper, with tick rounding)
  - [x] **Calculated relist fee** (0.3% of new order value)
  - [x] **Copy button** for one-click price copying
- [x] Hover over rows to see estimated margin % and profit after reprice
- [x] Total relist fee shown at bottom for selected items

### Record Relist Fees

- [x] Review suggested prices and relist fees
- [x] Loss-making items are pre-deselected - check them only if intentional
- [x] Select items you want to reprice (checkboxes)
- [x] Use copy buttons to quickly copy suggested prices
- [x] Update prices in-game to match suggested prices
- [x] Return to undercut checker page
- [x] Click "Confirm Repriced" → Records 0.3% relist fee for selected items

**Important**: Relist fees are 0.3% of the NEW order value (remaining quantity × new price), NOT the original listing price. This is why the undercut checker calculates and displays them.

**Note**: The frontend currently uses `planCommitId` but backend expects cycle-based parameters. The API endpoints need updating to match new system.

````

## 8️⃣ Profit Calculation & Snapshots

**Location**: `/arbitrage/cycles/[cycleId]/profit` (NEW PAGE - may need component installation)

### View Cycle Profit Breakdown

**Note**: This page requires the same frontend fixes as the lines page.

**Method 1 - Frontend** (if profit page is working):

- [x] Navigate via "View Profit" link from `/arbitrage/cycles`
- [x] See overall profit summary with all fees and net profit

### Create Manual Snapshot

**Using API**:

```bash
POST /api/ledger/cycles/{cycleId}/snapshot
````

Snapshot includes:

- [x] Current wallet cash balance
- [x] Current inventory value (WAC-based)
- [x] Current cycle profit
- [x] Timestamp

### View Snapshots

**Using API**:

```bash
GET /api/ledger/cycles/{cycleId}/snapshots
```

- [x] Returns list of all snapshots ordered by time
- [x] Each shows: `walletCashIsk`, `inventoryIsk`, `cycleProfitIsk`, `snapshotAt`
- [x] Can compare progression over time

---

## 9️⃣ Closing Cycle

**Location**: `/arbitrage/cycles` or `/arbitrage/admin/cycles`

### Close Cycle

**Note**: The UI for closing cycles is in the admin section.

**Location**: `/arbitrage/admin/cycles`

- [x] Find the current open cycle
- [x] Click close/end cycle action
- [x] Confirm → Cycle status changes to "Closed"
- [x] `closedAt` timestamp set

### Verify Final State

- [x] Check cycle via API: `GET /api/ledger/cycles/{cycleId}`
- [x] Verify `closedAt` is set
- [ ] Get final profit: `GET /api/ledger/cycles/{cycleId}/profit`
- [ ] All cycle lines show final units bought/sold
- [ ] Transport fees accounted for
- [ ] System ready for payout calculation (if participations exist)

---

## 🔟 Payout Calculation & Distribution

**Location**: `/arbitrage/admin/participations` or API

### Calculate Payouts

**Prerequisites**:

- [ ] Cycle is closed (`closedAt` is set)
- [ ] All participations validated
- [ ] Final profit calculated

**Payout Formula**:

1. **Pool size** = Cycle profit × pool % (e.g., 50% goes to investors)
2. **Each investor's share** = (Their investment / Total investments) × Pool
3. **Payout** = Investment + Share of profit

### Verify Payout Calculations

**Example scenario**:

- Cycle profit: 1,000,000,000 ISK (1B)
- Pool %: 50%
- Pool available: 500,000,000 ISK (500M)
- Investor A: invested 300M (60% of 500M total)
- Investor B: invested 200M (40% of 500M total)

**Expected payouts**:

- Investor A: 300M + (500M × 0.6) = 300M + 300M = **600M** (100% return)
- Investor B: 200M + (500M × 0.4) = 200M + 200M = **400M** (100% return)

**Verification checklist**:

- [ ] Verify math matches expected
- [ ] Verify all validated investors included
- [ ] Verify investment percentages sum to 100%
- [ ] Verify total payouts ≤ Total investments + Pool

### Record Payout Decisions

**Location**: Admin UI or API

Once payouts calculated and verified:

```bash
POST /api/ledger/cycles/{cycleId}/participations/{participationId}/payout
Body: {
  "payoutAmountIsk": "600000000",
  "memo": "Cycle profit payout - 100% return"
}
```

- [ ] Updates participation with `payoutAmountIsk`
- [ ] Creates ledger entry for payout
- [ ] Can mark as "paid" once ISK sent

### Send Payouts In-Game

- [ ] Log in to EVE Online with designated character
- [ ] For each validated participation:
  - [ ] Send calculated payout amount
  - [ ] Include memo (e.g., "Cycle [name] payout - [return]% return")
  - [ ] Send to investor character specified in participation

### Mark Payouts as Paid

**Location**: `/arbitrage/admin/participations`

- [ ] Find each participation
- [ ] Click "Mark as Paid" or similar action
- [ ] `payoutPaidAt` timestamp set
- [ ] Status → "completed"

**Alternative - API**:

```bash
PATCH /api/ledger/cycles/{cycleId}/participations/{participationId}
Body: { "payoutPaidAt": "2025-10-15T23:59:59Z" }
```

### Verify Complete Payout Cycle

**Database verification**:

```sql
-- Check all participations paid
SELECT
  cp.id,
  cp.amount_isk,
  cp.payout_amount_isk,
  cp.status,
  cp.payout_paid_at,
  (cp.payout_amount_isk - cp.amount_isk) / cp.amount_isk * 100 as return_pct
FROM cycle_participations cp
WHERE cp.cycle_id = 'your-cycle-id';
```

- [ ] All participations have `payout_amount_isk` set
- [ ] All have `payout_paid_at` timestamp
- [ ] Return % is consistent across investors (proportional to pool share)
- [ ] Total payouts match expected pool distribution

**Cycle ledger verification**:

```sql
-- Check ledger balance
SELECT
  entry_type,
  COUNT(*) as count,
  SUM(amount::numeric) as total_isk
FROM cycle_ledger
WHERE cycle_id = 'your-cycle-id'
GROUP BY entry_type
ORDER BY entry_type;
```

- [ ] "deposit" entries = total investor investments
- [ ] "payout" entries = total payouts sent
- [ ] Difference = operator's profit share

---

## 1️⃣1️⃣ Edge Cases & Error Handling

### Multiple Buys for Same Line

- [ ] Buy same item multiple times (partial orders)
- [ ] Import transactions
- [ ] Run allocation
- [ ] Verify all buys aggregated correctly on same line
- [ ] `unitsBought` = sum of all buy quantities
- [ ] `buyCostIsk` = sum of all buy costs

### Sells to Wrong Destination

- [ ] SELLER character sells item at wrong station
- [ ] Run sell allocation
- [ ] System should:
  - [ ] Not match to any cycle line (destination mismatch)
  - [ ] Log unmatched transaction
  - [ ] Show warning in allocation results

### Manual Allocation Fixes

- [ ] If auto-allocation fails or mismatches
- [ ] Can manually adjust cycle line values:
  - [ ] Edit `unitsBought` or `unitsSold`
  - [ ] Edit cost/revenue amounts
  - [ ] Add manual fee entries

### Concurrent Cycles

- [ ] Create multiple cycles (one open, one planned)
- [ ] Ensure buy/sell allocations only affect correct cycle
- [ ] Verify lines are isolated per cycle

### Zero-Profit or Loss Scenarios

- [ ] Create cycle with intentionally bad arbitrage
- [ ] Execute buys/sells at a loss
- [ ] Verify profit calculation shows negative value
- [ ] System handles negative profit correctly
- [ ] Verify payouts still return principal to investors (loss absorbed by operator)

### Multiple Participations per Cycle

- [ ] Create cycle with 3+ different investors
- [ ] Validate all participations
- [ ] Close cycle and calculate payouts
- [ ] Verify each investor gets correct proportional share
- [ ] Verify total payouts = sum of individual payouts

### Late/Invalid Participation

- [ ] Investor opts in but never sends ISK
- [ ] Participation remains "pending"
- [ ] Close cycle
- [ ] Verify pending participations excluded from payout
- [ ] Only validated participations receive payouts

### Wrong Memo or Amount

- [ ] Investor sends ISK with wrong memo
- [ ] Auto-validation fails
- [ ] Admin manually validates with correct journal entry
- [ ] Participation status → "validated"
- [ ] Payout calculation includes corrected participation

### Partial ISK Transfer

- [ ] Investor commits 500M but only sends 300M
- [ ] Auto-validation fails (amount mismatch)
- [ ] Admin options:
  - [ ] Reject participation (refund)
  - [ ] Adjust participation amount to 300M
  - [ ] Wait for investor to send remaining 200M
- [ ] Verify chosen action works correctly

---

## 1️⃣2️⃣ Automated Job Testing

**Location**: `/arbitrage/admin/triggers` → "Jobs" tab + Backend logs

### Manual Job Triggers

**Location**: `/arbitrage/admin/triggers`

- [ ] Navigate to "Jobs" tab
- [ ] See available job triggers:
  - [ ] "Run Wallets" - Imports transactions + runs allocation
  - [ ] "Run Market Import" - Updates market data
  - [ ] Other admin jobs

### Wallet Import + Allocation Job

- [ ] Click "Run Wallets" button in Jobs tab
- [ ] Or wait for scheduled job (check `apps/api/src/jobs/jobs.service.ts` for schedule)
- [ ] Check backend logs for:
  - [ ] "Running wallet imports for [X] characters"
  - [ ] Transaction counts imported
  - [ ] "Running allocation for cycle [ID]"
  - [ ] Allocation results (buys/sells matched)
  - [ ] Any unmatched transactions
  - [ ] Any errors fetching from ESI

### Snapshot Job

- [ ] Runs automatically on schedule (see `JobsService.snapshotOpenCycles`)
- [ ] Check backend logs for:
  - [ ] "Creating snapshot for open cycles"
  - [ ] Snapshot data (cash, inventory, profit)
- [ ] Verify snapshots saved to database:
  ```sql
  SELECT * FROM cycle_snapshots ORDER BY snapshot_at DESC LIMIT 10;
  ```

---

## 1️⃣3️⃣ API Endpoint Testing

**Using Postman, Thunder Client, or curl**

### Cycle Lines API

```bash
# List cycle lines
GET /api/ledger/cycles/{cycleId}/lines

# Create cycle line
POST /api/ledger/cycles/{cycleId}/lines
Body: { "typeId": 34, "destinationStationId": 60011866, "plannedUnits": 100 }

# Update cycle line
PATCH /api/ledger/cycles/lines/{lineId}
Body: { "plannedUnits": 150 }

# Delete cycle line
DELETE /api/ledger/cycles/lines/{lineId}
```

### Fee API

```bash
# Add broker fee
POST /api/ledger/cycles/lines/{lineId}/broker-fee
Body: { "amountIsk": "150000" }

# Add relist fee
POST /api/ledger/cycles/lines/{lineId}/relist-fee
Body: { "amountIsk": "30000" }

# Add transport fee
POST /api/ledger/cycles/{cycleId}/transport-fee
Body: { "amountIsk": "50000000", "memo": "PushX contract" }

# List transport fees
GET /api/ledger/cycles/{cycleId}/transport-fees
```

### Profit & Snapshot API

```bash
# Get cycle profit
GET /api/ledger/cycles/{cycleId}/profit

# Create snapshot
POST /api/ledger/cycles/{cycleId}/snapshot

# List snapshots
GET /api/ledger/cycles/{cycleId}/snapshots
```

### Allocation API

```bash
# Run allocation for all or specific cycle
POST /api/recon/reconcile?cycleId={cycleId}
```

---

## 1️⃣4️⃣ Database Verification

**Using PostgreSQL client or Prisma Studio**

### Check CycleLine Records

```sql
SELECT * FROM cycle_lines WHERE cycle_id = 'your-cycle-id';
```

- [ ] Verify `plannedUnits`, `unitsBought`, `unitsSold` are correct
- [ ] Verify cost/revenue amounts match expectations
- [ ] Verify fees tracked properly

### Check BuyAllocation Records

```sql
SELECT ba.*, wt.price, wt.quantity
FROM buy_allocations ba
JOIN wallet_transactions wt
  ON ba.wallet_character_id = wt.character_id
  AND ba.wallet_transaction_id = wt.transaction_id
WHERE ba.line_id = 'your-line-id';
```

- [ ] Each buy transaction has corresponding allocation
- [ ] Quantities and prices match

### Check SellAllocation Records

```sql
SELECT sa.*, wt.price, wt.quantity
FROM sell_allocations sa
JOIN wallet_transactions wt
  ON sa.wallet_character_id = wt.character_id
  AND sa.wallet_transaction_id = wt.transaction_id
WHERE sa.line_id = 'your-line-id';
```

- [ ] Each sell transaction has corresponding allocation
- [ ] Tax calculated correctly (3.37%)

### Check CycleFeeEvent Records

```sql
SELECT * FROM cycle_fee_events WHERE cycle_id = 'your-cycle-id';
```

- [ ] Transport fees recorded with correct amounts
- [ ] Memos captured correctly

### Check CycleSnapshot Records

```sql
SELECT * FROM cycle_snapshots
WHERE cycle_id = 'your-cycle-id'
ORDER BY snapshot_at DESC;
```

- [ ] Snapshots created at expected intervals
- [ ] Profit progression makes sense over time

### Verify Legacy Tables Removed

```sql
-- These should FAIL with "relation does not exist"
SELECT * FROM plan_commits;
SELECT * FROM plan_commit_lines;
```

- [ ] Confirm tables no longer exist

---

## 🎯 Full Lifecycle Happy Path

**End-to-End Complete Flow:**

### Phase 1: Setup & Planning

1. **✅ Create Cycle** → Status: Planned
2. **👥 Investor Opt-In** → Investors commit capital for next cycle
3. **💳 Validate Participations** → Match ISK transfers via wallet journal
4. **📋 Plan Arbitrage** → Items analyzed and committed as cycle lines

### Phase 2: Buying & Transport

5. **💰 Buy Items** → In-game purchases at source station (Jita)
6. **🔄 Import & Allocate Buys** → Transactions linked to cycle lines, WAC updated
7. **🚚 Transport Items** → Move to destination stations via contracts
8. **💸 Record Transport Fees** → Manually log contract costs per cycle

### Phase 3: Listing & Selling

9. **📝 List Items** → Create sell orders at destination, record broker fees (1.5%)
10. **💸 Sell Items** → In-game sales at destination stations
11. **🔄 Import & Allocate Sells** → Sales transactions linked, tax calculated (3.37%)
12. **🔍 Check Undercuts** → Identify competitor undercuts via undercut checker
13. **📊 Update Prices** → Relist orders at competitive prices, record relist fees (0.3%)

### Phase 4: Monitoring & Completion

14. **📈 Monitor Profit** → View real-time profit breakdown (line-level + cycle-level)
15. **📸 Snapshots** → Periodic performance captures (cash, inventory, profit)
16. **🏁 Close Cycle** → Status: Closed, final profit calculated
17. **🧮 Calculate Payouts** → Apply pool % (e.g., 50%), distribute proportionally
18. **💰 Send Payouts** → Transfer ISK to investors in-game
19. **✅ Cycle Complete!** → All investors paid, ready for next cycle

---

## 📊 Expected Results Summary

### System Should Handle:

- ✅ Multiple partial buys aggregating to cycle lines
- ✅ Sells matched by type + destination location
- ✅ Automatic tax calculation (3.37%)
- ✅ Broker fees tracked per line (1.5%)
- ✅ Relist fees tracked per line (0.3%)
- ✅ Transport fees tracked per cycle
- ✅ WAC (Weighted Average Cost) inventory valuation
- ✅ Profit calculation at line and cycle level
- ✅ Snapshot history for performance tracking
- ✅ Investor participations with deposit tracking
- ✅ Participation validation via wallet journal matching
- ✅ Proportional profit distribution to investors
- ✅ Payout calculation with configurable pool %
- ✅ Payout tracking and status management

### System Should NOT:

- ❌ Allow commits to wrong cycle model (legacy removed)
- ❌ Track execution entries in CycleLedgerEntry (cash flows only now)
- ❌ Match sells without proper character location set
- ❌ Lose allocation data when re-running reconciliation
- ❌ Allow payout without validated participations
- ❌ Distribute more than pool % to investors

---

## 🐛 Common Issues & Troubleshooting

### Issue: Buys not allocating

- **Check**: Wallet transactions imported for buyer character?
- **Check**: Cycle has matching cycle lines (typeId matches)?
- **Fix**: Import transactions, ensure cycle lines exist

### Issue: Sells not allocating

- **Check**: Seller character has `location` set in database?
- **Check**: Location matches destination station on cycle line?
- **Fix**: Update character location, ensure destination matches

### Issue: Profit seems wrong

- **Check**: All fees recorded (broker, relist, transport)?
- **Check**: Verify buy cost and sales revenue amounts
- **Fix**: Manually add missing fees, check allocations

### Issue: Frontend build fails

- **Expected**: Missing `alert-dialog` component and `apiClient` import
- **Fix**:
  ```bash
  cd apps/web
  npx shadcn@latest add alert-dialog
  # Fix import in apps/web/app/api/cycles/lines.ts
  # Change: import { apiClient } from "@/lib/api-client";
  # To: import { fetchWithAuth } from "@/lib/api-client";
  ```

### Issue: Participation not validating

- **Check**: Wallet journal imported for receiving character?
- **Check**: Exact memo used in ISK transfer?
- **Check**: Amount matches exactly (no rounding errors)?
- **Fix**: Re-import journal, manually validate if needed

### Issue: Payout math doesn't add up

- **Check**: Is cycle closed and final profit calculated?
- **Check**: Are all fees included (broker, relist, transport)?
- **Check**: Is pool % configured correctly (e.g., 0.5 for 50%)?
- **Fix**: Verify profit calculation, recalculate payouts

### Issue: Some investors missing from payout

- **Check**: Are all participations validated (not just pending)?
- **Check**: Were they opted in before cycle closed?
- **Fix**: Validate pending participations, recalculate

---

## ✅ Test Completion Checklist

### Core Arbitrage Functionality

- [ ] All cycle creation tests pass
- [ ] All arbitrage planning tests pass
- [ ] All cycle line management tests pass
- [ ] All buy allocation tests pass
- [ ] All sell allocation tests pass
- [ ] All fee tracking tests pass (broker, relist, transport)
- [ ] All profit calculation tests pass
- [ ] All snapshot tests pass

### Investor Management

- [ ] Participation opt-in workflow tested
- [ ] Participation validation via wallet journal tested
- [ ] Payout calculation tested with multiple investors
- [ ] Payout distribution and tracking tested
- [ ] Edge cases for participations tested

### System Health

- [ ] All edge cases handled correctly
- [ ] All API endpoints respond correctly
- [ ] Database state verified
- [ ] Full lifecycle test completed successfully
- [ ] No legacy code references found
- [ ] Backend tests passing
- [ ] Frontend issues documented

### Production Readiness

- [ ] System ready for production arbitrage operations
- [ ] System ready for investor participation management
- [ ] Documentation complete and accurate

---

**Good luck with testing! 🚀**

_If you encounter any issues, check the logs in `apps/api` and refer to the troubleshooting section above._

---

_Generated: October 15, 2025_  
_Version: 1.0_
