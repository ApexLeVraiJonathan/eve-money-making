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
        <TabsList className="grid w-full max-w-md grid-cols-1">
          <TabsTrigger value="imports" className="gap-2">
            <Database className="h-4 w-4" />
            Data Imports
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
      </Tabs>
    </div>
  );
}
