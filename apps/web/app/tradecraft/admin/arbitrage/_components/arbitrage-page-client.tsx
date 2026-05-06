"use client";

import { useState } from "react";
import { AlertCircle, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import { useArbitrageCheck, useTrackedStations } from "../../../api/market";
import type {
  ArbitrageCheckRequest,
  ArbitrageCheckResponse,
} from "@eve/shared/tradecraft-arbitrage";
import { sortByStationPriority } from "../../../lib/station-sorting";
import { ArbitrageParametersCard } from "./sections/arbitrage-parameters-card";
import { ArbitrageResultsSection } from "./sections/arbitrage-results-section";

export default function ArbitragePageClient() {
  const arbitrageCheckMutation = useArbitrageCheck();
  const { data: stations } = useTrackedStations();

  const [liquidityWindowDays, setLiquidityWindowDays] = useState(30);
  const [liquidityMinCoverageRatio, setLiquidityMinCoverageRatio] = useState(0.7);
  const [liquidityMinLiquidityThresholdISK, setLiquidityMinLiquidityThresholdISK] =
    useState(50000000);
  const [liquidityMinWindowTrades, setLiquidityMinWindowTrades] = useState(5);
  const [sourceStationId, setSourceStationId] = useState<number | undefined>(
    undefined,
  );
  const [maxInventoryDays, setMaxInventoryDays] = useState(3);
  const [minMarginPercent, setMinMarginPercent] = useState(10);
  const [maxPriceDeviationMultiple, setMaxPriceDeviationMultiple] = useState<
    number | undefined
  >(undefined);
  const [minTotalProfitISK, setMinTotalProfitISK] = useState(1000000);
  const [salesTaxPercent, setSalesTaxPercent] = useState<number | undefined>(
    undefined,
  );
  const [brokerFeePercent, setBrokerFeePercent] = useState<number | undefined>(
    undefined,
  );
  const [disableInventoryLimit, setDisableInventoryLimit] = useState(false);
  const [allowInventoryTopOff, setAllowInventoryTopOff] = useState(false);
  const [checkResult, setCheckResult] = useState<ArbitrageCheckResponse | null>(
    null,
  );
  const [error, setError] = useState("");

  const getCurrentParams = () => ({
    liquidityWindowDays,
    liquidityMinCoverageRatio,
    liquidityMinLiquidityThresholdISK,
    liquidityMinWindowTrades,
    sourceStationId,
    maxInventoryDays,
    minMarginPercent,
    maxPriceDeviationMultiple,
    minTotalProfitISK,
    salesTaxPercent,
    brokerFeePercent,
    disableInventoryLimit,
    allowInventoryTopOff,
  });

  const handleLoadProfile = (params: Record<string, unknown>) => {
    setLiquidityWindowDays((params.liquidityWindowDays as number) || 30);
    setLiquidityMinCoverageRatio(
      (params.liquidityMinCoverageRatio as number) || 0.7,
    );
    setLiquidityMinLiquidityThresholdISK(
      (params.liquidityMinLiquidityThresholdISK as number) || 50000000,
    );
    setLiquidityMinWindowTrades(
      (params.liquidityMinWindowTrades as number) || 5,
    );
    setSourceStationId((params.sourceStationId as number) || undefined);
    setMaxInventoryDays((params.maxInventoryDays as number) || 3);
    setMinMarginPercent((params.minMarginPercent as number) || 10);
    setMaxPriceDeviationMultiple(
      (params.maxPriceDeviationMultiple as number) || undefined,
    );
    setMinTotalProfitISK((params.minTotalProfitISK as number) || 1000000);
    setSalesTaxPercent((params.salesTaxPercent as number) || undefined);
    setBrokerFeePercent((params.brokerFeePercent as number) || undefined);
    setDisableInventoryLimit(
      (params.disableInventoryLimit as boolean) || false,
    );
    setAllowInventoryTopOff((params.allowInventoryTopOff as boolean) || false);
  };

  const onRunCheck = async () => {
    setError("");
    setCheckResult(null);

    const payload: ArbitrageCheckRequest = {
      liquidityWindowDays: liquidityWindowDays || undefined,
      liquidityMinCoverageRatio: liquidityMinCoverageRatio || undefined,
      liquidityMinLiquidityThresholdISK:
        liquidityMinLiquidityThresholdISK || undefined,
      liquidityMinWindowTrades: liquidityMinWindowTrades || undefined,
      sourceStationId: sourceStationId || undefined,
      maxInventoryDays: maxInventoryDays || undefined,
      minMarginPercent: minMarginPercent || undefined,
      maxPriceDeviationMultiple: maxPriceDeviationMultiple || undefined,
      minTotalProfitISK: minTotalProfitISK || undefined,
      salesTaxPercent: salesTaxPercent || undefined,
      brokerFeePercent: brokerFeePercent || undefined,
      disableInventoryLimit: disableInventoryLimit || undefined,
      allowInventoryTopOff: allowInventoryTopOff || undefined,
    };

    try {
      const res = await arbitrageCheckMutation.mutateAsync(payload);
      setCheckResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    }
  };

  const sortedStations = stations ? sortByStationPriority(stations) : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Arbitrage Check</h1>
      </div>

      <ArbitrageParametersCard
        liquidityWindowDays={liquidityWindowDays}
        setLiquidityWindowDays={setLiquidityWindowDays}
        liquidityMinCoverageRatio={liquidityMinCoverageRatio}
        setLiquidityMinCoverageRatio={setLiquidityMinCoverageRatio}
        liquidityMinLiquidityThresholdISK={liquidityMinLiquidityThresholdISK}
        setLiquidityMinLiquidityThresholdISK={setLiquidityMinLiquidityThresholdISK}
        liquidityMinWindowTrades={liquidityMinWindowTrades}
        setLiquidityMinWindowTrades={setLiquidityMinWindowTrades}
        sourceStationId={sourceStationId}
        setSourceStationId={setSourceStationId}
        maxInventoryDays={maxInventoryDays}
        setMaxInventoryDays={setMaxInventoryDays}
        minMarginPercent={minMarginPercent}
        setMinMarginPercent={setMinMarginPercent}
        maxPriceDeviationMultiple={maxPriceDeviationMultiple}
        setMaxPriceDeviationMultiple={setMaxPriceDeviationMultiple}
        minTotalProfitISK={minTotalProfitISK}
        setMinTotalProfitISK={setMinTotalProfitISK}
        salesTaxPercent={salesTaxPercent}
        setSalesTaxPercent={setSalesTaxPercent}
        brokerFeePercent={brokerFeePercent}
        setBrokerFeePercent={setBrokerFeePercent}
        disableInventoryLimit={disableInventoryLimit}
        setDisableInventoryLimit={setDisableInventoryLimit}
        allowInventoryTopOff={allowInventoryTopOff}
        setAllowInventoryTopOff={setAllowInventoryTopOff}
        sortedStations={sortedStations}
        onRunCheck={onRunCheck}
        isPending={arbitrageCheckMutation.isPending}
        getCurrentParams={getCurrentParams}
        handleLoadProfile={handleLoadProfile}
      />

      <ArbitrageResultsSection checkResult={checkResult} />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
