"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { qk } from "@eve/api-client/queryKeys";
import type {
  TradeStrategy,
  TradeStrategyRun,
  TradeStrategyRunDay,
  TradeStrategyRunPosition,
} from "@eve/shared";

export type TradeStrategyRunDetail = TradeStrategyRun & {
  strategy: TradeStrategy;
  days: TradeStrategyRunDay[];
  positions: TradeStrategyRunPosition[];
};

export type TradeStrategyWalkForwardReport = {
  batchId: string;
  strategy: { id: string; name: string };
  config: {
    startDate: string;
    endDate: string;
    trainWindowDays: number;
    testWindowDays: number;
    stepDays: number;
    maxRuns: number;
    sellModel: "VOLUME_SHARE" | "CALIBRATED_CAPTURE";
    sellSharePct: number | null;
    priceModel: "LOW" | "AVG" | "HIGH";
    initialCapitalIsk: number;
  };
  aggregates: {
    runs: number;
    completed: number;
    winRate: number | null;
    roiMedian: number | null;
    roiP10: number | null;
    roiP90: number | null;
    maxDrawdownWorst: number | null;
    profitMedianIsk: number | null;
    profitP10Isk: number | null;
    profitP90Isk: number | null;
    relistFeesMedianIsk: number | null;
    relistFeesP10Isk: number | null;
    relistFeesP90Isk: number | null;
  };
  runs: Array<{
    runId: string;
    trainStartDate: string;
    trainEndDate: string;
    testStartDate: string;
    testEndDate: string;
    status: string;
    summary: unknown;
  }>;
  blacklistSuggestions: Array<{
    typeId: number;
    typeName: string | null;
    destinationStationId: number;
    loserRuns: number;
    totalLossIsk: number;
  }>;
};

export type TradeStrategyWalkForwardAllReport = {
  globalBatchId: string;
  config: {
    startDate: string;
    endDate: string;
    trainWindowDays: number;
    testWindowDays: number;
    stepDays: number;
    maxRuns: number;
    sellModel: "VOLUME_SHARE" | "CALIBRATED_CAPTURE";
    sellSharePct: number | null;
    priceModel: "LOW" | "AVG" | "HIGH";
    initialCapitalIsk: number;
    nameContains: string | null;
  };
  results: Array<{
    strategyId: string;
    strategyName: string;
    report: TradeStrategyWalkForwardReport;
  }>;
  globalBlacklistSuggestions: Array<{
    typeId: number;
    typeName: string | null;
    destinationStationId: number;
    loserRuns: number;
    strategies: string[];
    totalLossIsk: number;
  }>;
};

export type TradeStrategyLabSweepReport = {
  globalSweepId: string;
  config: {
    startDate: string;
    endDate: string;
    trainWindowDays: number;
    testWindowDays: number;
    stepDays: number;
    maxRuns: number;
    sellModel: "VOLUME_SHARE" | "CALIBRATED_CAPTURE";
    priceModels: Array<"LOW" | "AVG" | "HIGH">;
    sellSharePcts: number[];
    initialCapitalIsk: number;
    nameContains: string | null;
  };
  scenarios: Array<{
    priceModel: "LOW" | "AVG" | "HIGH";
    sellSharePct: number;
  }>;
  results: Array<{
    strategyId: string;
    strategyName: string;
    overallScore: number | null;
    scenarioScores: Array<{
      scenario: { priceModel: "LOW" | "AVG" | "HIGH"; sellSharePct: number };
      roiMedian: number | null;
      worstDD: number | null;
      winRate: number | null;
      relistFeesMedianIsk: number | null;
      score: number | null;
    }>;
  }>;
};

export function useTradeStrategies() {
  const client = useApiClient();
  return useQuery({
    queryKey: ["strategyLab", "strategies"],
    queryFn: () => client.get<TradeStrategy[]>("/strategy-lab/strategies"),
  });
}

export function useCreateTradeStrategy() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      params: unknown;
      isActive?: boolean;
    }) => client.post<TradeStrategy>("/strategy-lab/strategies", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strategyLab", "strategies"] });
    },
  });
}

export function useTradeStrategyRuns() {
  const client = useApiClient();
  return useQuery({
    queryKey: ["strategyLab", "runs"],
    queryFn: () =>
      client.get<
        Array<TradeStrategyRun & { strategy: { id: string; name: string } }>
      >("/strategy-lab/runs"),
  });
}

export function useTradeStrategyRun(runId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: ["strategyLab", "run", runId],
    queryFn: () =>
      client.get<TradeStrategyRunDetail>(`/strategy-lab/runs/${runId}`),
    enabled: !!runId,
  });
}

export function useCreateTradeStrategyRun() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      strategyId: string;
      startDate: string;
      endDate: string;
      initialCapitalIsk: number;
      sellModel: "VOLUME_SHARE" | "CALIBRATED_CAPTURE";
      sellSharePct?: number;
      priceModel?: "LOW" | "AVG" | "HIGH";
    }) => client.post<TradeStrategyRunDetail>("/strategy-lab/runs", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strategyLab", "runs"] });
      // Not adding to shared qk yet; keep local keys until we decide to extend qk.
      qc.invalidateQueries({ queryKey: qk.arbitrage._root });
    },
  });
}

export function useTradeStrategyWalkForward() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      strategyId: string;
      startDate: string;
      endDate: string;
      initialCapitalIsk: number;
      trainWindowDays: number;
      testWindowDays: number;
      stepDays?: number;
      maxRuns?: number;
      sellModel: "VOLUME_SHARE" | "CALIBRATED_CAPTURE";
      sellSharePct?: number;
      priceModel?: "LOW" | "AVG" | "HIGH";
    }) =>
      client.post<TradeStrategyWalkForwardReport>(
        "/strategy-lab/walk-forward",
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strategyLab", "runs"] });
    },
  });
}

export function useTradeStrategyWalkForwardAll() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      startDate: string;
      endDate: string;
      initialCapitalIsk: number;
      trainWindowDays: number;
      testWindowDays: number;
      stepDays?: number;
      maxRuns?: number;
      nameContains?: string;
      sellModel: "VOLUME_SHARE" | "CALIBRATED_CAPTURE";
      sellSharePct?: number;
      priceModel?: "LOW" | "AVG" | "HIGH";
    }) =>
      client.post<TradeStrategyWalkForwardAllReport>(
        "/strategy-lab/walk-forward/all",
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strategyLab", "runs"] });
    },
  });
}

export function useTradeStrategyLabSweep() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (data: {
      startDate: string;
      endDate: string;
      initialCapitalIsk: number;
      trainWindowDays: number;
      testWindowDays: number;
      stepDays?: number;
      maxRuns?: number;
      nameContains?: string;
      sellModel: "VOLUME_SHARE" | "CALIBRATED_CAPTURE";
      sellSharePcts: number[];
      priceModels: Array<"LOW" | "AVG" | "HIGH">;
    }) =>
      client.post<TradeStrategyLabSweepReport>("/strategy-lab/lab-sweep", data),
  });
}
