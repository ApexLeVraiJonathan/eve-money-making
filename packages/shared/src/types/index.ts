/**
 * Shared types used across frontend and backend
 *
 * These types mirror the database schema but are optimized for API consumption.
 * Frontend and backend both import from here for type consistency.
 */

// ============================================================================
// Enums
// ============================================================================

export type CharacterRole = "USER" | "LOGISTICS";
export type CharacterManagedBy = "USER" | "SYSTEM";
export type CharacterFunction = "SELLER" | "BUYER";
export type CharacterLocation =
  | "JITA"
  | "DODIXIE"
  | "AMARR"
  | "HEK"
  | "RENS"
  | "CN";
export type CycleStatus = "PLANNED" | "OPEN" | "COMPLETED";
export type NotificationChannel = "DISCORD_DM";
export type NotificationType =
  | "CYCLE_PLANNED"
  | "CYCLE_STARTED"
  | "CYCLE_RESULTS"
  | "CYCLE_PAYOUT_SENT"
  | "SKILL_PLAN_REMAP_REMINDER"
  | "SKILL_PLAN_COMPLETION"
  | "PLEX_ENDING"
  | "MCT_ENDING"
  | "BOOSTER_ENDING"
  | "TRAINING_QUEUE_IDLE"
  | "SKILL_FARM_EXTRACTOR_READY"
  | "SKILL_FARM_QUEUE_LOW";
export type ParticipationStatus =
  | "AWAITING_INVESTMENT"
  | "AWAITING_VALIDATION"
  | "OPTED_IN"
  | "OPTED_OUT"
  | "AWAITING_PAYOUT"
  | "COMPLETED"
  | "REFUNDED";
export type RolloverType = "FULL_PAYOUT" | "INITIAL_ONLY" | "CUSTOM_AMOUNT";

// ============================================================================
// User & Authentication
// ============================================================================

export interface User {
  id: string;
  email: string | null;
  role: string;
  primaryCharacterId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscordAccount {
  id: string;
  userId: string;
  discordUserId: string;
  username: string;
  discriminator: string | null;
  avatarUrl: string | null;
  linkedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EveCharacter {
  id: number;
  name: string;
  ownerHash: string;
  userId: string | null;
  role: CharacterRole;
  function: CharacterFunction | null;
  location: CharacterLocation | null;
  managedBy: CharacterManagedBy;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Cycles & Ledger
// ============================================================================

export interface Cycle {
  id: string;
  name: string | null;
  status: CycleStatus;
  startedAt: string;
  closedAt: string | null;
  initialCapitalIsk: string | null;
  initialInjectionIsk: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CycleLine {
  id: string;
  cycleId: string;
  typeId: number;
  typeName?: string; // Enriched
  destinationStationId: number;
  destinationStationName?: string; // Enriched
  plannedUnits: number;
  unitsBought: number;
  buyCostIsk: string;
  unitsSold: number;
  salesGrossIsk: string;
  salesTaxIsk: string;
  salesNetIsk: string;
  brokerFeesIsk: string;
  relistFeesIsk: string;
  currentSellPriceIsk: string | null;
  listedUnits: number;
  unitsRemaining?: number; // Computed
  wacUnitCost?: string; // Computed
  lineProfitExclTransport?: string; // Computed
  createdAt: string;
  updatedAt: string;
}

export interface CycleLedgerEntry {
  id: string;
  cycleId: string;
  occurredAt: string;
  entryType: string;
  amount: string;
  memo: string | null;
  participationId: string | null;
}

export interface CycleSnapshot {
  id: string;
  cycleId: string;
  snapshotAt: string;
  walletCashIsk: string;
  inventoryIsk: string;
  cycleProfitIsk: string;
  createdAt: string;
}

export interface CycleFeeEvent {
  id: string;
  cycleId: string;
  feeType: string;
  amountIsk: string;
  memo: string | null;
  occurredAt: string;
  createdAt: string;
}

// ============================================================================
// Participation & Payouts
// ============================================================================

export interface CycleParticipation {
  id: string;
  cycleId: string;
  userId: string | null;
  characterName: string;
  amountIsk: string;
  status: ParticipationStatus;
  memo: string;
  validatedAt: string | null;
  walletJournalId: bigint | null;
  payoutAmountIsk: string | null;
  payoutPaidAt: string | null;
  rolloverDeductedIsk: string | null;
  refundAmountIsk: string | null;
  refundedAt: string | null;
  optedOutAt: string | null;
  // Rollover fields for automatic reinvestment
  rolloverType: RolloverType | null;
  rolloverRequestedAmountIsk: string | null;
  rolloverFromParticipationId: string | null;
  createdAt: string;
  updatedAt: string;
}

// JingleYield seeded-investment program summary for admin views
export interface JingleYieldProgramSummary {
  id: string;
  userId: string;
  adminCharacterId: number;
  lockedPrincipalIsk: string;
  cumulativeInterestIsk: string;
  targetInterestIsk: string;
  status: string;
  minCycles: number;
  cyclesCompleted: number;
  startCycle: {
    id: string;
    name: string | null;
    startedAt: string;
  } | null;
  completedCycle: {
    id: string;
    name: string | null;
    closedAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// Current user's JingleYield status
export interface JingleYieldStatus {
  id: string;
  userId: string;
  status: string;
  lockedPrincipalIsk: string;
  cumulativeInterestIsk: string;
  targetInterestIsk: string;
  minCycles: number;
  cyclesCompleted: number;
  startCycle: {
    id: string;
    name: string | null;
    startedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Market & Arbitrage
// ============================================================================

// Liquidity Types
export interface LiquidityCheckRequest {
  station_id?: number;
  windowDays?: number;
  minCoverageRatio?: number;
  minLiquidityThresholdISK?: number;
  minWindowTrades?: number;
}

export interface LiquidityItemDto {
  typeId: number;
  typeName?: string;
  avgDailyAmount: number;
  latest: { high: string; low: string; avg: string } | null;
  avgDailyIskValue: number;
  coverageDays: number;
  avgDailyTrades: number;
}

export interface LiquidityCheckResponse {
  [stationId: string]: {
    stationName: string;
    totalItems: number;
    items: LiquidityItemDto[];
  };
}

export interface LiquidityItemStatsRequest {
  itemId?: number;
  itemName?: string;
  stationId?: number;
  stationName?: string;
  isBuyOrder?: boolean;
  windowDays?: number;
}

export interface LiquidityItemStatsResponse {
  [stationId: string]: {
    stationName: string;
    buy?: {
      perDay: Array<{
        date: string;
        amount: number;
        high: string;
        low: string;
        avg: string;
        orderNum: number;
        iskValue: string;
      }>;
      windowAverages: { amountAvg: number; iskValueAvg: number };
    };
    sell?: {
      perDay: Array<{
        date: string;
        amount: number;
        high: string;
        low: string;
        avg: string;
        orderNum: number;
        iskValue: string;
      }>;
      windowAverages: { amountAvg: number; iskValueAvg: number };
    };
  };
}

// Arbitrage Types
export type PriceValidationSource = "ESI" | "LiquidityAvg" | "None";

export interface ArbitrageCheckRequest {
  sourceStationId?: number;
  maxInventoryDays?: number;
  marginValidateThreshold?: number;
  minTotalProfitISK?: number;
  minMarginPercent?: number;
  maxPriceDeviationMultiple?: number;
  stationConcurrency?: number;
  itemConcurrency?: number;
  salesTaxPercent?: number;
  brokerFeePercent?: number;
  esiMaxConcurrency?: number;
  liquidityWindowDays?: number;
  liquidityMinCoverageRatio?: number;
  liquidityMinLiquidityThresholdISK?: number;
  liquidityMinWindowTrades?: number;
  destinationStationIds?: number[];
  excludeDestinationStationIds?: number[];
  disableInventoryLimit?: boolean;
  allowInventoryTopOff?: boolean;
}

export interface Opportunity {
  typeId: number;
  name: string;
  sourceStationId: number;
  destinationStationId: number;
  sourcePrice: number | null;
  destinationPrice: number | null;
  priceValidationSource: PriceValidationSource;
  netProfitISK: number;
  margin: number;
  recentDailyVolume: number;
  arbitrageQuantity: number;
  totalCostISK: number;
  totalProfitISK: number;
}

export interface DestinationGroup {
  destinationStationId: number;
  stationName?: string;
  totalItems: number;
  totalCostISK: number;
  totalProfitISK: number;
  averageMargin: number;
  items: Opportunity[];
}

export interface ArbitrageCheckResponse {
  [stationId: string]: DestinationGroup;
}

export interface ArbitrageOpportunity {
  typeId: number;
  typeName: string;
  buyStationId: number;
  buyStationName: string;
  sellStationId: number;
  sellStationName: string;
  buyPrice: number;
  sellPrice: number;
  profitPerUnit: number;
  roi: number;
  volume: number;
  estimatedProfit: number;
  liquidity?: {
    dailyVolume: number;
    daysToSell: number;
  };
}

// Arbitrage Planner Types
export interface LiquidityOptions {
  windowDays?: number;
  minCoverageRatio?: number;
  minLiquidityThresholdISK?: number;
  minWindowTrades?: number;
}

export interface ArbitrageOptions {
  maxInventoryDays?: number;
  minMarginPercent?: number;
  maxPriceDeviationMultiple?: number;
  destinationStationIds?: number[];
  excludeDestinationStationIds?: number[];
  disableInventoryLimit?: boolean;
  allowInventoryTopOff?: boolean;
  salesTaxPercent?: number;
  brokerFeePercent?: number;
  minTotalProfitISK?: number;
}

export interface PlanPackagesRequest {
  shippingCostByStation: Record<string, number>;
  packageCapacityM3: number;
  investmentISK: number;
  perDestinationMaxBudgetSharePerItem?: number;
  maxPackagesHint?: number;
  maxPackageCollateralISK?: number;
  minPackageNetProfitISK?: number;
  minPackageROIPercent?: number;
  shippingMarginMultiplier?: number;
  densityWeight?: number;
  destinationCaps?: Record<string, { maxShare?: number; maxISK?: number }>;
  allocation?: {
    mode?: "best" | "targetWeighted" | "roundRobin";
    targets?: Record<string, number>;
    spreadBias?: number;
  };
  liquidityOptions?: LiquidityOptions;
  arbitrageOptions?: ArbitrageOptions;
}

export interface PackedUnit {
  typeId: number;
  name: string;
  units: number;
  unitCost: number;
  unitProfit: number;
  unitVolume: number;
  spendISK: number;
  profitISK: number;
  volumeM3: number;
}

export interface PackagePlan {
  packageIndex: number;
  destinationStationId: number;
  destinationName?: string;
  items: PackedUnit[];
  spendISK: number;
  grossProfitISK: number;
  shippingISK: number;
  netProfitISK: number;
  usedCapacityM3: number;
  efficiency: number;
}

export interface PlanResult {
  packages: PackagePlan[];
  totalSpendISK: number;
  totalGrossProfitISK: number;
  totalShippingISK: number;
  totalNetProfitISK: number;
  itemExposureByDest: Record<
    number,
    Record<number, { spendISK: number; units: number }>
  >;
  destSpend: Record<number, number>;
  notes: string[];
}

export interface Package {
  id: string;
  cycleId: string | null;
  status: string;
  destinationStationId: number;
  destinationStationName?: string; // Enriched
  totalBuyPriceIsk: string;
  totalVolume: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/**
 * Committed package with full details (from committedPackage table)
 * Backend: apps/api/src/market/services/package.service.ts
 */
export interface CommittedPackage {
  id: string;
  cycleId: string;
  packageIndex: number;
  destinationStationId: number;
  destinationName: string | null;
  collateralIsk: string;
  shippingCostIsk: string;
  estimatedProfitIsk: string;
  status: string;
  committedAt: string;
  failedAt: string | null;
  collateralRecoveredIsk: string | null;
  failureMemo: string | null;
  itemCount: number;
  totalUnits: number;
  totalVolumeM3: string;
}

export interface PackageItem {
  id: string;
  packageId: string;
  typeId: number;
  typeName?: string; // Enriched
  quantity: number;
  buyPricePerUnit: string;
  totalBuyPrice: string;
  volume: string;
}

// ============================================================================
// Wallet & Transactions
// ============================================================================

export interface WalletTransaction {
  id: string;
  transactionId: bigint;
  characterId: number;
  date: string;
  isBuy: boolean;
  quantity: number;
  typeId: number;
  unitPrice: string;
  clientId: number;
  locationId: number;
  allocated: boolean;
  allocatedToCycleLineId: string | null;
  createdAt: string;
}

export interface WalletJournalEntry {
  id: string;
  journalId: bigint;
  characterId: number;
  date: string;
  refType: string;
  firstPartyId: number | null;
  secondPartyId: number | null;
  amount: string;
  balance: string;
  reason: string | null;
  taxReceiverId: number | null;
  tax: string | null;
  description: string | null;
  createdAt: string;
}

// ============================================================================
// Game Data
// ============================================================================

export interface TypeId {
  id: number;
  published: boolean;
  name: string;
  volume: string | null;
}

export interface StationId {
  id: number;
  solarSystemId: number;
  name: string;
}

export interface SolarSystemId {
  id: number;
  regionId: number;
  name: string;
}

export interface RegionId {
  id: number;
  name: string;
}

export interface TrackedStation {
  id: string;
  stationId: number;
  stationName?: string; // Enriched
  createdAt: string;
  updatedAt: string;
}

export interface MarketOrderTradeDaily {
  scanDate: string;
  locationId: number;
  typeId: number;
  isBuyOrder: boolean;
  regionId: number;
  hasGone: boolean;
  amount: number;
  high: string;
  low: string;
  avg: string;
  orderNum: number;
  iskValue: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface CycleOverview {
  current: {
    id: string;
    name: string | null;
    startedAt: string;
    endsAt: string | null;
    status: "Open" | "Closed" | "Planned";
    profit: {
      current: number;
      estimated: number;
      portfolioValue: number;
    };
    capital: {
      cash: number;
      inventory: number;
      total: number;
    };
    initialCapitalIsk: number;
    participantCount: number;
    totalInvestorCapital: number;
  } | null;
  next: {
    id: string;
    name: string | null;
    startedAt: string;
    status: "Planned";
  } | null;
}

export interface CycleProfit {
  lineProfitExclTransport: string;
  transportFees: string;
  cycleProfitCash: string;
  lineBreakdown: Array<{
    lineId: string;
    typeId: number;
    typeName: string;
    destinationStationId: number;
    destinationStationName: string;
    profit: string;
  }>;
}

export interface CapitalResponse {
  cycleId: string;
  asOf: string;
  capital: {
    total: string;
    cash: string;
    inventory: string;
    percentSplit: {
      cash: number;
      inventory: number;
    };
  };
  initialInvestment: string | null;
  inventoryBreakdown: Array<{
    stationId: number;
    stationName: string;
    value: string;
  }>;
  notes: string[];
}

export interface PayoutSuggestion {
  payouts: Array<{
    participationId: string;
    userId: string | null;
    characterName: string;
    investmentIsk: string;
    profitShareIsk: string;
    totalPayoutIsk: string;
  }>;
  totalPayout: string;
}

// ============================================================================
// Pricing & Market Data
// ============================================================================

/**
 * Item in a sell appraisal response (paste mode)
 * Backend: apps/api/src/market/services/pricing.service.ts - sellAppraise
 */
export interface SellAppraiseItem {
  itemName: string;
  quantity: number;
  destinationStationId: number;
  lowestSell: number | null;
  suggestedSellPriceTicked: number | null;
}

/**
 * Item in a sell appraisal by commit response
 * Backend: apps/api/src/market/services/pricing.service.ts - sellAppraiseByCommit
 */
export interface SellAppraiseByCommitItem {
  itemName: string;
  typeId: number;
  quantityRemaining: number;
  destinationStationId: number;
  lowestSell: number | null;
  suggestedSellPriceTicked: number | null;
}

/**
 * Response from /pricing/sell-appraise endpoint
 * Backend: apps/api/src/market/services/pricing.service.ts - sellAppraise
 */
export type SellAppraiseResponse = SellAppraiseItem[];

/**
 * Response from /pricing/sell-appraise-by-commit endpoint
 * Backend: apps/api/src/market/services/pricing.service.ts - sellAppraiseByCommit
 */
export type SellAppraiseByCommitResponse = SellAppraiseByCommitItem[];

/**
 * Update item in undercut check response
 */
export interface UndercutUpdate {
  orderId: number;
  typeId: number;
  itemName: string;
  remaining: number;
  currentPrice: number;
  competitorLowest: number;
  suggestedNewPriceTicked: number;
  estimatedMarginPercentAfter?: number;
  estimatedProfitIskAfter?: number;
  wouldBeLossAfter?: boolean;
}

/**
 * Character-station group in undercut check response
 */
export interface UndercutCheckGroup {
  characterId: number;
  characterName: string;
  stationId: number;
  stationName: string;
  updates: UndercutUpdate[];
}

/**
 * Response from /pricing/undercut-check endpoint
 * Backend: apps/api/src/market/services/pricing.service.ts - undercutCheck
 */
export type UndercutCheckResponse = UndercutCheckGroup[];

// ============================================================================
// Utility Types
// ============================================================================

/** Paginated API response */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/** API error response */
export interface ApiErrorResponse {
  message: string;
  statusCode: number;
  error?: string;
}
