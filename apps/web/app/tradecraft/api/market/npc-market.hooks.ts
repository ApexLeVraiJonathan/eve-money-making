"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import type {
  MarketSide,
  NpcMarketCollectResponse,
  NpcMarketDailyAggregatesResponse,
  NpcMarketOrder,
  NpcMarketSnapshotLatestResponse,
  NpcMarketSnapshotTypeSummaryResponse,
  NpcMarketStatusResponse,
} from "@eve/shared/tradecraft-market";
export type {
  NpcMarketCollectResponse,
  NpcMarketDailyAggregatesResponse,
  NpcMarketOrder,
  NpcMarketSnapshotLatestResponse,
  NpcMarketSnapshotTypeSummaryResponse,
  NpcMarketStatusResponse,
} from "@eve/shared/tradecraft-market";

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
    side: MarketSide;
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
    side: MarketSide;
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
