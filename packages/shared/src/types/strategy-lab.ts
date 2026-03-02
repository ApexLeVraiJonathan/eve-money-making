export type TradeStrategyRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type TradeStrategySellModel = "VOLUME_SHARE" | "CALIBRATED_CAPTURE";
export type TradeStrategyPriceModel = "LOW" | "AVG" | "HIGH";

export interface TradeStrategy {
  id: string;
  name: string;
  description: string | null;
  params: unknown;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeStrategyRun {
  id: string;
  strategyId: string;
  status: TradeStrategyRunStatus;
  startDate: string;
  endDate: string;
  initialCapitalIsk: string;
  sellModel: TradeStrategySellModel;
  sellSharePct: string | null;
  priceModel: TradeStrategyPriceModel;
  assumptions: unknown | null;
  summary: unknown | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeStrategyRunDay {
  id: string;
  runId: string;
  date: string;
  cashIsk: string;
  inventoryCostIsk: string;
  inventoryMarkIsk: string;
  realizedProfitIsk: string;
  unrealizedProfitIsk: string;
  navIsk: string;
  createdAt: string;
}

export interface TradeStrategyRunPosition {
  id: string;
  runId: string;
  destinationStationId: number;
  typeId: number;
  typeName?: string;
  plannedUnits: number;
  buyUnitPriceIsk: string;
  unitsSold: number;
  unitsRemaining: number;
  costBasisIskRemaining: string;
  realizedProfitIsk: string;
  createdAt: string;
  updatedAt: string;
}
