import * as React from "react";
import {
  useClearTradeStrategyRuns,
  useClearTradeStrategies,
  useCreateTradeStrategy,
  useDeactivateTradeStrategies,
  useStrategyLabMarketDataCoverage,
  useTradeStrategies,
  useTradeStrategyCycleRobustness,
  useTradeStrategyCycleWalkForwardAll,
  useTradeStrategyLabSweep,
  useTradeStrategyRuns,
  type TradeStrategyCycleRobustnessReport,
  type TradeStrategyCycleWalkForwardAllReport,
  type TradeStrategyLabSweepReport,
} from "../../../../api";
import type { RunsTabContentProps } from "../sections/runs-tab-content";
import type { StrategiesTabContentProps } from "../sections/strategies-tab-content";
import { DEFAULT_STRATEGY_PARAMS, omitUndefined } from "./strategy-params";
import type { BlacklistAutoBest, ShippingRow } from "./types";

export function useStrategyLabPageState(): {
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  runsTabProps: RunsTabContentProps;
  strategiesTabProps: StrategiesTabContentProps;
} {
  const { data: strategies = [] } = useTradeStrategies();
  const { data: runs = [] } = useTradeStrategyRuns();
  const createStrategy = useCreateTradeStrategy();
  const labSweep = useTradeStrategyLabSweep();
  const cycleWalkForwardAll = useTradeStrategyCycleWalkForwardAll();
  const cycleRobustness = useTradeStrategyCycleRobustness();
  const clearRuns = useClearTradeStrategyRuns();
  const deactivateStrategies = useDeactivateTradeStrategies();
  const clearStrategies = useClearTradeStrategies();

  const [newName, setNewName] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [paramsJson, setParamsJson] = React.useState(
    JSON.stringify(DEFAULT_STRATEGY_PARAMS, null, 2),
  );
  const [error, setError] = React.useState<string | null>(null);

  const [createMode, setCreateMode] = React.useState<"form" | "json">("form");
  const [showAdvancedCreate, setShowAdvancedCreate] = React.useState(false);

  const [shippingRows, setShippingRows] = React.useState<ShippingRow[]>(() =>
    Object.entries(DEFAULT_STRATEGY_PARAMS.shippingCostByStation).map(
      ([stationId, cost]) => ({ stationId, costIsk: String(cost) }),
    ),
  );
  const [packageCapacityM3, setPackageCapacityM3] = React.useState<string>(
    String(DEFAULT_STRATEGY_PARAMS.packageCapacityM3),
  );
  const [investmentISK, setInvestmentISK] = React.useState<string>(
    String(DEFAULT_STRATEGY_PARAMS.investmentISK),
  );
  const [maxPackagesHint, setMaxPackagesHint] = React.useState<string>(
    String(DEFAULT_STRATEGY_PARAMS.maxPackagesHint),
  );
  const [perItemBudgetSharePct, setPerItemBudgetSharePct] = React.useState<string>("15");
  const [maxPackageCollateralISK, setMaxPackageCollateralISK] = React.useState<string>(
    String(DEFAULT_STRATEGY_PARAMS.maxPackageCollateralISK),
  );

  const [allocationMode, setAllocationMode] = React.useState<
    "best" | "targetWeighted" | "roundRobin"
  >("best");
  const [spreadBias, setSpreadBias] = React.useState<string>("");
  const [allocationTargetsJson, setAllocationTargetsJson] = React.useState<string>("");

  const [minPackageNetProfitISK, setMinPackageNetProfitISK] = React.useState<string>("");
  const [minPackageROIPercent, setMinPackageROIPercent] = React.useState<string>("");
  const [shippingMarginMultiplier, setShippingMarginMultiplier] = React.useState<string>("");
  const [densityWeight, setDensityWeight] = React.useState<string>("");

  const [liquidityWindowDays, setLiquidityWindowDays] = React.useState<string>("14");
  const [liquidityMinCoverageRatio, setLiquidityMinCoverageRatio] = React.useState<string>("");
  const [liquidityMinLiquidityThresholdISK, setLiquidityMinLiquidityThresholdISK] =
    React.useState<string>("");
  const [liquidityMinWindowTrades, setLiquidityMinWindowTrades] = React.useState<string>("");

  const [arbMaxInventoryDays, setArbMaxInventoryDays] = React.useState<string>("3");
  const [arbMinMarginPercent, setArbMinMarginPercent] = React.useState<string>("10");
  const [arbMaxPriceDeviationMultiple, setArbMaxPriceDeviationMultiple] =
    React.useState<string>("");
  const [arbMinTotalProfitISK, setArbMinTotalProfitISK] = React.useState<string>("");
  const [arbDisableInventoryLimit, setArbDisableInventoryLimit] = React.useState<boolean>(false);
  const [arbAllowInventoryTopOff, setArbAllowInventoryTopOff] = React.useState<boolean>(false);

  const buildParamsFromForm = React.useCallback(() => {
    const num = (s: string): number | undefined => {
      const v = Number(s);
      return Number.isFinite(v) ? v : undefined;
    };
    const numOrUndef = (s: string): number | undefined =>
      s.trim() === "" ? undefined : num(s);

    const shippingCostByStation: Record<string, number> = {};
    shippingRows.forEach((row) => {
      const id = row.stationId.trim();
      const cost = numOrUndef(row.costIsk);
      if (!id || cost === undefined) return;
      shippingCostByStation[id] = cost;
    });

    const perItemShare =
      perItemBudgetSharePct.trim() === "" ? undefined : (num(perItemBudgetSharePct) ?? 0) / 100;

    let targets: Record<string, number> | undefined = undefined;
    if (allocationMode === "targetWeighted" && allocationTargetsJson.trim()) {
      targets = JSON.parse(allocationTargetsJson) as Record<string, number>;
    }

    const allocation = omitUndefined({
      mode: allocationMode,
      spreadBias: numOrUndef(spreadBias),
      targets,
    });

    const liquidityOptions = omitUndefined({
      windowDays: numOrUndef(liquidityWindowDays),
      minCoverageRatio: numOrUndef(liquidityMinCoverageRatio),
      minLiquidityThresholdISK: numOrUndef(liquidityMinLiquidityThresholdISK),
      minWindowTrades: numOrUndef(liquidityMinWindowTrades),
    });

    const arbitrageOptions = omitUndefined({
      maxInventoryDays: numOrUndef(arbMaxInventoryDays),
      minMarginPercent: numOrUndef(arbMinMarginPercent),
      maxPriceDeviationMultiple: numOrUndef(arbMaxPriceDeviationMultiple),
      minTotalProfitISK: numOrUndef(arbMinTotalProfitISK),
      disableInventoryLimit: arbDisableInventoryLimit ? true : undefined,
      allowInventoryTopOff: arbAllowInventoryTopOff ? true : undefined,
    });

    return omitUndefined({
      shippingCostByStation,
      packageCapacityM3: num(packageCapacityM3),
      investmentISK: num(investmentISK),
      maxPackagesHint: num(maxPackagesHint),
      perDestinationMaxBudgetSharePerItem: perItemShare,
      maxPackageCollateralISK: num(maxPackageCollateralISK),
      allocation,
      minPackageNetProfitISK: numOrUndef(minPackageNetProfitISK),
      minPackageROIPercent: numOrUndef(minPackageROIPercent),
      shippingMarginMultiplier: numOrUndef(shippingMarginMultiplier),
      densityWeight: numOrUndef(densityWeight),
      liquidityOptions:
        Object.keys(liquidityOptions).length > 0 ? liquidityOptions : undefined,
      arbitrageOptions:
        Object.keys(arbitrageOptions).length > 0 ? arbitrageOptions : undefined,
    });
  }, [
    allocationMode,
    allocationTargetsJson,
    arbAllowInventoryTopOff,
    arbDisableInventoryLimit,
    arbMaxInventoryDays,
    arbMaxPriceDeviationMultiple,
    arbMinMarginPercent,
    arbMinTotalProfitISK,
    densityWeight,
    investmentISK,
    liquidityMinCoverageRatio,
    liquidityMinLiquidityThresholdISK,
    liquidityMinWindowTrades,
    liquidityWindowDays,
    maxPackageCollateralISK,
    maxPackagesHint,
    minPackageNetProfitISK,
    minPackageROIPercent,
    packageCapacityM3,
    perItemBudgetSharePct,
    shippingMarginMultiplier,
    shippingRows,
    spreadBias,
  ]);

  const [startDate, setStartDate] = React.useState<string>("2025-11-24");
  const [endDate, setEndDate] = React.useState<string>("2026-01-11");
  const [initialCapital, setInitialCapital] = React.useState<string>("50000000000");
  const [sellSharePct, setSellSharePct] = React.useState<string>("0.20");
  const [sellModel, setSellModel] = React.useState<"VOLUME_SHARE" | "CALIBRATED_CAPTURE">(
    "VOLUME_SHARE",
  );
  const [priceModel, setPriceModel] = React.useState<"LOW" | "AVG" | "HIGH">("AVG");
  const [nameContains, setNameContains] = React.useState<string>("SL-");

  const [wfTrainDays, setWfTrainDays] = React.useState<string>("14");
  const [wfTestDays, setWfTestDays] = React.useState<string>("14");
  const [wfStepDays, setWfStepDays] = React.useState<string>("7");
  const [wfMaxRuns, setWfMaxRuns] = React.useState<string>("6");

  const [sweepReport, setSweepReport] = React.useState<TradeStrategyLabSweepReport | null>(null);
  const [cycleWfReport, setCycleWfReport] =
    React.useState<TradeStrategyCycleWalkForwardAllReport | null>(null);
  const [robustReport, setRobustReport] =
    React.useState<TradeStrategyCycleRobustnessReport | null>(null);

  const [cycleCount, setCycleCount] = React.useState<string>("6");
  const [cycleDays, setCycleDays] = React.useState<string>("14");
  const [rebuyTriggerCashPct, setRebuyTriggerCashPct] = React.useState<string>("0.25");
  const [reserveCashPct, setReserveCashPct] = React.useState<string>("0.02");
  const [repricesPerDay, setRepricesPerDay] = React.useState<string>("1");
  const [skipRepriceIfMarginPctLeq, setSkipRepriceIfMarginPctLeq] =
    React.useState<string>("-10");
  const [singleBuy, setSingleBuy] = React.useState<boolean>(true);
  const [inventoryMode, setInventoryMode] = React.useState<"IGNORE" | "SKIP_EXISTING" | "TOP_OFF">(
    "SKIP_EXISTING",
  );

  const requestedCycleDays = Math.max(1, Number(cycleDays) || 14);
  const requestedCycles = Math.max(1, Number(cycleCount) || 6);
  const requestedTotalDays = requestedCycleDays * requestedCycles;
  const coverage = useStrategyLabMarketDataCoverage({
    startDate,
    days: requestedTotalDays,
  });

  const [robustFrom, setRobustFrom] = React.useState<string>("2025-10-01");
  const [robustTo, setRobustTo] = React.useState<string>("2025-12-31");
  const [robustStepDays, setRobustStepDays] = React.useState<string>("2");
  const [robustMaxDays, setRobustMaxDays] = React.useState<string>("21");
  const [blacklistJson, setBlacklistJson] = React.useState<string>(
    JSON.stringify(
      {
        globalTypeIds: [],
        byDestinationTypeIds: {},
      },
      null,
      2,
    ),
  );
  const [useBlacklistCompare, setUseBlacklistCompare] = React.useState<boolean>(true);
  const [blacklistBuildFrom, setBlacklistBuildFrom] = React.useState<
    "noBlacklist" | "withBlacklist"
  >("noBlacklist");
  const [blacklistBuildMinRuns, setBlacklistBuildMinRuns] = React.useState<string>("20");
  const [blacklistBuildMinLoserRatePct, setBlacklistBuildMinLoserRatePct] =
    React.useState<string>("20");
  const [blacklistBuildMinRedRatePct, setBlacklistBuildMinRedRatePct] =
    React.useState<string>("20");
  const [blacklistBuildMode, setBlacklistBuildMode] = React.useState<"OR" | "AND">("OR");
  const [blacklistBuildMaxItems, setBlacklistBuildMaxItems] = React.useState<string>("50");
  const [blacklistAutoStatus, setBlacklistAutoStatus] = React.useState<string | null>(null);
  const [blacklistAutoBest, setBlacklistAutoBest] = React.useState<BlacklistAutoBest | null>(
    null,
  );

  const runsTabProps: RunsTabContentProps = {
    coverage,
    cycleWalkForwardAll,
    cycleRobustness,
    labSweep,
    clearRuns,
    runs,
    setError,
    startDate,
    setStartDate,
    cycleCount,
    setCycleCount,
    cycleDays,
    setCycleDays,
    initialCapital,
    setInitialCapital,
    sellSharePct,
    setSellSharePct,
    priceModel,
    setPriceModel,
    rebuyTriggerCashPct,
    setRebuyTriggerCashPct,
    reserveCashPct,
    setReserveCashPct,
    nameContains,
    setNameContains,
    repricesPerDay,
    setRepricesPerDay,
    skipRepriceIfMarginPctLeq,
    setSkipRepriceIfMarginPctLeq,
    inventoryMode,
    setInventoryMode,
    singleBuy,
    setSingleBuy,
    cycleWfReport,
    setCycleWfReport,
    robustFrom,
    setRobustFrom,
    robustTo,
    setRobustTo,
    robustStepDays,
    setRobustStepDays,
    robustMaxDays,
    setRobustMaxDays,
    useBlacklistCompare,
    setUseBlacklistCompare,
    blacklistJson,
    setBlacklistJson,
    blacklistBuildFrom,
    setBlacklistBuildFrom,
    blacklistBuildMinRuns,
    setBlacklistBuildMinRuns,
    blacklistBuildMinLoserRatePct,
    setBlacklistBuildMinLoserRatePct,
    blacklistBuildMinRedRatePct,
    setBlacklistBuildMinRedRatePct,
    blacklistBuildMode,
    setBlacklistBuildMode,
    blacklistBuildMaxItems,
    setBlacklistBuildMaxItems,
    blacklistAutoStatus,
    setBlacklistAutoStatus,
    blacklistAutoBest,
    setBlacklistAutoBest,
    robustReport,
    setRobustReport,
    wfTrainDays,
    setWfTrainDays,
    wfTestDays,
    setWfTestDays,
    wfStepDays,
    setWfStepDays,
    wfMaxRuns,
    setWfMaxRuns,
    endDate,
    setEndDate,
    sellModel,
    setSellModel,
    sweepReport,
    setSweepReport,
  };

  const strategiesTabProps: StrategiesTabContentProps = {
    createStrategy,
    deactivateStrategies,
    clearStrategies,
    strategies,
    nameContains,
    setNameContains,
    setError,
    createMode,
    setCreateMode,
    newName,
    setNewName,
    newDescription,
    setNewDescription,
    paramsJson,
    setParamsJson,
    buildParamsFromForm,
    packageCapacityM3,
    setPackageCapacityM3,
    investmentISK,
    setInvestmentISK,
    maxPackagesHint,
    setMaxPackagesHint,
    perItemBudgetSharePct,
    setPerItemBudgetSharePct,
    maxPackageCollateralISK,
    setMaxPackageCollateralISK,
    allocationMode,
    setAllocationMode,
    spreadBias,
    setSpreadBias,
    allocationTargetsJson,
    setAllocationTargetsJson,
    shippingRows,
    setShippingRows,
    showAdvancedCreate,
    setShowAdvancedCreate,
    liquidityWindowDays,
    setLiquidityWindowDays,
    liquidityMinCoverageRatio,
    setLiquidityMinCoverageRatio,
    liquidityMinLiquidityThresholdISK,
    setLiquidityMinLiquidityThresholdISK,
    liquidityMinWindowTrades,
    setLiquidityMinWindowTrades,
    arbMaxInventoryDays,
    setArbMaxInventoryDays,
    arbMinMarginPercent,
    setArbMinMarginPercent,
    arbMaxPriceDeviationMultiple,
    setArbMaxPriceDeviationMultiple,
    arbMinTotalProfitISK,
    setArbMinTotalProfitISK,
    arbDisableInventoryLimit,
    setArbDisableInventoryLimit,
    arbAllowInventoryTopOff,
    setArbAllowInventoryTopOff,
    minPackageNetProfitISK,
    setMinPackageNetProfitISK,
    minPackageROIPercent,
    setMinPackageROIPercent,
    shippingMarginMultiplier,
    setShippingMarginMultiplier,
    densityWeight,
    setDensityWeight,
  };

  return {
    error,
    setError,
    runsTabProps,
    strategiesTabProps,
  };
}
