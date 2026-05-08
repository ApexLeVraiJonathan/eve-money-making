"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import type {
  MarketDataAnomaliesResponse,
  MarketDataCleanupResponse,
  MarketDataHealthResponse,
  MarketDataReadinessResponse,
  MarketDataSpaceReportResponse,
} from "@eve/shared/tradecraft-market";

export type {
  MarketDataAnomaliesResponse,
  MarketDataCleanupResponse,
  MarketDataHealthResponse,
  MarketDataReadinessResponse,
  MarketDataSpaceReportResponse,
} from "@eve/shared/tradecraft-market";

export function useMarketDataSpaceReport() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["marketData", "space"],
    queryFn: () =>
      client.get<MarketDataSpaceReportResponse>("/market-data/space"),
    staleTime: 30_000,
  });
}

export function useCleanupRawNpcMarketData() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      client.post<MarketDataCleanupResponse>("/market-data/cleanup/raw-npc", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketData"] });
    },
  });
}

export function useMarketDataHealth(params: {
  startDate: string;
  endDate: string;
}) {
  const client = useApiClient();
  const qs = new URLSearchParams();
  qs.set("startDate", params.startDate);
  qs.set("endDate", params.endDate);
  return useAuthenticatedQuery({
    queryKey: ["marketData", "health", params],
    queryFn: () =>
      client.get<MarketDataHealthResponse>(`/market-data/health?${qs.toString()}`),
    staleTime: 30_000,
  });
}

export function useMarketDataAnomalies() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["marketData", "anomalies"],
    queryFn: () =>
      client.get<MarketDataAnomaliesResponse>("/market-data/anomalies"),
    staleTime: 30_000,
  });
}

export function useMarketDataReadiness() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["marketData", "readiness"],
    queryFn: () =>
      client.get<MarketDataReadinessResponse>("/market-data/readiness"),
    staleTime: 30_000,
  });
}

