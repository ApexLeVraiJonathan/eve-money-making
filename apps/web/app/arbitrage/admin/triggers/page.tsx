"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Database, PlayCircle, DollarSign, Wrench } from "lucide-react";
import type {
  TriggerState,
  TrackedStation,
  ImportSummary,
  MarketStaleness,
  MatchResult,
  CycleSnapshot,
} from "./types";
import { ImportsTab } from "./imports-tab";
import { ParticipationsTab } from "./participations-tab";
import { FinancialTab } from "./financial-tab";
import { SystemCleanupTab } from "./system-cleanup-tab";

export default function TriggersPage() {
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

  const triggerImport = async (
    endpoint: string,
    body?: Record<string, unknown>,
    key?: string,
  ) => {
    const loadingKey = key || endpoint;
    setLoading((prev) => ({ ...prev, [loadingKey]: true }));

    try {
      const res = await fetch(`/api/import/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || res.statusText);
      }

      const data = await res.json();
      toast.success(
        `Import triggered successfully: ${data.message || "Completed"}`,
      );
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

  const loadTrackedStations = async () => {
    try {
      const res = await fetch("/api/tracked-stations");
      if (!res.ok) throw new Error("Failed to load tracked stations");
      const data = (await res.json()) as TrackedStation[];
      setTrackedStations(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load tracked stations",
      );
    }
  };

  const addTrackedStation = async () => {
    if (!stationId) return;

    setLoading((prev) => ({ ...prev, ["add-station"]: true }));
    try {
      const res = await fetch("/api/tracked-stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationId: Number(stationId) }),
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || res.statusText);
      }

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
      const res = await fetch(`/api/tracked-stations/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || res.statusText);
      }

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

  const loadImportSummary = async () => {
    try {
      const res = await fetch("/api/admin/import-summary");
      if (!res.ok) throw new Error("Failed to load import summary");
      const data = (await res.json()) as ImportSummary;
      setImportSummary(data);
    } catch (error) {
      console.error("Error loading import summary:", error);
    }
  };

  const loadMarketStaleness = async () => {
    try {
      const res = await fetch("/api/jobs/staleness");
      if (!res.ok) throw new Error("Failed to load market staleness");
      const data = (await res.json()) as MarketStaleness;
      setMarketStaleness(data);
    } catch (error) {
      console.error("Error loading market staleness:", error);
    }
  };

  const loadLatestCycle = async () => {
    try {
      const resp = await fetch("/api/arbitrage/commits?limit=1");
      if (!resp.ok) return;
      const rows: Array<{
        id: string;
        closedAt?: Date | null;
      }> = await resp.json();
      const openCycle = rows.find((r) => !r.closedAt);
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
  };

  const loadSnapshots = async (cycleId: string) => {
    try {
      const res = await fetch(`/api/ledger/cycles/${cycleId}/snapshots`);
      if (!res.ok) throw new Error("Failed to load snapshots");
      const data = (await res.json()) as CycleSnapshot[];
      setSnapshots(data.slice(0, 10));
    } catch (error) {
      console.error("Failed to load snapshots:", error);
      setSnapshots([]);
    }
  };

  const createSnapshot = async () => {
    if (!currentCycleId) {
      toast.error("No active cycle found");
      return;
    }

    setLoading((prev) => ({ ...prev, ["create-snapshot"]: true }));
    try {
      const res = await fetch(`/api/ledger/cycles/${currentCycleId}/snapshot`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || res.statusText);
      }
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
        ? `/api/ledger/participations/match?cycleId=${encodeURIComponent(cycleId)}`
        : "/api/ledger/participations/match";
      const res = await fetch(url, { method: "POST" });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || res.statusText);
      }

      const data = (await res.json()) as MatchResult;
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
  }, []);

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Manual Triggers</h1>
        <p className="text-muted-foreground">
          Manually trigger imports, jobs, and administrative tasks
        </p>
      </div>

      <Tabs defaultValue="imports" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="imports" className="gap-2">
            <Database className="h-4 w-4" />
            Data Imports
          </TabsTrigger>
          <TabsTrigger value="participations" className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Participations
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="system-cleanup" className="gap-2">
            <Wrench className="h-4 w-4" />
            System Cleanup
          </TabsTrigger>
        </TabsList>

        <ImportsTab
          loading={loading}
          batchSize={batchSize}
          setBatchSize={setBatchSize}
          tradeDate={tradeDate}
          setTradeDate={setTradeDate}
          daysBack={daysBack}
          setDaysBack={setDaysBack}
          stationId={stationId}
          setStationId={setStationId}
          trackedStations={trackedStations}
          importSummary={importSummary}
          marketStaleness={marketStaleness}
          triggerImport={triggerImport}
          addTrackedStation={addTrackedStation}
          removeTrackedStation={removeTrackedStation}
        />

        <ParticipationsTab
          loading={loading}
          setLoading={setLoading}
          matchResult={matchResult}
          matchParticipationPayments={matchParticipationPayments}
        />

        <FinancialTab
          loading={loading}
          setLoading={setLoading}
          currentCycleId={currentCycleId}
          snapshots={snapshots}
          createSnapshot={createSnapshot}
        />

        <SystemCleanupTab loading={loading} setLoading={setLoading} />
      </Tabs>
    </div>
  );
}
