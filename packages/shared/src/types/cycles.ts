import type { CycleStatus } from "./core-enums.js";

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
  typeName?: string;
  destinationStationId: number;
  destinationStationName?: string;
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
  unitsRemaining?: number;
  wacUnitCost?: string;
  lineProfitExclTransport?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CycleLinesIntelRow {
  typeId: number;
  typeName: string;
  destinationStationId?: number;
  destinationStationName?: string;
  isRollover?: boolean;
  unitsBought: number;
  unitsSold: number;
  unitsRemaining: number;
  buyCostIsk: string;
  cogsSoldIsk: string;
  wacUnitCostIsk: string;
  salesNetIsk: string;
  feesIsk: string;
  profitIsk: string;
  inventoryCostRemainingIsk: string;
  expectedProfitIsk?: string;
  currentSellPriceIsk?: string | null;
  marketLowSellIsk?: string | null;
  estimatedMarginPercentAtMarket?: string | null;
  estimatedProfitAtMarketIsk?: string | null;
}

export interface CycleLinesIntelTotals {
  unitsBought: number;
  unitsSold: number;
  unitsRemaining: number;
  buyCostIsk: string;
  cogsSoldIsk: string;
  inventoryCostRemainingIsk: string;
  salesNetIsk: string;
  feesIsk: string;
  profitIsk: string;
  expectedProfitIsk?: string;
  lossIsk?: string;
}

export interface CycleLinesIntelBlock {
  profitable: { rows: CycleLinesIntelRow[]; totals: CycleLinesIntelTotals };
  potential: { rows: CycleLinesIntelRow[]; totals: CycleLinesIntelTotals };
  red: { rows: CycleLinesIntelRow[]; totals: CycleLinesIntelTotals };
}

export interface CycleLinesIntelResponse {
  cycleId: string;
  global: CycleLinesIntelBlock;
  destinations: Array<
    {
      destinationStationId: number;
      destinationStationName: string;
    } & CycleLinesIntelBlock
  >;
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
