# Phase 5.1: Service Extraction Status

## Controller Method Migration Status (25/36 = 69%)

### ✅ Fully Migrated to New Services (25 methods)

**CycleService (4):**
- planCycle
- listCycles  
- appendEntry
- getCommitSummaries (delegates to cycleLineService)

**CycleLineService (6):**
- createCycleLine
- listCycleLines
- updateCycleLine
- deleteCycleLine
- getCycleLinesForCycle (facade)
- getUnlistedCycleLines (facade)

**FeeService (4):**
- addBrokerFee
- addRelistFee
- addTransportFee
- listTransportFees

**SnapshotService (1):**
- getCycleSnapshots

**ParticipationService (7):**
- createParticipation
- listParticipations
- getMyParticipation
- getAllParticipations
- markPayoutAsSent
- optOutParticipation
- adminValidatePayment (with appendEntry callback)
- adminMarkRefund

**PaymentMatchingService (2):**
- matchParticipationPayments (with appendEntry callback)
- getUnmatchedDonations

**CapitalService (1):**
- computeNav

### ⏳ Remaining in Legacy LedgerService (11 methods)

**Why these remain:**
- Complex orchestration requiring many service dependencies
- Would create circular dependencies if extracted without careful design
- Some require full business logic extraction (100+ lines each)

**List:**
1. `createCycle` - Creates cycle + computes initial capital (needs CapitalService)
2. `openPlannedCycle` - Transaction with 10+ operations + ESI calls
3. `closeCycleWithFinalSettlement` - Orchestrates wallet→allocation→close→payouts
4. `getCycleOverview` - Complex aggregation across multiple tables
5. `listEntriesEnriched` - Enrichment with user/participation data
6. `computeCapital` - Large method with ESI wallet/assets/orders fetching
7. `computeCycleProfit` - Aggregates line profits + transport fees
8. `computeEstimatedProfit` - Complex profit estimation logic
9. `computePortfolioValue` - Portfolio valuation logic
10. `createCycleSnapshot` - Creates snapshot with profit calculation
11. `finalizePayouts` - Complex payout finalization logic

## Next Steps for Full Extraction

To eliminate legacy LedgerService completely:

1. **Create ProfitService** - Extract profit computation methods (7-10)
2. **Create CycleOrchestrationService** - Extract orchestration methods (2, 3)
3. **Enhance CapitalService** - Extract createCycle and computeCapital logic
4. **Create EnrichmentService** - Extract listEntriesEnriched, getCycleOverview
5. **Enhance SnapshotService** - Extract createCycleSnapshot
6. **Enhance PayoutService** - Extract finalizePayouts

**Effort:** ~4-6 hours to extract remaining methods with proper dependency injection

