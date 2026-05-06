import type { Cycle } from "./types/cycles.js";

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

export type CycleSettlementStepName =
  | "wallet_import"
  | "transaction_allocation"
  | "rollover_buyback"
  | "close_previous_cycle"
  | "payout_creation"
  | "cycle_rollover";

export type CycleSettlementStepKind = "strict" | "recoverable";

export type CycleSettlementStepStatus = "succeeded" | "failed" | "skipped";

export type CycleSettlementStepReport = {
  name: CycleSettlementStepName;
  kind: CycleSettlementStepKind;
  status: CycleSettlementStepStatus;
  durationMs?: number;
  message?: string;
};

export type CycleSettlementReport = {
  settledCycleId: string | null;
  targetCycleId: string | null;
  steps: CycleSettlementStepReport[];
  recoverableFailures: CycleSettlementStepReport[];
};

export type CycleLifecycleResponse = {
  cycle: Cycle;
  settlementReport: CycleSettlementReport;
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
} from "./types/cycles.js";
