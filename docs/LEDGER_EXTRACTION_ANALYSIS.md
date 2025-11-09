# Ledger Service Extraction Analysis

## Method Dependency Analysis

### 1. createCycle
**What it does:** Creates cycle + opening balance lines from current inventory
**Dependencies:**
- computeCurrentCapitalNow() → CapitalService
- ESI orders fetching → EsiCharactersService
- Jita pricing → GameDataService
- Create cycle lines → Direct Prisma

**Proposed Solution:** Move to CycleService with CapitalService injected via forwardRef

### 2. openPlannedCycle  
**What it does:** Opens a planned cycle with transaction (cleanup, close old, set capital, create rollover lines)
**Dependencies:**
- getCurrentOpenCycle() → CycleService (already exists)
- computeCurrentCapitalNow() → CapitalService
- ESI orders → EsiCharactersService
- Character tracking → CharacterService

**Proposed Solution:** Move to CycleService

### 3. closeCycleWithFinalSettlement
**What it does:** Orchestrates wallet import → allocation → close → payouts
**Dependencies:**
- closeCycle() → CycleService (exists)
- createPayouts() → PayoutService (exists)
- Wallet/Allocation services (injected)

**Proposed Solution:** Already in CycleService! Just needs to delegate to closeCycle

### 4. getCycleOverview
**What it does:** Returns current/next/planned cycles with stats
**Dependencies:**
- getCurrentOpenCycle() → CycleService
- getNextPlannedCycle() → CycleService
- Queries cycles

**Proposed Solution:** Move to CycleService

### 5. listEntriesEnriched
**What it does:** Lists entries with participation/user data joined
**Dependencies:**
- Just Prisma queries with includes

**Proposed Solution:** Create EnrichmentService OR add to CycleService

### 6. computeCapital
**What it does:** Computes capital breakdown by station with inventory valuation
**Dependencies:**
- computeCurrentCapitalNow() → CapitalService
- ESI wallet/assets/orders → EsiCharactersService
- Jita pricing → GameDataService
- Station names → GameDataService

**Proposed Solution:** Add to CapitalService (it's capital computation!)

### 7-9. computeCycleProfit, computeEstimatedProfit, computePortfolioValue
**What they do:** Various profit calculations
**Dependencies:**
- Cycle lines queries
- Transport fees
- GameDataService for names

**Proposed Solution:** Create ProfitService

### 10. createCycleSnapshot
**What it does:** Creates snapshot with wallet cash + inventory + profit
**Dependencies:**
- Wallet cash → CapitalService or ESI
- Cycle lines
- computeCycleProfit() → ProfitService

**Proposed Solution:** Add to SnapshotService with dependencies

### 11. finalizePayouts
**What it does:** Computes and creates payouts
**Dependencies:**
- computePayouts() → PayoutService (exists!)
- createPayouts() → PayoutService (exists!)

**Proposed Solution:** Move to PayoutService

## Extraction Plan

**Step 1:** Create ProfitService with profit calculation methods (7-9)
**Step 2:** Add computeCapital to CapitalService (6)
**Step 3:** Add finalizePayouts to PayoutService (11)
**Step 4:** Add createCycle, openPlannedCycle, getCycleOverview to CycleService with forwardRef (1, 2, 4)
**Step 5:** Add listEntriesEnriched and createCycleSnapshot to appropriate services (5, 10)
**Step 6:** Update controller to use all new services
**Step 7:** Delete ledger module completely

