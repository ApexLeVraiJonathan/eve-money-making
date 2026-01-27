"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { useApiClient } from "@/app/api-hooks/useApiClient";

export type NpcMarketStatusResponse = {
  config: {
    enabled: boolean;
    stationId: number;
    pollMinutes: number;
    expiryWindowMinutes: number;
  };
  cron: {
    appEnv: "dev" | "test" | "prod";
    jobsEnabled: boolean;
    jobEnabled: boolean;
    jobEnabledSourceKey: string | null;
    effectiveEnabled: boolean;
  };
  resolvedStation: null | {
    stationId: number;
    stationName: string;
    solarSystemId: number;
    solarSystemName: string;
    regionId: number;
  };
  latestSnapshot: null | {
    observedAt: string;
    orderCount: number;
    buyCount: number;
    sellCount: number;
    uniqueTypes: number;
  };
  latestAggregateDay: string | null;
  activeBaseline: null | {
    baselineId: string;
    observedAt: string;
    regionId: number;
  };
  lastRun: null | {
    baselineId: string;
    startedAt: string;
    finishedAt: string | null;
    ok: boolean;
    typeCount: number | null;
    errorMessage: string | null;
  };
};

export type NpcMarketOrder = {
  duration: number;
  is_buy_order: boolean;
  issued: string;
  location_id: number;
  min_volume: number;
  order_id: number;
  price: number;
  range: string;
  type_id: number;
  volume_remain: number;
  volume_total: number;
};

export type NpcMarketSnapshotLatestResponse = {
  stationId: number | null;
  baselineId: string | null;
  observedAt: string | null;
  totalOrders: number;
  matchedOrders: number;
  filteredOrders: number;
  typeNames?: Record<string, string>;
  orders: NpcMarketOrder[];
};

export type NpcMarketSnapshotTypeSummaryResponse = {
  stationId: number | null;
  baselineId: string | null;
  observedAt: string | null;
  side?: "ALL" | "BUY" | "SELL";
  types: Array<{
    typeId: number;
    typeName: string | null;
    sellCount: number;
    buyCount: number;
    bestSell: number | null;
    bestBuy: number | null;
  }>;
};

export type NpcMarketDailyAggregatesResponse = {
  stationId: number | null;
  date: string | null;
  hasGone?: boolean;
  side?: "ALL" | "BUY" | "SELL";
  typeNames?: Record<string, string>;
  rows: Array<{
    scanDate: string;
    stationId: number;
    typeId: number;
    isBuyOrder: boolean;
    hasGone: boolean;
    amount: string;
    orderNum: string;
    iskValue: string;
    high: string;
    low: string;
    avg: string;
  }>;
};

export type NpcMarketCollectResponse = {
  ok: true;
  stationId: number;
  regionId: number;
  baselineId: string;
  observedAt: string;
  typeCount: number;
  durationMs: number;
  aggregateKeys: number;
  hadPreviousBaseline: boolean;
};

export function useNpcMarketStatus(params?: { stationId?: number }) {
  const client = useApiClient();
  const qs = new URLSearchParams();
  if (params?.stationId) qs.set("stationId", String(params.stationId));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return useAuthenticatedQuery({
    queryKey: ["npcMarket", "status", params ?? {}],
    queryFn: () =>
      client.get<NpcMarketStatusResponse>(`/npc-market/status${suffix}`),
    staleTime: 10_000,
  });
}

export function useNpcMarketCollect() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { stationId?: number; forceRefresh?: boolean }) => {
      const qs = new URLSearchParams();
      if (params.stationId) qs.set("stationId", String(params.stationId));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return client.post<NpcMarketCollectResponse>(
        `/npc-market/collect${suffix}`,
        {
          forceRefresh: params.forceRefresh,
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["npcMarket"] });
    },
  });
}

export function useNpcMarketSnapshotLatestTypeSummary(
  params: {
    stationId?: number;
    limitTypes: number;
    side: "ALL" | "BUY" | "SELL";
  },
  opts?: { enabled?: boolean },
) {
  const client = useApiClient();
  const qs = new URLSearchParams();
  qs.set("limitTypes", String(params.limitTypes));
  qs.set("side", params.side);
  if (params.stationId) qs.set("stationId", String(params.stationId));
  return useAuthenticatedQuery({
    queryKey: ["npcMarket", "snapshotLatestTypeSummary", params],
    queryFn: () =>
      client.get<NpcMarketSnapshotTypeSummaryResponse>(
        `/npc-market/snapshot/latest/types?${qs.toString()}`,
      ),
    staleTime: 10_000,
    enabled: opts?.enabled,
  });
}

export function useNpcMarketSnapshotLatest(
  params: {
    stationId?: number;
    typeId?: number;
    limit: number;
    side: "ALL" | "BUY" | "SELL";
  },
  opts?: { enabled?: boolean },
) {
  const client = useApiClient();
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit));
  qs.set("side", params.side);
  if (params.stationId) qs.set("stationId", String(params.stationId));
  if (params.typeId) qs.set("typeId", String(params.typeId));
  return useAuthenticatedQuery({
    queryKey: ["npcMarket", "snapshotLatest", params],
    queryFn: () =>
      client.get<NpcMarketSnapshotLatestResponse>(
        `/npc-market/snapshot/latest?${qs.toString()}`,
      ),
    staleTime: 10_000,
    enabled: opts?.enabled,
  });
}

export function useNpcMarketDailyAggregates(params: {
  stationId?: number;
  date: string; // YYYY-MM-DD
  hasGone: boolean;
  side: "ALL" | "BUY" | "SELL";
  typeId?: number;
  limit: number;
}) {
  const client = useApiClient();
  const qs = new URLSearchParams();
  qs.set("date", params.date);
  qs.set("hasGone", String(params.hasGone));
  qs.set("side", params.side);
  qs.set("limit", String(params.limit));
  if (params.stationId) qs.set("stationId", String(params.stationId));
  if (params.typeId) qs.set("typeId", String(params.typeId));
  return useAuthenticatedQuery({
    queryKey: ["npcMarket", "daily", params],
    queryFn: () =>
      client.get<NpcMarketDailyAggregatesResponse>(
        `/npc-market/aggregates/daily?${qs.toString()}`,
      ),
    staleTime: 10_000,
  });
}
