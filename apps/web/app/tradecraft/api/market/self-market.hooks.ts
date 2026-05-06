"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import type {
  MarketSide,
  SelfMarketClearDailyResponse,
  SelfMarketCollectResponse,
  SelfMarketDailyAggregatesResponse,
  SelfMarketSnapshotLatestResponse,
  SelfMarketSnapshotTypeSummaryResponse,
  SelfMarketStatusResponse,
} from "@eve/shared/tradecraft-market";
export type {
  SelfMarketClearDailyResponse,
  SelfMarketCollectResponse,
  SelfMarketDailyAggregatesResponse,
  SelfMarketOrder,
  SelfMarketSnapshotLatestResponse,
  SelfMarketSnapshotTypeSummaryResponse,
  SelfMarketStatusResponse,
} from "@eve/shared/tradecraft-market";

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
    side: MarketSide;
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
    side: MarketSide;
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
  side: MarketSide;
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
