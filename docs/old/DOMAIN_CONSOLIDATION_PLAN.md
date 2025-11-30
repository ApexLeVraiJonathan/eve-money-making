# Domain Consolidation & Service Splitting Plan

**Status:** 🔄 In Progress  
**Goal:** Reorganize 18 scattered modules into 6 clear domains

## Current State

**18 Modules:**
auth, users, characters, arbitrage, pricing, liquidity, packages, tracked-stations, wallet, reconciliation, ledger, game-data, market-data, import, esi, jobs, prisma, common

**Problems:**
- Related functionality scattered across modules
- ledger.service.ts is 2308 lines
- Unclear domain boundaries
- Difficult to navigate

## Target State: 6 Domains

### Domain 1: Cycles (Financial Ledger)
**Consolidates:** ledger/ → cycles/

**Directory Structure:**
```
apps/api/src/cycles/
  cycles.module.ts
  cycles.controller.ts (from ledger.controller.ts)
  dto/ (move all from ledger/dto/)
  services/
    ✅ cycle.service.ts (120 lines) - CREATED
    ✅ cycle-line.service.ts (185 lines) - CREATED  
    ✅ fee.service.ts (65 lines) - CREATED
    ✅ snapshot.service.ts (55 lines) - CREATED
    ⏳ participation.service.ts - TODO
    ⏳ capital.service.ts - TODO
    ⏳ profit.service.ts - TODO
    ⏳ payment-matching.service.ts - TODO
```

**Method Distribution:**
- cycle.service.ts: getCurrentOpenCycle, planCycle, openPlannedCycle, createCycle, listCycles, closeCycle, getOpenCycleIdForDate (7 methods)
- cycle-line.service.ts: createCycleLine, listCycleLines, updateCycleLine, deleteCycleLine + facade methods (7 methods)
- fee.service.ts: addBrokerFee, addRelistFee, addTransportFee, listTransportFees (4 methods)
- snapshot.service.ts: createCycleSnapshot, getCycleSnapshots (2 methods)
- participation.service.ts: All participation CRUD, validation, opt-out (8 methods)
- payment-matching.service.ts: matchParticipationPayments, getUnmatchedDonations (2 methods)
- capital.service.ts: computeCurrentCapitalNow, computeNav, computeCapital (3 methods)
- profit.service.ts: computeCycleProfit, computeEstimatedProfit, computePortfolioValue (3 methods)

**Total:** ~36 methods extracted from monolithic ledger.service.ts

---

### Domain 2: Characters (Auth & Users)
**Consolidates:** auth/ + users/ + characters/ → characters/

**Directory Structure:**
```
apps/api/src/characters/
  characters.module.ts
  auth.controller.ts (from auth/)
  users.controller.ts (from users/)
  characters.controller.ts (new, for character mgmt)
  dto/ (merge auth/dto + users/dto)
  services/
    ✅ character.service.ts - EXISTS
    ⏳ auth.service.ts (move from auth/)
    ⏳ user.service.ts (rename from users.service.ts)
    ⏳ token.service.ts (move from auth/)
    ⏳ esi-token.service.ts (move from auth/)
  guards/
    ⏳ auth.guard.ts (move from auth/)
    ⏳ roles.guard.ts (move from auth/)
    ⏳ jwt.strategy.ts (move from auth/)
  decorators/
    ⏳ current-user.decorator.ts
    ⏳ public.decorator.ts
    ⏳ roles.decorator.ts
```

---

### Domain 3: Market (Trading Operations)
**Consolidates:** arbitrage/ + pricing/ + liquidity/ + packages/ + tracked-stations/ → market/

**Directory Structure:**
```
apps/api/src/market/
  market.module.ts
  arbitrage.controller.ts
  pricing.controller.ts
  liquidity.controller.ts
  packages.controller.ts
  tracked-stations.controller.ts
  dto/ (merge all DTOs)
  services/
    ⏳ arbitrage.service.ts (move)
    ⏳ pricing.service.ts (move)
    ⏳ liquidity.service.ts (move)
    ⏳ package.service.ts (rename from packages.service.ts)
    ⏳ tracked-station.service.ts (move)
    ✅ market-data.service.ts (move from market-data/)
```

---

### Domain 4: Wallet (Transactions & Reconciliation)
**Consolidates:** wallet/ + reconciliation/ → wallet/

**Directory Structure:**
```
apps/api/src/wallet/
  wallet.module.ts
  wallet.controller.ts
  reconciliation.controller.ts (from reconciliation/)
  dto/
  services/
    ⏳ wallet.service.ts (exists, keep)
    ⏳ allocation.service.ts (move from reconciliation/)
```

---

### Domain 5: Game Data (Static Data & Imports)
**Consolidates:** game-data/ + import/ → game-data/

**Directory Structure:**
```
apps/api/src/game-data/
  game-data.module.ts
  import.controller.ts (from import/)
  dto/
  services/
    ✅ game-data.service.ts (exists)
    ⏳ import.service.ts (move from import/)
```

---

### Domain 6: Infrastructure (No Change)
**Keep as is:** esi/, jobs/, prisma/, common/

---

## Migration Steps

### Phase A: Create New Domain Structures
1. ✅ Create cycles/services/ directory
2. ✅ Extract 4 services from ledger (cycle, cycle-line, fee, snapshot)
3. ⏳ Extract remaining 4 services (participation, capital, profit, payment-matching)
4. ⏳ Move DTOs to cycles/dto/
5. ⏳ Create cycles.module.ts and cycles.controller.ts

### Phase B: Consolidate Characters Domain
1. ⏳ Move auth services to characters/services/
2. ⏳ Move users service to characters/services/
3. ⏳ Move guards and decorators
4. ⏳ Update imports across codebase
5. ⏳ Merge modules

### Phase C: Consolidate Market Domain
1. ⏳ Create market/ structure
2. ⏳ Move 6 services
3. ⏳ Move 5 controllers
4. ⏳ Merge DTOs
5. ⏳ Create market.module.ts

### Phase D: Consolidate Wallet Domain
1. ⏳ Move allocation.service.ts to wallet/services/
2. ⏳ Move reconciliation.controller.ts
3. ⏳ Merge modules

### Phase E: Consolidate Game Data Domain
1. ⏳ Move import.service.ts to game-data/services/
2. ⏳ Move import.controller.ts
3. ⏳ Merge modules

### Phase F: Update All Imports & Module Dependencies
1. ⏳ Update AppModule
2. ⏳ Update all import paths across codebase
3. ⏳ Delete old directories
4. ⏳ Verify build

## Expected Benefits

### Before (18 modules)
- ❌ Hard to find related code
- ❌ Unclear domain boundaries  
- ❌ 2308-line service
- ❌ Scattered responsibilities

### After (6 domains)
- ✅ Clear domain organization
- ✅ All services <500 lines
- ✅ Related code co-located
- ✅ Easy to navigate
- ✅ Proper separation of concerns

## Progress

- ✅ Phase 5.2 Complete - Domain services created
- 🔄 Phase 5.1 In Progress - Domain consolidation
  - ✅ Cycles domain: 4/8 services created
  - ⏳ Remaining: 4 services + full integration
  - ⏳ Characters: Not started
  - ⏳ Market: Not started
  - ⏳ Wallet: Not started
  - ⏳ Game Data: Not started

