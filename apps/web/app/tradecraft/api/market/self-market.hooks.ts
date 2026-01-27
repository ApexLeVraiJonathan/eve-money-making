"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { useApiClient } from "@/app/api-hooks/useApiClient";

export type SelfMarketStatusResponse = {
  config: {
    enabled: boolean;
    structureId: string | null;
    characterId: number | null;
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
  resolvedStructureId: string | null;
  latestSnapshot: null | {
    observedAt: string;
    orderCount: number;
    buyCount: number;
    sellCount: number;
    uniqueTypes: number;
  };
  latestAggregateDay: string | null;
};

export type SelfMarketOrder = {
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

export type SelfMarketSnapshotLatestResponse = {
  structureId: string | null;
  observedAt: string | null;
  totalOrders: number;
  matchedOrders?: number;
  filteredOrders: number;
  typeTotalOrders?: number;
  typeNames?: Record<string, string>;
  orders: SelfMarketOrder[];
};

export type SelfMarketSnapshotTypeSummaryResponse = {
  structureId: string | null;
  observedAt: string | null;
  totalOrders: number;
  matchedOrders: number;
  uniqueTypes: number;
  types: Array<{
    typeId: number;
    typeName: string | null;
    sellCount: number;
    buyCount: number;
    bestSell: number | null;
    bestBuy: number | null;
  }>;
};

export type SelfMarketDailyAggregatesResponse = {
  structureId: string | null;
  date: string | null;
  hasGone?: boolean;
  side?: "ALL" | "BUY" | "SELL";
  typeNames?: Record<string, string>;
  rows: Array<{
    scanDate: string;
    locationId: string;
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

export type SelfMarketCollectResponse = {
  ok: true;
  observedAt: string;
  orderCount: number;
  tradesKeys: number;
};

export type SelfMarketClearDailyResponse =
  | {
      ok: true;
      deleted: number;
      date: string;
      structureId: string;
    }
  | { ok: false; error: string };

export function useSelfMarketStatus() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["selfMarket", "status"],
    queryFn: () => client.get<SelfMarketStatusResponse>("/self-market/status"),
    staleTime: 10_000,
  });
}

export function useSelfMarketSnapshotLatest(
  params: {
    limit: number;
    side: "ALL" | "BUY" | "SELL";
    typeId?: number;
  },
  opts?: { enabled?: boolean },
) {
  const client = useApiClient();
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit));
  qs.set("side", params.side);
  if (params.typeId) qs.set("typeId", String(params.typeId));

  return useAuthenticatedQuery({
    queryKey: ["selfMarket", "snapshotLatest", params],
    queryFn: () =>
      client.get<SelfMarketSnapshotLatestResponse>(
        `/self-market/snapshot/latest?${qs.toString()}`,
      ),
    staleTime: 10_000,
    enabled: opts?.enabled,
  });
}

export function useSelfMarketSnapshotLatestTypeSummary(
  params: {
    limitTypes: number;
    side: "ALL" | "BUY" | "SELL";
  },
  opts?: { enabled?: boolean },
) {
  const client = useApiClient();
  const qs = new URLSearchParams();
  qs.set("limitTypes", String(params.limitTypes));
  qs.set("side", params.side);

  return useAuthenticatedQuery({
    queryKey: ["selfMarket", "snapshotLatestTypeSummary", params],
    queryFn: () =>
      client.get<SelfMarketSnapshotTypeSummaryResponse>(
        `/self-market/snapshot/latest/types?${qs.toString()}`,
      ),
    staleTime: 10_000,
    enabled: opts?.enabled,
  });
}

export function useSelfMarketDailyAggregates(params: {
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
  if (params.typeId) qs.set("typeId", String(params.typeId));

  return useAuthenticatedQuery({
    queryKey: ["selfMarket", "daily", params],
    queryFn: () =>
      client.get<SelfMarketDailyAggregatesResponse>(
        `/self-market/aggregates/daily?${qs.toString()}`,
      ),
    // Important: this query is frequently used for "what changed just now?" debugging.
    // Also, earlier bugs could have populated the cache under the wrong key. Make it
    // immediately stale so toggling filters always triggers a refetch.
    staleTime: 0,
  });
}

export function useSelfMarketCollect() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { forceRefresh?: boolean }) =>
      client.post<SelfMarketCollectResponse>("/self-market/collect", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["selfMarket"] });
    },
  });
}

export function useSelfMarketClearDailyAggregates() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { date: string }) =>
      client.post<SelfMarketClearDailyResponse>(
        `/self-market/aggregates/clear?date=${encodeURIComponent(params.date)}`,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["selfMarket"] });
    },
  });
}
