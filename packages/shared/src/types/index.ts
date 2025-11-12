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
export type CharacterLocation = "JITA" | "DODIXIE" | "AMARR" | "HEK" | "RENS" | "CN";
export type CycleStatus = "PLANNED" | "OPEN" | "COMPLETED";
export type ParticipationStatus =
  | "AWAITING_INVESTMENT"
  | "AWAITING_VALIDATION"
  | "OPTED_IN"
  | "OPTED_OUT"
  | "AWAITING_PAYOUT"
  | "COMPLETED"
  | "REFUNDED";

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
  memo: string | null;
  validatedAt: string | null;
  walletJournalId: bigint | null;
  payoutIsk: string | null;
  payoutSentAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Market & Arbitrage
// ============================================================================

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
