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
    sellShareSummary: {
      bySellShare: Array<{
        sellSharePct: number;
        scoreMedianAcrossPriceModels: number | null;
        roiMedianAcrossPriceModels: number | null;
        worstDDMedianAcrossPriceModels: number | null;
        relistFeesMedianIskAcrossPriceModels: number | null;
      }>;
      robustScoreMedianAcrossSellShares: number | null;
      robustScoreMinAcrossSellShares: number | null;
      scoreAtMinSellShare: number | null;
    };
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

export type TradeStrategyCycleWalkForwardAllReport = {
  settings: {
    startDate: string;
    cycles: number;
    cycleDays: number;
    initialCapitalIsk: number;
    sellModel: "VOLUME_SHARE";
    sellSharePct: number;
    priceModel: "LOW" | "AVG" | "HIGH";
    rebuyTriggerCashPct: number;
    reserveCashPct: number;
    repricesPerDay: number;
    skipRepriceIfMarginPctLeq: number;
    inventoryMode: "IGNORE" | "SKIP_EXISTING" | "TOP_OFF";
    singleBuy: boolean;
    nameContains: string | null;
  };
  results: Array<{
    strategyId: string;
    strategyName: string;
    totalProfitIsk: number;
    totalProfitCashIsk: number;
    avgProfitIskPerCycle: number;
    avgProfitCashIskPerCycle: number;
    cycles: Array<{
      cycleIndex: number;
      startDate: string;
      endDate: string;
      profitIsk: number;
      profitCashIsk: number;
      roiPct: number | null;
      capitalStartIsk: number;
      capitalEndIsk: number;
      cashStartIsk: number;
      inventoryCostStartIsk: number;
      cashEndIsk: number;
      inventoryCostEndIsk: number;
      cashPctMin: number;
      cashPctMax: number;
      buyEvents: number;
      buyDates: string[];
      totalSpendIsk: number;
      totalShippingIsk: number;
      relistFeesPaidIsk: number;
      repricesApplied: number;
      repricesSkippedRed: number;
      unitsSold: number;
      grossSalesIsk: number;
      salesNetIsk: number;
      avgNetSellPerUnitIsk: number | null;
      salesTaxIsk: number;
      brokerFeesIsk: number;
      cogsIsk: number;
      positionsHeldEnd: number;
    }>;
    notes: string[];
  }>;
};

export type TradeStrategyCycleRobustnessReport = {
  config: {
    startDateFrom: string;
    startDateTo: string;
    stepDays: number;
    maxDays: number;
    initialCapitalIsk: number;
    sellSharePct: number;
    priceModel: "LOW" | "AVG" | "HIGH";
    repricesPerDay: number;
    skipRepriceIfMarginPctLeq: number;
    inventoryMode: "IGNORE" | "SKIP_EXISTING" | "TOP_OFF";
    nameContains: string | null;
  };
  starts: string[];
  blacklist: {
    globalTypeIds?: number[];
    byDestinationTypeIds?: Record<string, number[]>;
  } | null;
  reports: {
    noBlacklist: {
      label: "NO_BLACKLIST";
      results: Array<{
        strategyId: string;
        strategyName: string;
        runs: number;
        lossRate: number | null;
        profitP10Isk: number | null;
        profitMedianIsk: number | null;
        profitP90Isk: number | null;
        best: { startDate: string; profitCashIsk: number } | null;
        worst: { startDate: string; profitCashIsk: number } | null;
      }>;
      repeatOffenders: Array<{
        typeId: number;
        typeName: string | null;
        destinationStationId: number;
        stationName: string | null;
        runs: number;
        loserRuns: number;
        redRuns: number;
        totalProfitCashIsk: number;
        totalLossCashIsk: number;
        strategies: string[];
      }>;
    };
    withBlacklist: {
      label: "WITH_BLACKLIST";
      results: Array<{
        strategyId: string;
        strategyName: string;
        runs: number;
        lossRate: number | null;
        profitP10Isk: number | null;
        profitMedianIsk: number | null;
        profitP90Isk: number | null;
        best: { startDate: string; profitCashIsk: number } | null;
        worst: { startDate: string; profitCashIsk: number } | null;
      }>;
      repeatOffenders: Array<{
        typeId: number;
        typeName: string | null;
        destinationStationId: number;
        stationName: string | null;
        runs: number;
        loserRuns: number;
        redRuns: number;
        totalProfitCashIsk: number;
        totalLossCashIsk: number;
        strategies: string[];
      }>;
    } | null;
  };
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

export function useDeactivateTradeStrategies() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nameContains?: string }) =>
      client.post<{ deactivated: number }>(
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
      client.post<{ deletedStrategies: number }>(
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
    queryFn: () =>
      client.get<
        Array<TradeStrategyRun & { strategy: { id: string; name: string } }>
      >("/strategy-lab/runs"),
  });
}

export function useClearTradeStrategyRuns() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nameContains?: string }) =>
      client.post<{ deletedRuns: number }>("/strategy-lab/runs/clear", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strategyLab", "runs"] });
    },
  });
}

export type StrategyLabMarketDataCoverage = {
  requested: { startDate: string; endDate: string; days: number };
  available: { minDate: string | null; maxDate: string | null };
  coverage: { haveDays: number; missingDays: number; isComplete: boolean };
  missingDates?: string[];
};

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
