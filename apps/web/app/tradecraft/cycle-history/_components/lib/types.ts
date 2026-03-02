import type { CycleHistoryItem } from "@eve/shared/tradecraft-cycles";

export type CycleHistoryCycle = CycleHistoryItem;

export type CycleHistoryMetrics = {
  totalCycles: number;
  averageDurationDays: number;
  totalProfitIsk: number;
  averageRoiPercent: number;
  profitableCycles: number;
  winRatePercent: number;
};
