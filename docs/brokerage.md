## Brokerage App - Project Overview (Draft)

### Purpose

Provide a hands-off selling service for EVE Online players. Clients hand over items; the service lists, sells, and remits proceeds minus a brokerage fee.

### Value Proposition

- Convenience for players who don’t want to manage listings.
- Expertise in pricing, market timing, and logistics to maximize realized ISK.
- Transparent tracking from intake to sale to payout.

### Proposed Workflow

1. Intake
   - Client registers and authenticates (EVE SSO).
   - Creates a “consignment” with one or more items (types, quantities, locations).
   - Transfer of items to designated contract or station container.
2. Valuation
   - App estimates fair market value (FMV) per item (buy/sell spread, volume, volatility).
   - Client reviews and accepts brokerage terms for the consignment.
3. Listing & Sale
   - Broker lists items at client-selected hub and strategy.
   - Strategy options (affects fee):
     1. Client sets fixed price (no repricing)
     2. Start at cheapest sell order (no repricing)
     3. Start at cheapest sell order, update daily
     4. Start at cheapest sell order, update twice daily
     5. Start at cheapest sell order, update 3× daily
   - Repricing frequency determines extra workload → fee adjustment.
4. Settlement
   - As items sell, ledger entries are recorded (gross, fee, net, taxes, broker fees).
   - Daily payouts to the client’s wallet.

### Pricing Model (Final for v1)

- Base fee: flat % of net sale proceeds (depends on listing strategy).
- No minimum fee.
- Fee table (example to iterate later):
  - Strategy 1 (client sets fixed price): 2%
  - Strategy 2 (start at cheapest, no repricing): 2.5%
  - Strategy 3 (daily repricing): 3%
  - Strategy 4 (2× daily repricing): 3.5%
  - Strategy 5 (3× daily repricing): 4%

### Transparency & Tracking

- Consignments: status (intake, listed, partially sold, settled), item counts, estimated vs realized.
- Ledger: per sale entry with tax, fees, net to client.
- Reports: realized vs estimated, left to sell, fees breakdown, current unit sell price.

### Risk & Constraints

- Station fees, taxes, and logistics costs impact net.
- Market volatility and undercut wars may delay sales.
- Contract trust model, delivery expectations: trust-based; no collateral.

### MVP Scope

- Create consignments and capture items/locations.
- Auto-valuation using existing pricing module.
- Basic listing plan suggestion and manual confirm (no auto-list in MVP).
- Ledger entries for sales and a payout view (daily payout supported).

### Operational Policies (Final for v1)

- Intake method: Item Exchange contracts; client delivers items to target hub.
- Acceptable hubs/stations: Jita 4-4, C-N (CNAP station).
- Logistics: client must deliver to target station first; brokerage does not move items.
- Payout cadence: daily only.
- Cancellation: allowed anytime; unsold items returned; client covers incurred broker listing fees.
- Exclusions: items not directly sellable on the market.

### Open Questions

1. Any minimum consignment value to add later if abuse occurs?
2. Dispute and lost-item policy details?
