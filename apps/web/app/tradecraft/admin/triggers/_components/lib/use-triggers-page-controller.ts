"use client";

import * as React from "react";
import { toast } from "@eve/ui";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import type {
  ImportMissingMarketTradesResponse,
  ImportMarketTradesDayResult,
} from "@eve/shared/tradecraft-data-ops";
import type { MessageResponse } from "@eve/shared/tradecraft-ops";
import type {
  TriggerState,
  TrackedStation,
  ImportSummary,
  MarketStaleness,
  MatchResult,
  CycleSnapshot,
} from "../../types";
import { buildMissingTradesNote } from "./missing-trades-note";

type TriggerImportBody = Record<string, unknown> | undefined;

export function useTriggersPageController() {
  const client = useApiClient();
  const [loading, setLoading] = React.useState<TriggerState>({});
  const [batchSize, setBatchSize] = React.useState("5000");
  const [tradeDate, setTradeDate] = React.useState("");
  const [daysBack, setDaysBack] = React.useState("15");
  const [stationId, setStationId] = React.useState("");
  const [trackedStations, setTrackedStations] = React.useState<
    TrackedStation[]
  >([]);
  const [importSummary, setImportSummary] =
    React.useState<ImportSummary | null>(null);
  const [marketStaleness, setMarketStaleness] =
    React.useState<MarketStaleness | null>(null);
  const [matchResult, setMatchResult] = React.useState<MatchResult | null>(
    null,
  );
  const [snapshots, setSnapshots] = React.useState<CycleSnapshot[]>([]);
  const [currentCycleId, setCurrentCycleId] = React.useState<string>("");
  const [missingTradesNote, setMissingTradesNote] = React.useState<
    string | null
  >(null);

  const loadImportSummary = React.useCallback(async () => {
    try {
      const data = await client.get<ImportSummary>("/import/summary");
      setImportSummary(data);
    } catch (error) {
      console.error("Error loading import summary:", error);
    }
  }, [client]);

  const loadMarketStaleness = React.useCallback(async () => {
    try {
      const data = await client.post<MarketStaleness>("/jobs/staleness", {});
      setMarketStaleness(data);
    } catch (error) {
      console.error("Error loading market staleness:", error);
    }
  }, [client]);

  const triggerImport = async (
    endpoint: string,
    body?: TriggerImportBody,
    key?: string,
  ) => {
    const loadingKey = key || endpoint;
    setLoading((prev) => ({ ...prev, [loadingKey]: true }));

    try {
      if (endpoint === "market-trades/missing") {
        const data = await client.post<ImportMissingMarketTradesResponse>(
          `/import/${endpoint}`,
          body,
        );

        const entries = Object.entries(data.results ?? {}) as Array<
          [string, ImportMarketTradesDayResult]
        >;
        const total = entries.length;
        const successes = entries.filter(([, value]) => value.ok).length;
        const failures = total - successes;

        setMissingTradesNote(
          buildMissingTradesNote(entries, successes, failures),
        );

        toast.success(
          "Missing day imports completed. See note below for details.",
        );
      } else {
        const data = await client.post<MessageResponse>(
          `/import/${endpoint}`,
          body,
        );
        toast.success(
          `Import triggered successfully: ${data.message || "Completed"}`,
        );
      }
      await loadImportSummary();
      await loadMarketStaleness();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to trigger import";

      if (
        errorMessage.includes("authenticated") ||
        errorMessage.includes("401")
      ) {
        toast.error(
          "Session expired. Please refresh the page and log in again.",
        );
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  const loadTrackedStations = React.useCallback(async () => {
    try {
      const data = await client.get<TrackedStation[]>("/tracked-stations");
      setTrackedStations(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load tracked stations",
      );
    }
  }, [client]);

  const addTrackedStation = async () => {
    if (!stationId) return;

    setLoading((prev) => ({ ...prev, ["add-station"]: true }));
    try {
      await client.post("/tracked-stations", { stationId: Number(stationId) });
      toast.success("Station added successfully");
      setStationId("");
      await loadTrackedStations();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add station",
      );
    } finally {
      setLoading((prev) => ({ ...prev, ["add-station"]: false }));
    }
  };

  const removeTrackedStation = async (id: string) => {
    setLoading((prev) => ({ ...prev, [`remove-${id}`]: true }));
    try {
      await client.delete(`/tracked-stations/${id}`);
      toast.success("Station removed successfully");
      await loadTrackedStations();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove station",
      );
    } finally {
      setLoading((prev) => ({ ...prev, [`remove-${id}`]: false }));
    }
  };

  const loadSnapshots = React.useCallback(
    async (cycleId: string) => {
      try {
        const data = await client.get<CycleSnapshot[]>(
          `/ledger/cycles/${cycleId}/snapshots`,
        );
        setSnapshots(data.slice(0, 10));
      } catch (error) {
        console.error("Failed to load snapshots:", error);
        setSnapshots([]);
      }
    },
    [client],
  );

  const loadLatestCycle = React.useCallback(async () => {
    try {
      const rows = await client.get<
        Array<{ id: string; status: "PLANNED" | "OPEN" | "COMPLETED" }>
      >("/ledger/cycles?limit=1");
      const openCycle = rows.find((r) => r.status === "OPEN");
      if (openCycle) {
        setCurrentCycleId(openCycle.id);
        await loadSnapshots(openCycle.id);
      } else if (rows.length > 0) {
        setCurrentCycleId(rows[0].id);
        await loadSnapshots(rows[0].id);
      }
    } catch (error) {
      console.error("Failed to load latest cycle:", error);
    }
  }, [client, loadSnapshots]);

  const createSnapshot = async () => {
    if (!currentCycleId) {
      toast.error("No active cycle found");
      return;
    }

    setLoading((prev) => ({ ...prev, ["create-snapshot"]: true }));
    try {
      await client.post(`/ledger/cycles/${currentCycleId}/snapshot`, {});
      toast.success("Snapshot created successfully");
      await loadSnapshots(currentCycleId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create snapshot";
      toast.error(errorMessage);
    } finally {
      setLoading((prev) => ({ ...prev, ["create-snapshot"]: false }));
    }
  };

  const matchParticipationPayments = async (cycleId?: string) => {
    setLoading((prev) => ({ ...prev, ["match-payments"]: true }));
    try {
      const url = cycleId
        ? `/ledger/participations/match?cycleId=${encodeURIComponent(cycleId)}`
        : "/ledger/participations/match";
      const data = await client.post<MatchResult>(url, {});
      setMatchResult(data);
      toast.success(
        `Matched ${data.matched} payments, ${data.partial} adjusted, ${data.unmatched.length} unmatched`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to match participation payments";
      toast.error(errorMessage);
    } finally {
      setLoading((prev) => ({ ...prev, ["match-payments"]: false }));
    }
  };

  React.useEffect(() => {
    void loadTrackedStations();
    void loadImportSummary();
    void loadMarketStaleness();
    void loadLatestCycle();
  }, [
    loadTrackedStations,
    loadImportSummary,
    loadMarketStaleness,
    loadLatestCycle,
  ]);

  return {
    loading,
    batchSize,
    setBatchSize,
    tradeDate,
    setTradeDate,
    daysBack,
    setDaysBack,
    stationId,
    setStationId,
    trackedStations,
    importSummary,
    marketStaleness,
    matchResult,
    snapshots,
    currentCycleId,
    missingTradesNote,
    triggerImport,
    addTrackedStation,
    removeTrackedStation,
    createSnapshot,
    matchParticipationPayments,
  };
}
