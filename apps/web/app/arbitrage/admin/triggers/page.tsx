"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Database,
  Download,
  Loader2,
  PlayCircle,
  Calendar,
  Package,
  MapPin,
  Trash2,
  Plus,
  Wrench,
  RefreshCw,
  Shield,
  DollarSign,
  FileCheck,
} from "lucide-react";

type TriggerState = {
  [key: string]: boolean;
};

type TrackedStation = {
  id: string;
  stationId: number;
  station: {
    id: number;
    name: string;
  };
};

type ImportSummary = {
  typeIds: number;
  regionIds: number;
  solarSystemIds: number;
  npcStationIds: number;
};

type MarketStaleness = {
  missing: string[];
  results?: Record<string, unknown>;
};

type MatchResult = {
  matched: number;
  partial: number;
  unmatched: Array<{
    journalId: string;
    characterId: number;
    amount: string;
    description: string | null;
    date: string;
  }>;
};

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
      // Reload summary and staleness after import
      await loadImportSummary();
      await loadMarketStaleness();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to trigger import";

      // Check if it's an auth error
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
    if (!stationId) {
      toast.error("Please enter a station ID");
      return;
    }

    setLoading((prev) => ({ ...prev, "add-station": true }));

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

      toast.success("Tracked station added successfully");
      setStationId("");
      await loadTrackedStations();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add station",
      );
    } finally {
      setLoading((prev) => ({ ...prev, "add-station": false }));
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

      toast.success("Tracked station removed successfully");
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
      const res = await fetch("/api/import/summary");
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
        `Matched ${data.matched} participations (${data.partial} with amount adjustments)`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to match payments";
      toast.error(errorMessage);
    } finally {
      setLoading((prev) => ({ ...prev, ["match-payments"]: false }));
    }
  };

  React.useEffect(() => {
    void loadTrackedStations();
    void loadImportSummary();
    void loadMarketStaleness();
  }, []);

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Manual Triggers</h1>
        <p className="text-muted-foreground">
          Manually trigger background jobs and data imports
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

        {/* Imports Tab */}
        <TabsContent value="imports" className="space-y-6">
          {/* Static Data Imports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Static Data
              </CardTitle>
              <CardDescription>
                Import game data from ESI (types, regions, stations)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Summary */}
              {importSummary && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <h3 className="text-sm font-medium mb-2">Current Data</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <div className="text-muted-foreground">Types</div>
                      <div className="font-mono font-medium">
                        {importSummary.typeIds.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Regions</div>
                      <div className="font-mono font-medium">
                        {importSummary.regionIds.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Systems</div>
                      <div className="font-mono font-medium">
                        {importSummary.solarSystemIds.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Stations</div>
                      <div className="font-mono font-medium">
                        {importSummary.npcStationIds.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="batch-size">Batch Size (optional)</Label>
                <Input
                  id="batch-size"
                  type="number"
                  min="1"
                  max="50000"
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  placeholder="5000"
                  className="max-w-xs"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Button
                  variant="outline"
                  onClick={() =>
                    void triggerImport("type-ids", {
                      batchSize: Number(batchSize) || undefined,
                    })
                  }
                  disabled={loading["type-ids"]}
                  className="gap-2"
                >
                  {loading["type-ids"] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Type IDs
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    void triggerImport("region-ids", {
                      batchSize: Number(batchSize) || undefined,
                    })
                  }
                  disabled={loading["region-ids"]}
                  className="gap-2"
                >
                  {loading["region-ids"] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Region IDs
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    void triggerImport("solar-system-ids", {
                      batchSize: Number(batchSize) || undefined,
                    })
                  }
                  disabled={loading["solar-system-ids"]}
                  className="gap-2"
                >
                  {loading["solar-system-ids"] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Solar Systems
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    void triggerImport("npc-station-ids", {
                      batchSize: Number(batchSize) || undefined,
                    })
                  }
                  disabled={loading["npc-station-ids"]}
                  className="gap-2"
                >
                  {loading["npc-station-ids"] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  NPC Stations
                </Button>

                <Button
                  variant="outline"
                  onClick={() => void triggerImport("type-volumes")}
                  disabled={loading["type-volumes"]}
                  className="gap-2"
                >
                  {loading["type-volumes"] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Type Volumes
                </Button>

                <Button
                  variant="default"
                  onClick={() =>
                    void triggerImport("all", {
                      batchSize: Number(batchSize) || undefined,
                    })
                  }
                  disabled={loading["all"]}
                  className="gap-2"
                >
                  {loading["all"] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}
                  Import All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tracked Stations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Tracked Stations
              </CardTitle>
              <CardDescription>
                Manage stations for market data imports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Station */}
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label htmlFor="station-id">Station ID</Label>
                  <Input
                    id="station-id"
                    type="number"
                    min="1"
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    placeholder="Enter station ID"
                    className="max-w-xs"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => void addTrackedStation()}
                    disabled={!stationId || loading["add-station"]}
                    className="gap-2"
                  >
                    {loading["add-station"] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add Station
                  </Button>
                </div>
              </div>

              {/* Station List */}
              {trackedStations.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">
                    Current Tracked Stations ({trackedStations.length})
                  </h3>
                  <div className="rounded-lg border">
                    <div className="divide-y">
                      {trackedStations.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3"
                        >
                          <div>
                            <div className="font-medium">
                              {item.station.name}
                            </div>
                            <div className="text-sm text-muted-foreground font-mono">
                              ID: {item.stationId}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void removeTrackedStation(item.id)}
                            disabled={loading[`remove-${item.id}`]}
                            className="gap-1.5 text-destructive hover:text-destructive"
                          >
                            {loading[`remove-${item.id}`] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/50 p-6 text-center">
                  <MapPin className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No tracked stations yet. Add a station to start importing
                    market data.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Market Trades */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Market Trades
              </CardTitle>
              <CardDescription>
                Import historical market order trades
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Staleness Status */}
              {marketStaleness && marketStaleness.missing.length > 0 && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                  <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                    Missing Trade Data
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {marketStaleness.missing.length} day(s) missing:{" "}
                    <span className="font-mono">
                      {marketStaleness.missing.slice(0, 3).join(", ")}
                      {marketStaleness.missing.length > 3 && "..."}
                    </span>
                  </p>
                </div>
              )}
              {marketStaleness && marketStaleness.missing.length === 0 && (
                <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    ✓ All trade data up to date (last 15 days)
                  </p>
                </div>
              )}

              {/* Import by Date */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Import by Date</h3>
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <Label htmlFor="trade-date">Date (YYYY-MM-DD)</Label>
                    <Input
                      id="trade-date"
                      type="date"
                      value={tradeDate}
                      onChange={(e) => setTradeDate(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <Label htmlFor="trade-batch">Batch Size (optional)</Label>
                    <Input
                      id="trade-batch"
                      type="number"
                      min="1"
                      max="50000"
                      value={batchSize}
                      onChange={(e) => setBatchSize(e.target.value)}
                      placeholder="5000"
                      className="max-w-xs"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() =>
                        void triggerImport(
                          "market-trades/day",
                          {
                            date: tradeDate,
                            batchSize: Number(batchSize) || undefined,
                          },
                          "market-trades-day",
                        )
                      }
                      disabled={!tradeDate || loading["market-trades-day"]}
                      className="gap-2"
                    >
                      {loading["market-trades-day"] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Import
                    </Button>
                  </div>
                </div>
              </div>

              {/* Import Missing */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Import Missing Days</h3>
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <Label htmlFor="days-back">Days Back (optional)</Label>
                    <Input
                      id="days-back"
                      type="number"
                      min="1"
                      max="365"
                      value={daysBack}
                      onChange={(e) => setDaysBack(e.target.value)}
                      placeholder="7"
                      className="max-w-xs"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <Label htmlFor="missing-batch">Batch Size (optional)</Label>
                    <Input
                      id="missing-batch"
                      type="number"
                      min="1"
                      max="50000"
                      value={batchSize}
                      onChange={(e) => setBatchSize(e.target.value)}
                      placeholder="5000"
                      className="max-w-xs"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() =>
                        void triggerImport(
                          "market-trades/missing",
                          {
                            daysBack: Number(daysBack) || undefined,
                            batchSize: Number(batchSize) || undefined,
                          },
                          "market-trades-missing",
                        )
                      }
                      disabled={loading["market-trades-missing"]}
                      className="gap-2"
                    >
                      {loading["market-trades-missing"] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Import Missing
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Participations Tab */}
        <TabsContent value="participations" className="space-y-6">
          {/* Wallet Journal Import */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Import Wallet Journals
              </CardTitle>
              <CardDescription>
                Import wallet journals for all LOGISTICS characters to get
                latest donations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h3 className="text-sm font-medium">📝 Note</h3>
                <p className="text-sm text-muted-foreground">
                  Run this before matching payments to ensure you have the
                  latest wallet data from all LOGISTICS characters.
                </p>
              </div>

              <Button
                onClick={async () => {
                  setLoading((prev) => ({ ...prev, ["import-wallets"]: true }));
                  try {
                    const res = await fetch("/api/wallet/import-all", {
                      method: "POST",
                    });
                    if (!res.ok) {
                      const error = await res
                        .json()
                        .catch(() => ({ error: "Unknown error" }));
                      throw new Error(error.error || res.statusText);
                    }
                    const data = await res.json();
                    toast.success(
                      `Wallet journals imported for ${data.count || "all"} LOGISTICS characters`,
                    );
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : "Failed to import wallet journals";
                    toast.error(errorMessage);
                  } finally {
                    setLoading((prev) => ({
                      ...prev,
                      ["import-wallets"]: false,
                    }));
                  }
                }}
                disabled={loading["import-wallets"]}
                className="gap-2 w-full sm:w-auto"
              >
                {loading["import-wallets"] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Import All Wallets
              </Button>
            </CardContent>
          </Card>

          {/* Match Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                Match Participation Payments
              </CardTitle>
              <CardDescription>
                Automatically match wallet donations to pending participations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h3 className="text-sm font-medium">How it works</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>
                    Matches player donations to AWAITING_INVESTMENT
                    participations
                  </li>
                  <li>
                    Supports fuzzy matching for typos in memos (up to 3
                    characters)
                  </li>
                  <li>Handles multiple payments with same memo (sums them)</li>
                  <li>Updates investment amount if partial/over payment</li>
                  <li>Links to actual payer character for payouts</li>
                </ul>
              </div>

              <Button
                onClick={() => void matchParticipationPayments()}
                disabled={loading["match-payments"]}
                className="gap-2 w-full sm:w-auto"
              >
                {loading["match-payments"] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Match All Payments
              </Button>

              {/* Match Results */}
              {matchResult && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <h3 className="text-sm font-medium mb-3">Match Results</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">
                          Total Matched
                        </div>
                        <div className="text-2xl font-bold text-emerald-600">
                          {matchResult.matched}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          Amount Adjusted
                        </div>
                        <div className="text-2xl font-bold text-amber-600">
                          {matchResult.partial}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Unmatched Payments */}
                  {matchResult.unmatched.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">
                        Unmatched Payments ({matchResult.unmatched.length})
                      </h3>
                      <div className="rounded-lg border">
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b bg-muted/50 sticky top-0">
                              <tr>
                                <th className="text-left p-2 font-medium">
                                  Date
                                </th>
                                <th className="text-left p-2 font-medium">
                                  Character ID
                                </th>
                                <th className="text-right p-2 font-medium">
                                  Amount (ISK)
                                </th>
                                <th className="text-left p-2 font-medium">
                                  Memo
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {matchResult.unmatched.map((u, idx) => (
                                <tr
                                  key={`${u.characterId}-${u.journalId}-${idx}`}
                                  className="border-b last:border-0 hover:bg-muted/50"
                                >
                                  <td className="p-2 font-mono text-xs">
                                    {new Date(u.date).toLocaleDateString()}
                                  </td>
                                  <td className="p-2 font-mono text-xs">
                                    {u.characterId}
                                  </td>
                                  <td className="p-2 text-right font-mono text-xs">
                                    {Number(u.amount).toLocaleString()}
                                  </td>
                                  <td className="p-2 font-mono text-xs truncate max-w-xs">
                                    {u.reason || (
                                      <span className="text-muted-foreground italic">
                                        No memo
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          {/* Wallet Import + Reconciliation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Wallet Import + Reconciliation
              </CardTitle>
              <CardDescription>
                Import wallet transactions for all LOGISTICS characters and
                automatically reconcile them with commit lines in the ledger
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-blue-500/10 p-4 space-y-2">
                <h3 className="text-sm font-medium">💡 What this does</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Fetches latest wallet transactions from EVE ESI</li>
                  <li>
                    Matches transactions to commit lines (buy/sell orders)
                  </li>
                  <li>Creates ledger entries for matched transactions</li>
                  <li>Helps track capital flow and commit execution status</li>
                </ul>
              </div>

              <Button
                onClick={async () => {
                  setLoading((prev) => ({ ...prev, ["wallet-recon"]: true }));
                  try {
                    const res = await fetch("/api/jobs/wallets/run", {
                      method: "POST",
                    });
                    if (!res.ok) {
                      const error = await res
                        .json()
                        .catch(() => ({ error: "Unknown error" }));
                      throw new Error(error.error || res.statusText);
                    }
                    await res.json();
                    toast.success(
                      "Wallet import and reconciliation completed successfully",
                    );
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : "Failed to run wallet import and reconciliation";
                    toast.error(errorMessage);
                  } finally {
                    setLoading((prev) => ({
                      ...prev,
                      ["wallet-recon"]: false,
                    }));
                  }
                }}
                disabled={loading["wallet-recon"]}
                className="w-full"
              >
                {loading["wallet-recon"] ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Run Wallet Import + Reconciliation
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Standalone Reconciliation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Reconciliation Only
              </CardTitle>
              <CardDescription>
                Run reconciliation on existing wallet transactions without
                re-importing from ESI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-amber-500/10 p-4 space-y-2">
                <h3 className="text-sm font-medium">📝 Note</h3>
                <p className="text-sm text-muted-foreground">
                  Use this if wallet transactions are already imported and you
                  just want to re-run the matching logic to ledger entries.
                  Useful after fixing data issues or updating commit lines.
                </p>
              </div>

              <Button
                onClick={async () => {
                  setLoading((prev) => ({ ...prev, ["reconcile-only"]: true }));
                  try {
                    const res = await fetch("/api/recon/reconcile", {
                      method: "POST",
                    });
                    if (!res.ok) {
                      const error = await res
                        .json()
                        .catch(() => ({ error: "Unknown error" }));
                      throw new Error(error.error || res.statusText);
                    }
                    const data = await res.json();
                    toast.success(
                      `Reconciliation completed: ${data.created || 0} ledger entries created`,
                    );
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : "Failed to run reconciliation";
                    toast.error(errorMessage);
                  } finally {
                    setLoading((prev) => ({
                      ...prev,
                      ["reconcile-only"]: false,
                    }));
                  }
                }}
                disabled={loading["reconcile-only"]}
                variant="secondary"
                className="w-full"
              >
                {loading["reconcile-only"] ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reconciling...
                  </>
                ) : (
                  <>
                    <FileCheck className="mr-2 h-4 w-4" />
                    Run Reconciliation Only
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Cleanup Tab */}
        <TabsContent value="system-cleanup" className="space-y-6">
          {/* ESI Cache Cleanup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                ESI Cache Cleanup
              </CardTitle>
              <CardDescription>
                Delete expired ESI cache entries to free up space and allow
                fresh data imports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-amber-500/10 p-4 space-y-2">
                <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  ⚠️ When to use this
                </h3>
                <ul className="text-sm text-amber-900/80 dark:text-amber-100/80 space-y-1 list-disc list-inside">
                  <li>
                    Before re-importing wallet journals if you just made a
                    payment
                  </li>
                  <li>
                    ESI caches wallet data for ~5 minutes (varies by endpoint)
                  </li>
                  <li>
                    Cleanup removes only <strong>expired</strong> entries, not
                    all cache
                  </li>
                  <li>With jobs disabled, cleanup doesn't run automatically</li>
                </ul>
              </div>

              <Button
                onClick={async () => {
                  setLoading((prev) => ({ ...prev, ["cleanup-cache"]: true }));
                  try {
                    const res = await fetch("/api/jobs/esi-cache/cleanup", {
                      method: "POST",
                    });
                    if (!res.ok) {
                      const error = await res
                        .json()
                        .catch(() => ({ error: "Unknown error" }));
                      throw new Error(error.error || res.statusText);
                    }
                    const data = await res.json();
                    toast.success(
                      `Cleaned up ${data.deleted || 0} expired cache entries`,
                    );
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : "Failed to cleanup cache";
                    toast.error(errorMessage);
                  } finally {
                    setLoading((prev) => ({
                      ...prev,
                      ["cleanup-cache"]: false,
                    }));
                  }
                }}
                disabled={loading["cleanup-cache"]}
                className="gap-2 w-full sm:w-auto"
                variant="outline"
              >
                {loading["cleanup-cache"] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clean Expired Cache
              </Button>
            </CardContent>
          </Card>

          {/* OAuth State Cleanup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                OAuth State Cleanup
              </CardTitle>
              <CardDescription>
                Remove expired OAuth state entries from SSO flows
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h3 className="text-sm font-medium">What this does</h3>
                <p className="text-sm text-muted-foreground">
                  OAuth states are temporary entries created during EVE SSO
                  login flows. They expire after 10 minutes but accumulate in
                  the database if jobs are disabled.
                </p>
              </div>

              <Button
                onClick={async () => {
                  setLoading((prev) => ({
                    ...prev,
                    ["cleanup-oauth"]: true,
                  }));
                  try {
                    const res = await fetch("/api/jobs/oauth-state/cleanup", {
                      method: "POST",
                    });
                    if (!res.ok) {
                      const error = await res
                        .json()
                        .catch(() => ({ error: "Unknown error" }));
                      throw new Error(error.error || res.statusText);
                    }
                    const data = await res.json();
                    toast.success(
                      `Cleaned up ${data.deleted || 0} expired OAuth states`,
                    );
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : "Failed to cleanup OAuth states";
                    toast.error(errorMessage);
                  } finally {
                    setLoading((prev) => ({
                      ...prev,
                      ["cleanup-oauth"]: false,
                    }));
                  }
                }}
                disabled={loading["cleanup-oauth"]}
                className="gap-2 w-full sm:w-auto"
                variant="outline"
              >
                {loading["cleanup-oauth"] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                Clean OAuth States
              </Button>
            </CardContent>
          </Card>

          {/* Refresh System Character Tokens */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Refresh System Character Tokens
              </CardTitle>
              <CardDescription>
                Force refresh access tokens for all LOGISTICS characters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h3 className="text-sm font-medium">When to use this</h3>
                <p className="text-sm text-muted-foreground">
                  Normally runs monthly. Use this if you suspect token issues or
                  need to ensure all system characters have fresh tokens.
                </p>
              </div>

              <Button
                onClick={async () => {
                  setLoading((prev) => ({
                    ...prev,
                    ["refresh-tokens"]: true,
                  }));
                  try {
                    const res = await fetch("/api/jobs/system-tokens/refresh", {
                      method: "POST",
                    });
                    if (!res.ok) {
                      const error = await res
                        .json()
                        .catch(() => ({ error: "Unknown error" }));
                      throw new Error(error.error || res.statusText);
                    }
                    toast.success("System character tokens refreshed");
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : "Failed to refresh tokens";
                    toast.error(errorMessage);
                  } finally {
                    setLoading((prev) => ({
                      ...prev,
                      ["refresh-tokens"]: false,
                    }));
                  }
                }}
                disabled={loading["refresh-tokens"]}
                className="gap-2 w-full sm:w-auto"
              >
                {loading["refresh-tokens"] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh All Tokens
              </Button>
            </CardContent>
          </Card>

          {/* Wallet Journal Cleanup - DEV ONLY */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete All Wallet Journals (DEV ONLY)
              </CardTitle>
              <CardDescription>
                ⚠️ DESTRUCTIVE: Removes all wallet journal entries to allow
                fresh re-import with new schema fields
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
                <h3 className="text-sm font-medium text-destructive">
                  ⚠️ Warning - Data Loss
                </h3>
                <ul className="text-sm text-destructive/90 space-y-1 list-disc list-inside">
                  <li>
                    Deletes <strong>ALL</strong> wallet journal entries from the
                    database
                  </li>
                  <li>
                    Use this when schema changes require fresh data import
                  </li>
                  <li>
                    After cleanup, re-import wallets to get new fields (like
                    'reason')
                  </li>
                  <li>
                    <strong>Dev/Testing only</strong> - not for production use
                  </li>
                </ul>
              </div>

              <Button
                onClick={async () => {
                  const confirmed = window.confirm(
                    "⚠️ DELETE ALL WALLET JOURNALS?\n\nThis will permanently delete all wallet journal entries from the database. You will need to re-import wallets after this.\n\nAre you sure you want to continue?",
                  );
                  if (!confirmed) return;

                  setLoading((prev) => ({
                    ...prev,
                    ["cleanup-wallets"]: true,
                  }));
                  try {
                    const res = await fetch("/api/jobs/wallet/cleanup", {
                      method: "POST",
                    });
                    if (!res.ok) {
                      const error = await res
                        .json()
                        .catch(() => ({ error: "Unknown error" }));
                      throw new Error(error.error || res.statusText);
                    }
                    const data = await res.json();
                    toast.success(
                      `Deleted ${data.deleted || 0} wallet journal entries`,
                    );
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : "Failed to cleanup wallet journals";
                    toast.error(errorMessage);
                  } finally {
                    setLoading((prev) => ({
                      ...prev,
                      ["cleanup-wallets"]: false,
                    }));
                  }
                }}
                disabled={loading["cleanup-wallets"]}
                className="gap-2 w-full sm:w-auto"
                variant="destructive"
              >
                {loading["cleanup-wallets"] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete All Wallet Journals
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
