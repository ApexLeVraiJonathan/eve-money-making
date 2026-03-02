"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@eve/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eve/ui";
import { AlertCircle, TrendingUp } from "lucide-react";
import {
  useLiquidityCheck,
  useLiquidityItemStats,
  useTrackedStations,
} from "../../../api";
import type {
  LiquidityCheckRequest,
  LiquidityCheckResponse,
  LiquidityItemStatsRequest,
  LiquidityItemStatsResponse,
} from "@eve/shared/tradecraft-pricing";
import { sortTrackedStationsByPriority } from "../../../lib/station-sorting";
import { StationLiquidityTab } from "./sections/station-liquidity-tab";
import { ItemLiquidityStatsTab } from "./sections/item-liquidity-stats-tab";

type StationOption = {
  id: string | number;
  stationId: number;
  station?: { name?: string | null } | null;
};

export default function LiquidityPageClient() {
  const [mode, setMode] = useState<"check" | "itemStats">("check");
  const [error, setError] = useState<string | null>(null);

  const [stationId, setStationId] = useState<number | null>(null);
  const [windowDays, setWindowDays] = useState<number>(7);
  const [minCoverageRatio, setMinCoverageRatio] = useState<number>(0.57);
  const [minLiquidityThresholdISK, setMinLiquidityThresholdISK] =
    useState<number>(1000000);
  const [minWindowTrades, setMinWindowTrades] = useState<number>(5);
  const [checkResult, setCheckResult] = useState<LiquidityCheckResponse | null>(
    null,
  );

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

  const { data: stations = [] } = useTrackedStations();
  const liquidityCheckMutation = useLiquidityCheck();
  const liquidityItemStatsMutation = useLiquidityItemStats();

  const getCurrentParams = () => ({
    stationId,
    windowDays,
    minCoverageRatio,
    minLiquidityThresholdISK,
    minWindowTrades,
  });

  const handleLoadProfile = (params: Record<string, unknown>) => {
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
      if (itemId) request.itemId = itemId;
      if (itemName.trim()) request.itemName = itemName.trim();
      if (itemStatsStationId) request.stationId = itemStatsStationId;
      if (itemStatsStationName.trim())
        request.stationName = itemStatsStationName.trim();

      const data = await liquidityItemStatsMutation.mutateAsync(request);
      setItemStatsResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const sortedStations = sortTrackedStationsByPriority(
    stations as StationOption[],
  );

  return (
    <div className="p-6 space-y-6">
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

      <Tabs value={mode} onValueChange={(v) => setMode(v as "check" | "itemStats")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="check">Station Liquidity Scan</TabsTrigger>
          <TabsTrigger value="itemStats">Item Liquidity Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="check" className="space-y-4">
          <StationLiquidityTab
            stationId={stationId}
            setStationId={setStationId}
            windowDays={windowDays}
            setWindowDays={setWindowDays}
            minCoverageRatio={minCoverageRatio}
            setMinCoverageRatio={setMinCoverageRatio}
            minLiquidityThresholdISK={minLiquidityThresholdISK}
            setMinLiquidityThresholdISK={setMinLiquidityThresholdISK}
            minWindowTrades={minWindowTrades}
            setMinWindowTrades={setMinWindowTrades}
            sortedStations={sortedStations}
            onRunCheck={onRunCheck}
            isPending={liquidityCheckMutation.isPending}
            getCurrentParams={getCurrentParams}
            handleLoadProfile={handleLoadProfile}
            checkResult={checkResult}
          />
        </TabsContent>

        <TabsContent value="itemStats" className="space-y-4">
          <ItemLiquidityStatsTab
            itemId={itemId}
            setItemId={setItemId}
            itemName={itemName}
            setItemName={setItemName}
            itemStatsStationId={itemStatsStationId}
            setItemStatsStationId={setItemStatsStationId}
            itemStatsStationName={itemStatsStationName}
            setItemStatsStationName={setItemStatsStationName}
            itemStatsWindowDays={itemStatsWindowDays}
            setItemStatsWindowDays={setItemStatsWindowDays}
            isBuyOrder={isBuyOrder}
            setIsBuyOrder={setIsBuyOrder}
            sortedStations={sortedStations}
            onRunItemStats={onRunItemStats}
            isPending={liquidityItemStatsMutation.isPending}
            itemStatsResult={itemStatsResult}
          />
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
