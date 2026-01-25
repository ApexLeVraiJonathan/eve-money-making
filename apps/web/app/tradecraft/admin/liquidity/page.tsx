"use client";
import { useState } from "react";
import { Button } from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import { Input } from "@eve/ui";
import { LabeledInput } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import {
  TrendingUp,
  BarChart3,
  Loader2,
  AlertCircle,
  Search,
  Navigation,
  ArrowUp,
} from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eve/ui";
import {
  useLiquidityCheck,
  useLiquidityItemStats,
  useTrackedStations,
} from "../../api";
import { ParameterProfileManager } from "../../components/ParameterProfileManager";
import type {
  LiquidityCheckRequest,
  LiquidityCheckResponse,
  LiquidityItemStatsRequest,
  LiquidityItemStatsResponse,
  LiquidityItemDto,
} from "@eve/shared/types";

export default function LiquidityPage() {
  const [mode, setMode] = useState<"check" | "itemStats">("check");
  const [error, setError] = useState<string | null>(null);

  // Station Liquidity Scan state
  const [stationId, setStationId] = useState<number | null>(null);
  // Default to 7d because our market-trades ingestion is often recent-window only;
  // 30d + coverage ratio can legitimately yield zero items when only ~7-15d exist.
  const [windowDays, setWindowDays] = useState<number>(7);
  const [minCoverageRatio, setMinCoverageRatio] = useState<number>(0.57);
  const [minLiquidityThresholdISK, setMinLiquidityThresholdISK] =
    useState<number>(1000000);
  const [minWindowTrades, setMinWindowTrades] = useState<number>(5);
  const [checkResult, setCheckResult] = useState<LiquidityCheckResponse | null>(
    null,
  );

  // Item Stats state
  const [itemId, setItemId] = useState<number | null>(null);
  const [itemName, setItemName] = useState<string>("");
  const [itemStatsStationId, setItemStatsStationId] = useState<number | null>(
    null,
  );
  const [itemStatsStationName, setItemStatsStationName] = useState<string>("");
  const [itemStatsWindowDays, setItemStatsWindowDays] = useState<number>(7);
  const [isBuyOrder, setIsBuyOrder] = useState<boolean>(false);
  const [itemStatsResult, setItemStatsResult] =
    useState<LiquidityItemStatsResponse | null>(null);

  // React Query hooks
  const { data: stations = [] } = useTrackedStations();
  const liquidityCheckMutation = useLiquidityCheck();
  const liquidityItemStatsMutation = useLiquidityItemStats();

  // Helper to get current parameters as an object
  const getCurrentParams = () => ({
    stationId,
    windowDays,
    minCoverageRatio,
    minLiquidityThresholdISK,
    minWindowTrades,
  });

  // Helper to load parameters from a profile
  const handleLoadProfile = (params: Record<string, unknown>) => {
    // Always set all values, including clearing optional ones if not in profile
    setStationId((params.stationId as number) || null);
    setWindowDays((params.windowDays as number) || 7);
    setMinCoverageRatio((params.minCoverageRatio as number) || 0.57);
    setMinLiquidityThresholdISK(
      (params.minLiquidityThresholdISK as number) || 1000000,
    );
    setMinWindowTrades((params.minWindowTrades as number) || 5);
  };

  const onRunCheck = async () => {
    setError(null);
    setCheckResult(null);
    try {
      const request: LiquidityCheckRequest = {
        windowDays,
        minCoverageRatio,
        minLiquidityThresholdISK,
        minWindowTrades,
      };
      if (stationId) {
        request.station_id = stationId;
      }
      const data = await liquidityCheckMutation.mutateAsync(request);
      setCheckResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const onRunItemStats = async () => {
    setError(null);
    setItemStatsResult(null);
    try {
      if (!itemName.trim() && !itemId) {
        setError("Please enter an item name or item ID");
        return;
      }
      const request: LiquidityItemStatsRequest = {
        windowDays: itemStatsWindowDays,
        isBuyOrder,
      };
      if (itemId) {
        request.itemId = itemId;
      }
      if (itemName.trim()) {
        request.itemName = itemName.trim();
      }
      if (itemStatsStationId) {
        request.stationId = itemStatsStationId;
      }
      if (itemStatsStationName.trim()) {
        request.stationName = itemStatsStationName.trim();
      }
      const data = await liquidityItemStatsMutation.mutateAsync(request);
      setItemStatsResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  // Sort stations in specific order: Dodixie -> Hek -> Rens -> Amarr -> Others
  const stationOrder = ["Dodixie", "Hek", "Rens", "Amarr"];
  const sortedStations = [...stations].sort((a, b) => {
    const aName = a.station?.name ?? "";
    const bName = b.station?.name ?? "";

    // Find position in priority list
    const aIndex = stationOrder.findIndex((station) => aName.includes(station));
    const bIndex = stationOrder.findIndex((station) => bName.includes(station));

    // If both are in priority list, sort by priority
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // If only A is in priority list, A comes first
    if (aIndex !== -1) return -1;
    // If only B is in priority list, B comes first
    if (bIndex !== -1) return 1;
    // Neither in priority list, sort alphabetically
    return aName.localeCompare(bName);
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <TrendingUp className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Liquidity Analysis
          </h1>
          <p className="text-sm text-muted-foreground">
            Analyze market liquidity and trading volumes
          </p>
        </div>
      </div>

      {/* Mode Tabs */}
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as "check" | "itemStats")}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="check">Station Liquidity Scan</TabsTrigger>
          <TabsTrigger value="itemStats">Item Liquidity Stats</TabsTrigger>
        </TabsList>

        {/* Station Liquidity Scan Mode */}
        <TabsContent value="check" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Scan Configuration
                  </CardTitle>
                  <CardDescription>
                    Find liquid items at tracked stations based on trading
                    volume and frequency
                  </CardDescription>
                </div>
                <ParameterProfileManager
                  scope="LIQUIDITY"
                  currentParams={getCurrentParams()}
                  onLoadProfile={handleLoadProfile}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <LabeledInput
                label="Station"
                tooltip="Select a specific station to analyze, or leave empty to scan all tracked stations in the system."
              >
                <Select
                  value={stationId?.toString() ?? "all"}
                  onValueChange={(value) =>
                    setStationId(value === "all" ? null : Number(value))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All tracked stations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tracked stations</SelectItem>
                    {sortedStations.map((s) => (
                      <SelectItem key={s.id} value={s.stationId.toString()}>
                        {s.station?.name ?? s.stationId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledInput>

              <LabeledInput
                label="Time Window (days)"
                tooltip="Number of days to look back when calculating average daily trade volumes. Longer windows provide more stable averages but may miss recent market changes."
              >
                <Input
                  type="number"
                  value={windowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                  min="1"
                  placeholder="e.g., 30"
                />
              </LabeledInput>

              <LabeledInput
                label="Minimum Coverage Ratio"
                tooltip="Fraction of days in the time window that must have recorded trades (0-1). For example, 0.57 means the item must have traded on at least 57% of days in the window. Higher values ensure more consistent trading activity."
              >
                <Input
                  type="number"
                  value={minCoverageRatio}
                  onChange={(e) => setMinCoverageRatio(Number(e.target.value))}
                  min="0"
                  max="1"
                  step="0.01"
                  placeholder="e.g., 0.57"
                />
              </LabeledInput>

              <LabeledInput
                label="Minimum Daily ISK Volume"
                tooltip="Minimum average ISK value that must be traded per day. Items below this threshold will be filtered out. Use this to focus on items with meaningful trading volumes."
              >
                <Input
                  type="number"
                  value={minLiquidityThresholdISK}
                  onChange={(e) =>
                    setMinLiquidityThresholdISK(Number(e.target.value))
                  }
                  min="0"
                  placeholder="e.g., 1000000 (1M ISK/day)"
                />
              </LabeledInput>

              <LabeledInput
                label="Minimum Trades Per Day"
                tooltip="Minimum average number of individual trades that must occur per day. Higher values indicate more active markets with frequent transactions."
              >
                <Input
                  type="number"
                  value={minWindowTrades}
                  onChange={(e) => setMinWindowTrades(Number(e.target.value))}
                  min="0"
                  placeholder="e.g., 5"
                />
              </LabeledInput>

              <Button
                onClick={onRunCheck}
                disabled={liquidityCheckMutation.isPending}
                className="gap-2 w-full sm:w-auto"
              >
                {liquidityCheckMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Run Scan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {checkResult &&
            (() => {
              // Sort stations in specific order: Dodixie -> Hek -> Rens -> Amarr -> Others
              const stationOrder = ["Dodixie", "Hek", "Rens", "Amarr"];
              const sortedEntries = Object.entries(checkResult).sort(
                ([, a], [, b]) => {
                  const aName = a.stationName;
                  const bName = b.stationName;

                  // Find position in priority list
                  const aIndex = stationOrder.findIndex((station) =>
                    aName.includes(station),
                  );
                  const bIndex = stationOrder.findIndex((station) =>
                    bName.includes(station),
                  );

                  // If both are in priority list, sort by priority
                  if (aIndex !== -1 && bIndex !== -1) {
                    return aIndex - bIndex;
                  }
                  // If only A is in priority list, A comes first
                  if (aIndex !== -1) return -1;
                  // If only B is in priority list, B comes first
                  if (bIndex !== -1) return 1;
                  // Neither in priority list, sort alphabetically
                  return aName.localeCompare(bName);
                },
              );

              return (
                <div className="space-y-4">
                  {/* Sticky station navigation bar */}
                  {sortedEntries.length > 1 && (
                    <div className="sticky top-0 z-50 bg-card border rounded-lg shadow-md p-3 mb-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Navigation className="h-4 w-4" />
                            <span>Jump to:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {sortedEntries.map(([stationIdStr, group]) => (
                              <Button
                                key={stationIdStr}
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const element = document.getElementById(
                                    `station-${stationIdStr}`,
                                  );
                                  if (element) {
                                    // Calculate offset to account for sticky header height
                                    const navHeight = 80; // Approximate height of sticky bar
                                    const elementPosition =
                                      element.getBoundingClientRect().top +
                                      window.scrollY;
                                    const offsetPosition =
                                      elementPosition - navHeight;

                                    window.scrollTo({
                                      top: offsetPosition,
                                      behavior: "smooth",
                                    });
                                  }
                                }}
                              >
                                {group.stationName.split(" ")[0]}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }}
                          className="shrink-0"
                        >
                          <ArrowUp className="h-4 w-4 mr-1" />
                          Parameters
                        </Button>
                      </div>
                    </div>
                  )}

                  <h2 className="text-lg font-semibold">
                    Results ({sortedEntries.length} station
                    {sortedEntries.length !== 1 ? "s" : ""})
                  </h2>
                  {sortedEntries.map(([stationIdStr, group]) => (
                    <Card key={stationIdStr} id={`station-${stationIdStr}`}>
                      <CardHeader>
                        <CardTitle>{group.stationName}</CardTitle>
                        <CardDescription>
                          {group.totalItems} liquid item
                          {group.totalItems !== 1 ? "s" : ""}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="py-2 px-3 text-left">Item</th>
                                <th className="py-2 px-3 text-right">
                                  Avg Daily Vol
                                </th>
                                <th className="py-2 px-3 text-right">
                                  Avg Daily Trades
                                </th>
                                <th className="py-2 px-3 text-right">
                                  Coverage Days
                                </th>
                                <th className="py-2 px-3 text-right">
                                  Latest Avg Price
                                </th>
                                <th className="py-2 px-3 text-right">
                                  Avg Daily ISK
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map(
                                (item: LiquidityItemDto, idx) => (
                                  <tr
                                    key={idx}
                                    className="border-b hover:bg-muted/50 transition-colors"
                                  >
                                    <td className="py-2 px-3">
                                      {item.typeName ?? item.typeId}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                      {item.avgDailyAmount.toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                      {item.avgDailyTrades}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                      {item.coverageDays} / {windowDays}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                      {item.latest
                                        ? formatIsk(Number(item.latest.avg))
                                        : "—"}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                      {formatIsk(item.avgDailyIskValue)}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
        </TabsContent>

        {/* Item Stats Mode */}
        <TabsContent value="itemStats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Item Configuration
              </CardTitle>
              <CardDescription>
                Get detailed historical statistics for a specific item
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LabeledInput
                label="Item Name"
                tooltip="Name of the item to analyze (e.g., 'Tritanium'). You can use either item name or item ID below."
              >
                <Input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g., Tritanium"
                />
              </LabeledInput>

              <LabeledInput
                label="Item ID (Alternative)"
                tooltip="EVE Online type ID of the item. Use this if you know the exact ID, otherwise use the item name above."
              >
                <Input
                  type="number"
                  value={itemId ?? ""}
                  onChange={(e) =>
                    setItemId(e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="e.g., 34"
                  min="1"
                />
              </LabeledInput>

              <LabeledInput
                label="Station"
                tooltip="Select a specific station to analyze, or leave empty to get stats from all tracked stations."
              >
                <Select
                  value={itemStatsStationId?.toString() ?? "all"}
                  onValueChange={(value) =>
                    setItemStatsStationId(
                      value === "all" ? null : Number(value),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All tracked stations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tracked stations</SelectItem>
                    {sortedStations.map((s) => (
                      <SelectItem key={s.id} value={s.stationId.toString()}>
                        {s.station?.name ?? s.stationId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledInput>

              <LabeledInput
                label="Station Name (Alternative)"
                tooltip="Full name of the station (e.g., 'Jita IV - Moon 4 - Caldari Navy Assembly Plant'). Use this as an alternative to selecting from the dropdown above."
              >
                <Input
                  type="text"
                  value={itemStatsStationName}
                  onChange={(e) => setItemStatsStationName(e.target.value)}
                  placeholder="e.g., Jita IV - Moon 4 - Caldari Navy Assembly Plant"
                />
              </LabeledInput>

              <LabeledInput
                label="Time Window (days)"
                tooltip="Number of days of historical data to retrieve. Each day's trading data will be shown separately in the results."
              >
                <Input
                  type="number"
                  value={itemStatsWindowDays}
                  onChange={(e) =>
                    setItemStatsWindowDays(Number(e.target.value))
                  }
                  min="1"
                  placeholder="e.g., 7"
                />
              </LabeledInput>

              <LabeledInput
                label="Order Side"
                tooltip="Choose whether to analyze buy orders (where players are buying from you) or sell orders (where you're buying from players). Sell orders typically show market prices."
              >
                <Select
                  value={isBuyOrder ? "buy" : "sell"}
                  onValueChange={(value) => setIsBuyOrder(value === "buy")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sell">Sell Orders</SelectItem>
                    <SelectItem value="buy">Buy Orders</SelectItem>
                  </SelectContent>
                </Select>
              </LabeledInput>

              <Button
                onClick={onRunItemStats}
                disabled={liquidityItemStatsMutation.isPending}
                className="gap-2 w-full sm:w-auto"
              >
                {liquidityItemStatsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Get Stats
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {itemStatsResult &&
            (() => {
              // Sort stations in specific order: Dodixie -> Hek -> Rens -> Amarr -> Others
              const stationOrder = ["Dodixie", "Hek", "Rens", "Amarr"];
              const sortedStatsEntries = Object.entries(itemStatsResult).sort(
                ([, a], [, b]) => {
                  const aName = a.stationName;
                  const bName = b.stationName;

                  // Find position in priority list
                  const aIndex = stationOrder.findIndex((station) =>
                    aName.includes(station),
                  );
                  const bIndex = stationOrder.findIndex((station) =>
                    bName.includes(station),
                  );

                  // If both are in priority list, sort by priority
                  if (aIndex !== -1 && bIndex !== -1) {
                    return aIndex - bIndex;
                  }
                  // If only A is in priority list, A comes first
                  if (aIndex !== -1) return -1;
                  // If only B is in priority list, B comes first
                  if (bIndex !== -1) return 1;
                  // Neither in priority list, sort alphabetically
                  return aName.localeCompare(bName);
                },
              );

              return (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">
                    Stats for {itemName || `Item #${itemId}`} (
                    {sortedStatsEntries.length} station
                    {sortedStatsEntries.length !== 1 ? "s" : ""})
                  </h2>
                  {sortedStatsEntries.map(([stationIdStr, stationData]) => (
                    <Card key={stationIdStr}>
                      <CardHeader>
                        <CardTitle>{stationData.stationName}</CardTitle>
                        <CardDescription>
                          Daily trade data over {itemStatsWindowDays} days
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Sell Data */}
                        {stationData.sell && (
                          <div>
                            <h3 className="font-medium mb-2">Sell Orders</h3>
                            <div className="text-sm text-muted-foreground mb-2">
                              Average:{" "}
                              {stationData.sell.windowAverages.amountAvg}{" "}
                              units/day,{" "}
                              {formatIsk(
                                stationData.sell.windowAverages.iskValueAvg,
                              )}{" "}
                              ISK/day
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="py-2 px-3 text-left">
                                      Date
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      Amount
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      High
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      Low
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      Avg
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      Trades
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      ISK Value
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stationData.sell.perDay.map((day, idx) => (
                                    <tr
                                      key={idx}
                                      className="border-b hover:bg-muted/50"
                                    >
                                      <td className="py-2 px-3">{day.date}</td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {day.amount.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {formatIsk(Number(day.high))}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {formatIsk(Number(day.low))}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {formatIsk(Number(day.avg))}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {day.orderNum}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {formatIsk(Number(day.iskValue))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Buy Data */}
                        {stationData.buy && (
                          <div>
                            <h3 className="font-medium mb-2">Buy Orders</h3>
                            <div className="text-sm text-muted-foreground mb-2">
                              Average:{" "}
                              {stationData.buy.windowAverages.amountAvg}{" "}
                              units/day,{" "}
                              {formatIsk(
                                stationData.buy.windowAverages.iskValueAvg,
                              )}{" "}
                              ISK/day
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="py-2 px-3 text-left">
                                      Date
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      Amount
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      High
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      Low
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      Avg
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      Trades
                                    </th>
                                    <th className="py-2 px-3 text-right">
                                      ISK Value
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stationData.buy.perDay.map((day, idx) => (
                                    <tr
                                      key={idx}
                                      className="border-b hover:bg-muted/50"
                                    >
                                      <td className="py-2 px-3">{day.date}</td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {day.amount.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {formatIsk(Number(day.high))}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {formatIsk(Number(day.low))}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {formatIsk(Number(day.avg))}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {day.orderNum}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums">
                                        {formatIsk(Number(day.iskValue))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
