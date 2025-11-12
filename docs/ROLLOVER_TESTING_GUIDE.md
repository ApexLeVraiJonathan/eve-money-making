# Rollover Testing Guide

## 🎯 Testing Objective

Validate that the rollover refactor works correctly end-to-end:

1. Cycle closes with unsold inventory → Admin buyback at cost
2. New cycle opens → Rollover purchase from admin at cost
3. All accounting is correct (zero profit on rollover, correct cost basis)

---

## 🛠️ Setup

### Prerequisites

- Dev database running
- API server running locally
- Logistics character configured in database

### Helper Script

Created: `apps/api/scripts/test-rollover-setup.ts`

Commands:

```bash
# Show instructions
pnpm exec ts-node scripts/test-rollover-setup.ts help

# Clean all cycles
pnpm exec ts-node scripts/test-rollover-setup.ts clean

# Create fake donation
pnpm exec ts-node scripts/test-rollover-setup.ts create-donation --characterId 123456 --amount 5000000000 --reason "ARB-12345678"

# Create fake trades
pnpm exec ts-node scripts/test-rollover-setup.ts create-trades --cycleId <cycle-id> --lineId <line-id> --characterId 123456 --typeId 34 --stationId 60003760 --buyUnits 100 --buyPrice 50000 --sellUnits 60 --sellPrice 55000
```

**Note:** Use `pnpm exec ts-node` instead of `pnpm tsx` to avoid Prisma client type compatibility issues.

---

## 📋 Test Procedure

### Step 1: Clean Slate

```bash
cd apps/api
pnpm exec ts-node scripts/test-rollover-setup.ts clean
```

### Step 2: Get Logistics Character ID

```sql
SELECT character_id, character_name
FROM eve_characters
WHERE role = 'LOGISTICS'
LIMIT 1;
```

Note the `character_id` - you'll need it throughout.

### Step 3: Plan First Cycle

```bash
# API Request
POST http://localhost:3000/ledger/cycles/plan
Content-Type: application/json
Authorization: Bearer <your-token>

{
  "name": "Test Cycle 1",
  "startedAt": "2025-01-15T00:00:00Z"
}

# Response: Note the cycle ID
```

### Step 4: Create Participation

```bash
POST http://localhost:3000/ledger/cycles/{cycleId}/participations
Content-Type: application/json

{
  "characterName": "Test Investor",
  "amountIsk": "5000000000"
}

# Response: Note the participation memo (e.g., "ARB-a1b2c3d4")
```

### Step 5: Create Fake Donation

```bash
pnpm exec ts-node scripts/test-rollover-setup.ts create-donation --characterId <logistics-char-id> --amount 5000000000 --reason "ARB-<first-8-chars-of-cycle-id>"
```

### Step 6: Match Donation to Participation

```bash
POST http://localhost:3000/ledger/participations/match?cycleId={cycleId}
Authorization: Bearer <your-token>

# Should return: { matched: 1, partial: 0, ... }
```

### Step 7: Open the Cycle

```bash
POST http://localhost:3000/ledger/cycles/{cycleId}/open
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "startedAt": "2025-01-15T00:00:00Z"
}

# Check logs for:
# - "Initial capital = investor participations ONLY"
# - Should be 5,000,000,000 ISK
```

**Verification:**

```sql
SELECT
  id,
  name,
  initial_capital_isk,
  started_at,
  closed_at
FROM cycles
WHERE id = '<cycle-id>';

-- initial_capital_isk should be 5000000000.00
```

### Step 8: Create a Cycle Line

```bash
POST http://localhost:3000/ledger/cycles/{cycleId}/lines
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "typeId": 34,
  "destinationStationId": 60003760,
  "plannedUnits": 100
}

# Response: Note the line ID
```

### Step 9: Create Fake Trades (with unsold inventory)

```bash
pnpm exec ts-node scripts/test-rollover-setup.ts create-trades --cycleId <cycle-id> --lineId <line-id> --characterId <logistics-char-id> --typeId 34 --stationId 60003760 --buyUnits 100 --buyPrice 50000 --sellUnits 60 --sellPrice 55000
```

This creates:

- Buy: 100 units @ 50,000 ISK = 5,000,000 ISK cost
- Sell: 60 units @ 55,000 ISK = 3,300,000 ISK gross (3,135,000 net after tax)
- Remaining: 40 units @ 50,000 WAC = 2,000,000 ISK for rollover

**Verification:**

```sql
SELECT
  id,
  units_bought,
  units_sold,
  buy_cost_isk,
  sales_net_isk
FROM cycle_lines
WHERE id = '<line-id>';

-- Expected:
-- units_bought: 100
-- units_sold: 60
-- buy_cost_isk: 5000000.00
-- sales_net_isk: 3135000.00
```

### Step 10: Close the Cycle (Trigger Buyback!)

```bash
POST http://localhost:3000/ledger/cycles/{cycleId}/close
Authorization: Bearer <your-token>

# Check logs for:
# - "[Rollover Buyback] Processed 1 line items, 2000000.00 ISK"
# - "Buyback completed: 1 items, 2000000.00 ISK"
```

**Verification - Synthetic Sell Allocation:**

```sql
SELECT
  id,
  line_id,
  wallet_character_id,
  wallet_transaction_id,
  is_rollover,
  quantity,
  unit_price,
  revenue_isk,
  tax_isk
FROM sell_allocations
WHERE line_id = '<line-id>'
  AND is_rollover = true;

-- Expected:
-- wallet_character_id: NULL
-- wallet_transaction_id: NULL
-- is_rollover: true
-- quantity: 40
-- unit_price: 50000.00 (WAC from buy cost)
-- revenue_isk: 2000000.00
-- tax_isk: 0.00
```

**Verification - Cycle Line Updated:**

```sql
SELECT
  units_bought,
  units_sold,
  buy_cost_isk,
  sales_gross_isk,
  sales_net_isk
FROM cycle_lines
WHERE id = '<line-id>';

-- Expected:
-- units_bought: 100
-- units_sold: 100 (60 real + 40 buyback)
-- buy_cost_isk: 5000000.00
-- sales_gross_isk: 5300000.00 (3300000 + 2000000 buyback)
-- sales_net_isk: 5135000.00 (3135000 + 2000000 buyback)
```

**Verification - Cycle Profit:**

```bash
GET http://localhost:3000/ledger/cycles/{cycleId}/profit

# Expected:
# cycleProfitCash: "135000.00"
# (5135000 sales - 5000000 cost = 135000 profit)
```

### Step 11: Plan Second Cycle

```bash
POST http://localhost:3000/ledger/cycles/plan
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "name": "Test Cycle 2",
  "startedAt": "2025-02-01T00:00:00Z"
}

# Response: Note the NEW cycle ID
```

### Step 12: Create Participation for Cycle 2

```bash
POST http://localhost:3000/ledger/cycles/{newCycleId}/participations
Content-Type: application/json

{
  "characterName": "Test Investor 2",
  "amountIsk": "8000000000"
}
```

### Step 13: Create & Match Donation for Cycle 2

```bash
# Create donation
pnpm exec ts-node scripts/test-rollover-setup.ts create-donation --characterId <logistics-char-id> --amount 8000000000 --reason "ARB-<first-8-chars-of-new-cycle-id>"

# Match it
POST http://localhost:3000/ledger/participations/match?cycleId={newCycleId}
Authorization: Bearer <your-token>
```

### Step 14: Open Cycle 2 (Trigger Rollover Purchase!)

```bash
POST http://localhost:3000/ledger/cycles/{newCycleId}/open
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "startedAt": "2025-02-01T00:00:00Z"
}

# Check logs for:
# - "Initial capital = investor participations ONLY"
# - "Created X rollover cycle lines"
# - "[Rollover Purchase] Processed 1 items, 2000000.00 ISK cost"
# - "Rollover purchase completed: 1 items, 2000000.00 ISK deducted from capital"
```

**Verification - Initial Capital:**

```sql
SELECT
  id,
  name,
  initial_capital_isk,
  started_at
FROM cycles
WHERE id = '<new-cycle-id>';

-- Expected:
-- initial_capital_isk: 8000000000.00
-- (8B from participation, NO wallet ISK)
```

**Verification - Rollover Cycle Line:**

```sql
SELECT
  id,
  type_id,
  destination_station_id,
  planned_units,
  units_bought,
  buy_cost_isk,
  current_sell_price_isk,
  is_rollover,
  rollover_from_cycle_id,
  rollover_from_line_id
FROM cycle_lines
WHERE cycle_id = '<new-cycle-id>'
  AND is_rollover = true;

-- Expected:
-- type_id: 34
-- planned_units: 40
-- units_bought: 40
-- buy_cost_isk: 2000000.00 (40 × 50000 WAC from prev cycle)
-- is_rollover: true
-- rollover_from_cycle_id: <old-cycle-id>
-- rollover_from_line_id: <old-line-id>
-- current_sell_price_isk: 55000.00 (preserved from prev cycle)
```

**Verification - Synthetic Buy Allocation:**

```sql
SELECT
  id,
  line_id,
  wallet_character_id,
  wallet_transaction_id,
  is_rollover,
  quantity,
  unit_price
FROM buy_allocations
WHERE line_id = '<new-rollover-line-id>'
  AND is_rollover = true;

-- Expected:
-- wallet_character_id: NULL
-- wallet_transaction_id: NULL
-- is_rollover: true
-- quantity: 40
-- unit_price: 50000.00 (WAC from previous cycle)
```

**Verification - Capital Accounting:**

```
Starting Capital: 8,000,000,000 ISK (from participation)
Rollover Purchase: -2,000,000 ISK (bought from admin)
Remaining Cash: 7,998,000,000 ISK
Inventory Value: 2,000,000 ISK (40 units @ 50k cost)
Total Capital: 8,000,000,000 ISK ✓

Admin received: +2,000,000 ISK (made whole!)
```

---

## ✅ Success Criteria

### Cycle 1 Close (Buyback):

- [x] Synthetic sell allocation created (`isRollover = true`, NULL wallet IDs)
- [x] Cycle line fully sold (`unitsSold = unitsBought`)
- [x] Sales revenue includes buyback at cost (zero profit on unsold)
- [x] Profit calculation correct (only profit from actual sales)

### Cycle 2 Open (Rollover Purchase):

- [x] Initial capital = participations ONLY (no wallet ISK)
- [x] Rollover cycle line created with tracking fields
- [x] Synthetic buy allocation created (`isRollover = true`, NULL wallet IDs)
- [x] Buy cost matches previous cycle WAC
- [x] Current sell price preserved from previous cycle
- [x] Capital accounting correct (participation - rollover cost = cash)

### Admin Accounting:

- [x] Admin paid 2M ISK at cycle 1 close (buyback)
- [x] Admin received 2M ISK at cycle 2 open (rollover purchase)
- [x] Admin net: 0 ISK (made whole) ✓

### Data Integrity:

- [x] Rollover allocations don't interfere with real wallet allocations
- [x] Allocation service filters out rollover allocations
- [x] Profit calculations accurate
- [x] Audit trail complete (cycle linkage, rollover flags)

---

## 🐛 Common Issues

### Issue: Donation doesn't match

- Check memo format matches participation memo exactly
- Check character ID is a LOGISTICS character
- Check refType is 'player_donation'

### Issue: Rollover purchase doesn't find previous line

- Verify `rollover_from_line_id` is set correctly
- Check previous cycle has closed (closedAt set)
- Check type/station IDs match between cycles

### Issue: WAC calculation wrong

- Verify previous cycle line has correct `buy_cost_isk` and `units_bought`
- Check for divide-by-zero (units_bought = 0)

### Issue: Allocation service errors

- Verify `isRollover` field exists in both allocation tables
- Check migration was applied successfully
- Regenerate Prisma client if needed

---

## 📊 Database Queries for Verification

### View all allocations for a line:

```sql
SELECT
  'BUY' as type,
  wallet_character_id,
  wallet_transaction_id,
  is_rollover,
  quantity,
  unit_price,
  created_at
FROM buy_allocations
WHERE line_id = '<line-id>'
UNION ALL
SELECT
  'SELL' as type,
  wallet_character_id,
  wallet_transaction_id,
  is_rollover,
  quantity,
  unit_price,
  created_at
FROM sell_allocations
WHERE line_id = '<line-id>'
ORDER BY created_at;
```

### View cycle summary:

```sql
SELECT
  c.id,
  c.name,
  c.started_at,
  c.closed_at,
  c.initial_capital_isk,
  COUNT(DISTINCT cl.id) as total_lines,
  COUNT(DISTINCT cl.id) FILTER (WHERE cl.is_rollover = true) as rollover_lines,
  SUM(cl.buy_cost_isk) as total_buy_cost,
  SUM(cl.sales_net_isk) as total_sales_net
FROM cycles c
LEFT JOIN cycle_lines cl ON cl.cycle_id = c.id
GROUP BY c.id, c.name, c.started_at, c.closed_at, c.initial_capital_isk
ORDER BY c.started_at DESC;
```

### Trace rollover linkage:

```sql
SELECT
  cl1.cycle_id as new_cycle,
  cl1.id as new_line,
  cl1.is_rollover,
  cl1.rollover_from_cycle_id as old_cycle,
  cl1.rollover_from_line_id as old_line,
  cl1.buy_cost_isk as new_cost,
  cl2.buy_cost_isk as old_cost,
  cl2.units_bought as old_units,
  (cl2.buy_cost_isk::numeric / NULLIF(cl2.units_bought, 0)) as wac
FROM cycle_lines cl1
LEFT JOIN cycle_lines cl2 ON cl2.id = cl1.rollover_from_line_id
WHERE cl1.is_rollover = true;
```

---

## 🎉 Testing Complete

Once all verifications pass, the rollover refactor is validated and ready for production!
