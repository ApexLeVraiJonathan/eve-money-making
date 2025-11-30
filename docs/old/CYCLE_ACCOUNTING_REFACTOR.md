# Cycle Accounting Refactor

## Overview

This document describes the simplified cycle-based accounting system implemented for the EVE Money Making arbitrage application. The refactor eliminates complexity by treating wallet transactions as the canonical source of truth and computing fees deterministically.

## Key Principles

1. **Cash-only profit**: Cycles track only cash profit. Inventory rolls over between cycles but doesn't count toward payout calculations.
2. **Wallet is canonical**: All buys and sells come from ESI wallet transactions, not ledger entries.
3. **Deterministic fees**: Sales tax (3.37%), broker fees (1.5%), and relist fees (0.3%) are calculated using fixed percentages.
4. **Allocation not reconciliation**: Wallet transactions are allocated to cycle lines, not reconciled to plan commits.
5. **Cycle-scoped operations**: All financial tracking is scoped to cycles, not individual commits.

## Data Model

### CycleLine

Represents a buy commitment for a specific item and destination within a cycle.

- `typeId`: Item type ID
- `destinationStationId`: Where items will be sold
- `plannedUnits`: How many units are planned for this line
- `unitsBought`: Actual units bought (updated by allocation)
- `buyCostIsk`: Total cost of all buys for this line
- `unitsSold`: Actual units sold (updated by allocation)
- `salesGrossIsk`: Total revenue from sells
- `salesTaxIsk`: Accumulated sales tax (3.37%)
- `salesNetIsk`: Net revenue after tax
- `brokerFeesIsk`: Accumulated broker fees (1.5% of order value on listing)
- `relistFeesIsk`: Accumulated relist fees (0.3% of order value on relisting)

**Derived values:**

- `unitsRemaining = unitsBought - unitsSold`
- `wacUnitCost = buyCostIsk / unitsBought` (weighted average cost)
- `lineProfitExclTransport = salesNetIsk - buyCostIsk - brokerFeesIsk - relistFeesIsk`

### BuyAllocation

Links a wallet buy transaction to a cycle line with quantity allocated.

- `walletCharacterId`: Character who made the buy
- `walletTransactionId`: ESI transaction ID
- `lineId`: Cycle line this buy is allocated to
- `quantity`: How many units from this transaction go to this line
- `unitPrice`: Price per unit in this transaction

### SellAllocation

Links a wallet sell transaction to a cycle line with quantity allocated.

- `walletCharacterId`: Character who made the sell
- `walletTransactionId`: ESI transaction ID
- `lineId`: Cycle line this sell is allocated to
- `quantity`: How many units from this transaction go to this line
- `unitPrice`: Price per unit in this transaction
- `revenueIsk`: Total revenue from this allocation
- `taxIsk`: Sales tax (3.37% of revenue)

### CycleFeeEvent

Tracks cycle-level fees not tied to specific items.

- `cycleId`: Cycle this fee belongs to
- `feeType`: Type of fee (`transport` or `other`)
- `amountIsk`: Fee amount
- `occurredAt`: When the fee was incurred
- `memo`: Optional description

### CycleSnapshot

Periodic snapshots for tracking cycle state over time.

- `cycleId`: Cycle this snapshot belongs to
- `snapshotAt`: Timestamp of snapshot
- `walletCashIsk`: Available cash from SELLER character wallets
- `inventoryIsk`: Inventory value (WAC-based, from cycle lines)
- `cycleProfitIsk`: Current cash-only profit

## Allocation Logic

### Buy Allocation (FIFO)

When wallet buy transactions are imported:

1. Fetch all unallocated buy transactions
2. For each buy:
   - Find all cycle lines for the same `typeId` with capacity (`unitsBought < plannedUnits`)
   - Allocate top-to-bottom (FIFO by line `createdAt`)
   - A single buy can span multiple lines
3. Create `BuyAllocation` records
4. Update line `unitsBought` and `buyCostIsk`

### Sell Allocation (by Character Location)

When wallet sell transactions are imported:

1. Fetch all unallocated sell transactions
2. For each sell:
   - Resolve the character's destination via `EveCharacter.location` (e.g., `DODIXIE` → station ID `60011866`)
   - Find cycle lines matching `typeId` and `destinationStationId` with inventory (`unitsSold < unitsBought`)
   - Allocate FIFO
3. Create `SellAllocation` records
4. Update line `unitsSold`, `salesGrossIsk`, `salesTaxIsk`, `salesNetIsk`
5. Sales tax is calculated as 3.37% of revenue

### Fee Recording

Fees are recorded manually via API endpoints when events occur:

- **Broker fee (1.5%)**: When listing items for sale (POST `/ledger/lines/:lineId/broker-fee`)
- **Relist fee (0.3%)**: When updating an order price (POST `/ledger/lines/:lineId/relist-fee`)
- **Transport fee**: When paying for item transport (POST `/ledger/cycles/:cycleId/transport-fee`)

Frontend hooks:

- Sell Appraiser confirmation → POST broker fee
- Undercut Checker confirmation → POST relist fee

## Profit Calculation

### Line Profit

Per cycle line:

```
lineProfitExclTransport = salesNetIsk - buyCostIsk - brokerFeesIsk - relistFeesIsk
```

Where:

- `salesNetIsk = salesGrossIsk - salesTaxIsk`
- `salesTaxIsk = salesGrossIsk × 0.0337`

### Cycle Profit (Cash-Only)

```
cycleProfitCash = Σ(lineProfitExclTransport) - Σ(transportFees)
```

**Important**: Inventory is **not** included in cycle profit for payouts. Unsold inventory rolls over to the next cycle.

## Character Location Mapping

Characters with `function=SELLER` must have a `location` field set to one of:

- `JITA` → 60003760
- `DODIXIE` → 60011866
- `AMARR` → 60008494
- `HEK` → 60005686
- `RENS` → 60004588

This mapping is used to match sell transactions to destinations.

## API Endpoints

### Cycle Lines

- `POST /ledger/cycles/:cycleId/lines` - Create a cycle line
- `GET /ledger/cycles/:cycleId/lines` - List lines for a cycle
- `PATCH /ledger/lines/:lineId` - Update a cycle line
- `DELETE /ledger/lines/:lineId` - Delete a cycle line

### Fees

- `POST /ledger/lines/:lineId/broker-fee` - Add broker fee to a line
- `POST /ledger/lines/:lineId/relist-fee` - Add relist fee to a line
- `POST /ledger/cycles/:cycleId/transport-fee` - Add transport fee to cycle
- `GET /ledger/cycles/:cycleId/transport-fees` - List transport fees

### Profit & Snapshots

- `GET /ledger/cycles/:cycleId/profit` - Get cycle profit breakdown
- `POST /ledger/cycles/:cycleId/snapshot` - Create a snapshot
- `GET /ledger/cycles/:cycleId/snapshots` - List snapshots

### Allocation

- `POST /recon/reconcile?cycleId=<id>` - Run allocation for a cycle

## Jobs

### Hourly: Wallet Import & Allocation

1. Import wallet transactions and journal entries from ESI
2. Run allocation (buys and sells)
3. Create snapshots for all open cycles

Configured via `JOB_WALLETS_ENABLED` env var.

## Environment Variables

```bash
DEFAULT_SALES_TAX_PCT=3.37          # Sales tax percentage
DEFAULT_BROKER_FEE_PCT=1.5          # Broker fee percentage
DEFAULT_RELIST_FEE_PCT=0.3          # Relist fee percentage
WALLET_RESERVE_PER_CHAR=100000000   # ISK to reserve per character (100M)
```

## Frontend Pages

### Cycle Lines Management

`/arbitrage/cycles/[cycleId]/lines`

- View all cycle lines
- Create new lines (type, destination, planned units)
- Add broker/relist fees
- Delete lines
- See live buy/sell/profit data

### Cycle Profit View

`/arbitrage/cycles/[cycleId]/profit`

- Line-level profit breakdown
- Transport fees list
- Net cash profit (line profit - transport)

## Migration from Old System

The old system used:

- `PlanCommit` and `PlanCommitLine` for tracking plans
- `CycleLedgerEntry` with `entryType=execution` for buys/sells
- Synthetic opening balance entries
- Time-window-based reconciliation

The new system:

- Keeps `PlanCommit`/`PlanCommitLine` as optional/informational (not used for accounting)
- Restricts `CycleLedgerEntry` to deposits/withdrawals/payouts only
- Uses `CycleLine` for buy commitments
- Uses `BuyAllocation`/`SellAllocation` for tracking actual transactions
- No synthetic entries

Existing cycles can continue using old data. New cycles should use the new system exclusively.

## Testing

Key unit tests in `apps/api/test/allocation.spec.ts`:

- Buy allocation (FIFO)
- Sell allocation (by character location)
- Tax calculation (3.37%)

E2E test scenarios:

1. Create cycle → Create lines → Import wallet data → Run allocation → Verify line totals
2. Add broker/relist fees → Verify line profit
3. Add transport fee → Verify cycle profit

## Benefits of This Approach

1. **Simplicity**: Single source of truth (wallet), deterministic fees
2. **Accuracy**: Fixed fee percentages eliminate ESI journal matching ambiguity
3. **Performance**: No complex reconciliation logic, just FIFO allocation
4. **Transparency**: Clear line-level and cycle-level profit visibility
5. **Scalability**: Allocation scales linearly with transaction count

## Future Enhancements

- Auto-calculate broker/relist fees when user confirms actions in Sell Appraiser/Undercut Checker
- Support for multiple source stations (Jita, Perimeter) in buy allocation
- Configurable fee percentages per character (for different standings/skills)
- Historical profit charts using `CycleSnapshot` data
