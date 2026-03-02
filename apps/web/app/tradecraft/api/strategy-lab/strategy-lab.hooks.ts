"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { qk } from "@eve/api-client/queryKeys";
import type {
  TradeStrategy,
  TradeStrategyRun,
  TradeStrategyRunDay,
  TradeStrategyRunPosition,
} from "@eve/shared/tradecraft-strategy-lab";
import type {
  StrategyLabMarketDataCoverage,
  TradeStrategyClearResponse,
  TradeStrategyClearRunsResponse,
  TradeStrategyDeactivateResponse,
  TradeStrategyCycleRobustnessReport,
  TradeStrategyCycleWalkForwardAllReport,
  TradeStrategyLabSweepReport,
  TradeStrategyRunDetail,
  TradeStrategyRunListItem,
  TradeStrategyWalkForwardAllReport,
  TradeStrategyWalkForwardReport,
} from "@eve/shared/tradecraft-strategy-lab";
export type {
  StrategyLabMarketDataCoverage,
  TradeStrategyCycleRobustnessReport,
  TradeStrategyCycleWalkForwardAllReport,
  TradeStrategyDeactivateResponse,
  TradeStrategyClearResponse,
  TradeStrategyClearRunsResponse,
  TradeStrategyLabSweepReport,
  TradeStrategyRunDetail,
  TradeStrategyRunListItem,
  TradeStrategyWalkForwardAllReport,
  TradeStrategyWalkForwardReport,
} from "@eve/shared/tradecraft-strategy-lab";

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

export function useDeactivateTradeStrategies() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nameContains?: string }) =>
      client.post<TradeStrategyDeactivateResponse>(
        "/strategy-lab/strategies/deactivate",
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strategyLab", "strategies"] });
    },
  });
}

export function useClearTradeStrategies() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nameContains?: string }) =>
      client.post<TradeStrategyClearResponse>(
        "/strategy-lab/strategies/clear",
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strategyLab", "strategies"] });
      qc.invalidateQueries({ queryKey: ["strategyLab", "runs"] });
    },
  });
}

export function useTradeStrategyRuns() {
  const client = useApiClient();
  return useQuery({
    queryKey: ["strategyLab", "runs"],
    queryFn: () => client.get<TradeStrategyRunListItem[]>("/strategy-lab/runs"),
  });
}

export function useClearTradeStrategyRuns() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nameContains?: string }) =>
      client.post<TradeStrategyClearRunsResponse>(
        "/strategy-lab/runs/clear",
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strategyLab", "runs"] });
    },
  });
}

export function useStrategyLabMarketDataCoverage(params: {
  startDate: string;
  days: number;
}) {
  const client = useApiClient();
  return useQuery({
    queryKey: [
      "strategyLab",
      "marketDataCoverage",
      params.startDate,
      params.days,
    ],
    queryFn: () =>
      client.get<StrategyLabMarketDataCoverage>(
        `/strategy-lab/market-data-coverage?startDate=${encodeURIComponent(
          params.startDate,
        )}&days=${encodeURIComponent(String(params.days))}`,
      ),
    enabled:
      !!params.startDate &&
      params.startDate.length === 10 &&
      Number.isFinite(params.days) &&
      params.days > 0,
    staleTime: 30_000,
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

export function useTradeStrategyCycleWalkForwardAll() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (data: {
      startDate: string;
      cycles: number;
      cycleDays?: number;
      initialCapitalIsk: number;
      rebuyTriggerCashPct?: number;
      reserveCashPct?: number;
      repricesPerDay?: number;
      skipRepriceIfMarginPctLeq?: number;
      inventoryMode?: "IGNORE" | "SKIP_EXISTING" | "TOP_OFF";
      nameContains?: string;
      singleBuy?: boolean;
      sellModel: "VOLUME_SHARE";
      sellSharePct: number;
      priceModel?: "LOW" | "AVG" | "HIGH";
    }) =>
      client.post<TradeStrategyCycleWalkForwardAllReport>(
        "/strategy-lab/cycle-walk-forward/all",
        data,
      ),
  });
}

export function useTradeStrategyCycleRobustness() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (data: {
      startDateFrom: string;
      startDateTo: string;
      stepDays?: number;
      maxDays?: number;
      initialCapitalIsk: number;
      sellSharePct: number;
      repricesPerDay?: number;
      skipRepriceIfMarginPctLeq?: number;
      inventoryMode?: "IGNORE" | "SKIP_EXISTING" | "TOP_OFF";
      nameContains?: string;
      priceModel?: "LOW" | "AVG" | "HIGH";
      blacklist?: {
        globalTypeIds?: number[];
        byDestinationTypeIds?: Record<string, number[]>;
      };
    }) =>
      client.post<TradeStrategyCycleRobustnessReport>(
        "/strategy-lab/cycle-walk-forward/robustness",
        data,
      ),
  });
}
