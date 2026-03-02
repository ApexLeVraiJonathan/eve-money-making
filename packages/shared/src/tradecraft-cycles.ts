export type CycleHistoryItem = {
  id: string;
  name: string | null;
  startedAt: string;
  closedAt: string | null;
  status: string;
  initialCapitalIsk: string;
  profitIsk: string;
  roiPercent: string;
  participantCount: number;
  durationDays: number | null;
};

export type CycleProfitBreakdown = {
  revenue: {
    grossSales: string;
    salesTax: string;
    netSales: string;
  };
  cogs: {
    totalCogs: string;
    unitsSold: number;
    avgCostPerUnit: string;
  };
  grossProfit: string;
  expenses: {
    transportFees: string;
    brokerFees: string;
    relistFees: string;
    collateralRecovery: string;
    totalExpenses: string;
  };
  netProfit: string;
  roi: {
    percentage: string;
    initialCapital: string;
  };
};

export type CycleEstimatedProfitResponse = {
  estimatedTotalProfit: string;
  breakdown: unknown[];
};

export type CyclePortfolioValueResponse = {
  totalValue: string;
  items: unknown[];
};

export type CycleNavResponse = {
  deposits: string;
  withdrawals: string;
  fees: string;
  executions: string;
  net: string;
};

export type CycleAllocateResponse = {
  buysAllocated: number;
  sellsAllocated: number;
};

export type FinalizePayoutsResponse = {
  created: number;
};

export type {
  Cycle,
  CycleFeeEvent,
  CycleLedgerEntry,
  CycleLine,
  CycleLinesIntelResponse,
  CycleLinesIntelRow,
  CycleLinesIntelTotals,
  CycleOverview,
  CycleProfit,
  CycleSnapshot,
  CapitalResponse,
  PayoutSuggestion,
} from "./types";
