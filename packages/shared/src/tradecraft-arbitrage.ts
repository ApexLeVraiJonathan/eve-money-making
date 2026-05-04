export type ArbitrageCommitResponse = {
  id: string;
  createdAt: string;
};

export type CommitSummaryItem = {
  id: string;
  typeId: number;
  typeName: string;
  quantity: number;
};

export type PlanPackagesResponse = {
  packageId: string;
  items: Array<{
    typeId: number;
    quantity: number;
    buyPrice: string;
  }>;
};

export type {
  ArbitrageCheckRequest,
  ArbitrageCheckResponse,
  Opportunity,
  PackagePlan,
  PlanResult,
} from "./types/market-arbitrage";
