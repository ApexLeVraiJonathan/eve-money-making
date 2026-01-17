"use client";

import * as React from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@eve/ui";
import { Alert, AlertDescription } from "@eve/ui";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@eve/ui";
import { LabeledInput } from "@eve/ui";
import { Checkbox } from "@eve/ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import {
  useCreateTradeStrategy,
  useTradeStrategyLabSweep,
  type TradeStrategyLabSweepReport,
  useTradeStrategyCycleWalkForwardAll,
  type TradeStrategyCycleWalkForwardAllReport,
  useTradeStrategyCycleRobustness,
  type TradeStrategyCycleRobustnessReport,
  useClearTradeStrategyRuns,
  useClearTradeStrategies,
  useDeactivateTradeStrategies,
  useStrategyLabMarketDataCoverage,
  useTradeStrategies,
  useTradeStrategyRuns,
} from "../../api";

type RunSummary = {
  totalProfitIsk?: number;
  roiPercent?: number | null;
  maxDrawdownPct?: number;
  days?: number;
};

function parseRunSummary(summary: unknown): RunSummary {
  if (!summary || typeof summary !== "object") return {};
  const s = summary as Record<string, unknown>;

  const num = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
      return Number(v);
    return undefined;
  };

  const roi = s.roiPercent;
  const roiNum =
    roi === null
      ? null
      : typeof roi === "number" && Number.isFinite(roi)
        ? roi
        : typeof roi === "string" &&
            roi.trim() !== "" &&
            Number.isFinite(Number(roi))
          ? Number(roi)
          : undefined;

  return {
    totalProfitIsk: num(s.totalProfitIsk),
    roiPercent: roiNum,
    maxDrawdownPct: num(s.maxDrawdownPct),
    days: num(s.days),
  };
}

const DEFAULT_STRATEGY_PARAMS = {
  shippingCostByStation: {
    "60004588": 20000000,
    "60005686": 15000000,
    "60008494": 25000000,
    "60011866": 15000000,
  },
  packageCapacityM3: 13000,
  investmentISK: 50000000000,
  perDestinationMaxBudgetSharePerItem: 0.15,
  maxPackagesHint: 100,
  maxPackageCollateralISK: 4000000000,
  allocation: { mode: "best" as const },
  liquidityOptions: { windowDays: 14 },
  arbitrageOptions: {
    maxInventoryDays: 3,
    minMarginPercent: 10,
  },
};

type AnyRecord = Record<string, unknown>;

function isPlainObject(v: unknown): v is AnyRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) return override ?? base;
  const out: AnyRecord = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = deepMerge((base as AnyRecord)[k], v);
  }
  return out;
}

function formatPercentFromShare(v: unknown): string {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function formatNumberLike(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim() !== "") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return "—";
}

function formatIskMaybe(v: unknown): string {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return "—";
  return formatIsk(n);
}

function StrategyParamsDialog(props: {
  strategyName: string;
  params: unknown;
}) {
  const effective = React.useMemo(() => {
    const raw = isPlainObject(props.params) ? props.params : {};
    return deepMerge(DEFAULT_STRATEGY_PARAMS, raw) as AnyRecord;
  }, [props.params]);

  const liquidity = (effective.liquidityOptions as AnyRecord) ?? {};
  const arbitrage = (effective.arbitrageOptions as AnyRecord) ?? {};
  const allocation = (effective.allocation as AnyRecord) ?? {};
  const shippingCostByStation =
    (effective.shippingCostByStation as Record<string, unknown>) ?? {};

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(effective, null, 2) + "\n",
      );
    } catch {
      // ignore (clipboard permissions)
    }
  };

  const Row = (p: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-6 py-1">
      <div className="text-sm text-muted-foreground">{p.label}</div>
      <div className="text-sm tabular-nums text-right">{p.value}</div>
    </div>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          View params
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{props.strategyName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Planner (Packaging & Allocation)
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <Row
                label="Package Capacity (m³)"
                value={formatNumberLike(effective.packageCapacityM3)}
              />
              <Row
                label="Total Investment (ISK)"
                value={formatIskMaybe(effective.investmentISK)}
              />
              <Row
                label="Max Packages"
                value={formatNumberLike(effective.maxPackagesHint)}
              />
              <Row
                label="Per-Item Budget Share (%)"
                value={formatPercentFromShare(
                  effective.perDestinationMaxBudgetSharePerItem,
                )}
              />
              <Row
                label="Max Package Collateral (ISK)"
                value={formatIskMaybe(effective.maxPackageCollateralISK)}
              />
              <Row
                label="Allocation Mode"
                value={formatNumberLike(allocation.mode)}
              />
              <Row
                label="Spread Bias"
                value={formatNumberLike(allocation.spreadBias)}
              />
              <Row
                label="Min Package Net Profit (ISK)"
                value={formatIskMaybe(effective.minPackageNetProfitISK)}
              />
              <Row
                label="Min Package ROI %"
                value={formatNumberLike(effective.minPackageROIPercent)}
              />
              <Row
                label="Shipping Margin Multiplier"
                value={formatNumberLike(effective.shippingMarginMultiplier)}
              />
              <Row
                label="Density Weight"
                value={formatNumberLike(effective.densityWeight)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Liquidity Filters
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <Row
                label="Time Window (days)"
                value={formatNumberLike(liquidity.windowDays)}
              />
              <Row
                label="Min Coverage Ratio"
                value={formatNumberLike(liquidity.minCoverageRatio)}
              />
              <Row
                label="Min Daily ISK Volume"
                value={formatIskMaybe(liquidity.minLiquidityThresholdISK)}
              />
              <Row
                label="Min Daily Trades"
                value={formatNumberLike(liquidity.minWindowTrades)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Arbitrage Constraints
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <Row
                label="Max Inventory Days"
                value={formatNumberLike(arbitrage.maxInventoryDays)}
              />
              <Row
                label="Min Margin %"
                value={formatNumberLike(arbitrage.minMarginPercent)}
              />
              <Row
                label="Max Price Deviation Multiple"
                value={formatNumberLike(arbitrage.maxPriceDeviationMultiple)}
              />
              <Row
                label="Min Total Profit (ISK)"
                value={formatIskMaybe(arbitrage.minTotalProfitISK)}
              />
              <Row
                label="Disable Inventory Limits"
                value={formatNumberLike(arbitrage.disableInventoryLimit)}
              />
              <Row
                label="Allow Inventory Top-Off"
                value={formatNumberLike(arbitrage.allowInventoryTopOff)}
              />
              <Row
                label="Destination Station IDs"
                value={formatNumberLike(arbitrage.destinationStationIds)}
              />
              <Row
                label="Exclude Destination Station IDs"
                value={formatNumberLike(arbitrage.excludeDestinationStationIds)}
              />
              <Row
                label="Sales Tax %"
                value={formatNumberLike(arbitrage.salesTaxPercent)}
              />
              <Row
                label="Broker Fee %"
                value={formatNumberLike(arbitrage.brokerFeePercent)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Shipping Cost (by Station ID)
            </div>
            <div className="rounded-md border p-3">
              {Object.keys(shippingCostByStation).length ? (
                <div className="space-y-1">
                  {Object.entries(shippingCostByStation)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([stationId, cost]) => (
                      <div
                        key={stationId}
                        className="flex items-start justify-between gap-6 py-1"
                      >
                        <div className="text-sm text-muted-foreground">
                          {stationId}
                        </div>
                        <div className="text-sm tabular-nums text-right">
                          {formatIskMaybe(cost)}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={copyJson}>
            Copy JSON
          </Button>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ShippingRow = { stationId: string; costIsk: string };

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

export default function StrategyLabPage() {
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

  // Create strategy (Planner-like form)
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
  const [perItemBudgetSharePct, setPerItemBudgetSharePct] =
    React.useState<string>("15");
  const [maxPackageCollateralISK, setMaxPackageCollateralISK] =
    React.useState<string>(
      String(DEFAULT_STRATEGY_PARAMS.maxPackageCollateralISK),
    );

  const [allocationMode, setAllocationMode] = React.useState<
    "best" | "targetWeighted" | "roundRobin"
  >("best");
  const [spreadBias, setSpreadBias] = React.useState<string>("");
  const [allocationTargetsJson, setAllocationTargetsJson] =
    React.useState<string>("");

  // Package Quality Filters
  const [minPackageNetProfitISK, setMinPackageNetProfitISK] =
    React.useState<string>("");
  const [minPackageROIPercent, setMinPackageROIPercent] =
    React.useState<string>("");
  const [shippingMarginMultiplier, setShippingMarginMultiplier] =
    React.useState<string>("");
  const [densityWeight, setDensityWeight] = React.useState<string>("");

  // Liquidity Filters
  const [liquidityWindowDays, setLiquidityWindowDays] =
    React.useState<string>("14");
  const [liquidityMinCoverageRatio, setLiquidityMinCoverageRatio] =
    React.useState<string>("");
  const [
    liquidityMinLiquidityThresholdISK,
    setLiquidityMinLiquidityThresholdISK,
  ] = React.useState<string>("");
  const [liquidityMinWindowTrades, setLiquidityMinWindowTrades] =
    React.useState<string>("");

  // Arbitrage Constraints
  const [arbMaxInventoryDays, setArbMaxInventoryDays] =
    React.useState<string>("3");
  const [arbMinMarginPercent, setArbMinMarginPercent] =
    React.useState<string>("10");
  const [arbMaxPriceDeviationMultiple, setArbMaxPriceDeviationMultiple] =
    React.useState<string>("");
  const [arbMinTotalProfitISK, setArbMinTotalProfitISK] =
    React.useState<string>("");
  const [arbDisableInventoryLimit, setArbDisableInventoryLimit] =
    React.useState<boolean>(false);
  const [arbAllowInventoryTopOff, setArbAllowInventoryTopOff] =
    React.useState<boolean>(false);

  const buildParamsFromForm = React.useCallback(() => {
    const num = (s: string): number | undefined => {
      const v = Number(s);
      return Number.isFinite(v) ? v : undefined;
    };
    const numOrUndef = (s: string): number | undefined =>
      s.trim() === "" ? undefined : num(s);

    const shippingCostByStation: Record<string, number> = {};
    for (const r of shippingRows) {
      const id = r.stationId.trim();
      const cost = numOrUndef(r.costIsk);
      if (!id || cost === undefined) continue;
      shippingCostByStation[id] = cost;
    }

    const perItemShare =
      perItemBudgetSharePct.trim() === ""
        ? undefined
        : (num(perItemBudgetSharePct) ?? 0) / 100;

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
  const [initialCapital, setInitialCapital] =
    React.useState<string>("50000000000");
  const [sellSharePct, setSellSharePct] = React.useState<string>("0.20");
  const [sellModel, setSellModel] = React.useState<
    "VOLUME_SHARE" | "CALIBRATED_CAPTURE"
  >("VOLUME_SHARE");
  const [priceModel, setPriceModel] = React.useState<"LOW" | "AVG" | "HIGH">(
    "AVG",
  );
  const [nameContains, setNameContains] = React.useState<string>("SL-");

  // Lab sweep defaults
  const [wfTrainDays, setWfTrainDays] = React.useState<string>("14");
  const [wfTestDays, setWfTestDays] = React.useState<string>("14");
  const [wfStepDays, setWfStepDays] = React.useState<string>("7");
  const [wfMaxRuns, setWfMaxRuns] = React.useState<string>("6");

  const [sweepReport, setSweepReport] =
    React.useState<TradeStrategyLabSweepReport | null>(null);
  const [cycleWfReport, setCycleWfReport] =
    React.useState<TradeStrategyCycleWalkForwardAllReport | null>(null);
  const [robustReport, setRobustReport] =
    React.useState<TradeStrategyCycleRobustnessReport | null>(null);

  const [cycleCount, setCycleCount] = React.useState<string>("6");
  const [cycleDays, setCycleDays] = React.useState<string>("14");
  const [rebuyTriggerCashPct, setRebuyTriggerCashPct] =
    React.useState<string>("0.25");
  const [reserveCashPct, setReserveCashPct] = React.useState<string>("0.02");
  const [repricesPerDay, setRepricesPerDay] = React.useState<string>("1");
  const [skipRepriceIfMarginPctLeq, setSkipRepriceIfMarginPctLeq] =
    React.useState<string>("-10");
  const [singleBuy, setSingleBuy] = React.useState<boolean>(true);
  const [inventoryMode, setInventoryMode] = React.useState<
    "IGNORE" | "SKIP_EXISTING" | "TOP_OFF"
  >("SKIP_EXISTING");

  const requestedCycleDays = Math.max(1, Number(cycleDays) || 14);
  const requestedCycles = Math.max(1, Number(cycleCount) || 6);
  const requestedTotalDays = requestedCycleDays * requestedCycles;
  const coverage = useStrategyLabMarketDataCoverage({
    startDate,
    days: requestedTotalDays,
  });

  // Robustness defaults (tail-risk)
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
  const [useBlacklistCompare, setUseBlacklistCompare] =
    React.useState<boolean>(true);
  const [blacklistBuildFrom, setBlacklistBuildFrom] = React.useState<
    "noBlacklist" | "withBlacklist"
  >("noBlacklist");
  const [blacklistBuildMinRuns, setBlacklistBuildMinRuns] =
    React.useState<string>("20");
  const [blacklistBuildMinLoserRatePct, setBlacklistBuildMinLoserRatePct] =
    React.useState<string>("20");
  const [blacklistBuildMinRedRatePct, setBlacklistBuildMinRedRatePct] =
    React.useState<string>("20");
  const [blacklistBuildMode, setBlacklistBuildMode] = React.useState<
    "OR" | "AND"
  >("OR");
  const [blacklistBuildMaxItems, setBlacklistBuildMaxItems] =
    React.useState<string>("50");
  const [blacklistAutoStatus, setBlacklistAutoStatus] = React.useState<
    string | null
  >(null);
  const [blacklistAutoBest, setBlacklistAutoBest] = React.useState<{
    label: string;
    baselineAvgP10Isk: number | null;
    bestAvgP10Isk: number | null;
    avgDeltaP10Isk: number | null;
    blacklistJson: string;
  } | null>(null);

  function loserRate(x: { loserRuns: number; runs: number }) {
    return x.runs > 0 ? x.loserRuns / x.runs : 0;
  }
  function redRate(x: { redRuns: number; runs: number }) {
    return x.runs > 0 ? x.redRuns / x.runs : 0;
  }
  function avgLossPerLoserRun(x: {
    totalLossCashIsk: number;
    loserRuns: number;
  }) {
    return x.loserRuns > 0 ? x.totalLossCashIsk / x.loserRuns : null;
  }

  function formatRepeatOffenderDetails(x: {
    totalLossCashIsk: number;
    loserRuns: number;
    redRuns: number;
    runs: number;
    strategies: string[];
  }) {
    const lrPct = (loserRate(x) * 100).toFixed(1);
    const rrPct = (redRate(x) * 100).toFixed(1);
    const avgLoss = avgLossPerLoserRun(x);
    const avgLossLabel = avgLoss !== null ? formatIsk(avgLoss) : "—";
    return `lossTotal=${formatIsk(x.totalLossCashIsk)} • loserRuns=${x.loserRuns} • redRuns=${x.redRuns} • runs=${x.runs} • strategies=${x.strategies.length} • loserRate=${lrPct}% • redRate=${rrPct}% • avgLoss/loser=${avgLossLabel}`;
  }

  function buildBlacklistFromRepeatOffenders(
    offenders: Array<{
      destinationStationId: number;
      typeId: number;
      totalLossCashIsk: number;
      loserRuns: number;
      redRuns: number;
      runs: number;
    }>,
    opts: {
      minRuns: number;
      minLoserRatePct: number;
      minRedRatePct: number;
      mode: "OR" | "AND";
      maxItems: number;
    },
  ): {
    globalTypeIds: number[];
    byDestinationTypeIds: Record<string, number[]>;
  } {
    const minRuns = Math.max(0, opts.minRuns || 0);
    const minLoserRate = Math.max(0, opts.minLoserRatePct || 0) / 100;
    const minRedRate = Math.max(0, opts.minRedRatePct || 0) / 100;
    const maxItems = Math.max(1, opts.maxItems || 1);

    const filtered = offenders
      .filter((x) => x.runs >= minRuns)
      .filter((x) => {
        const lr = loserRate(x);
        const rr = redRate(x);
        return opts.mode === "AND"
          ? lr >= minLoserRate && rr >= minRedRate
          : lr >= minLoserRate || rr >= minRedRate;
      })
      .sort((a, b) => a.totalLossCashIsk - b.totalLossCashIsk)
      .slice(0, maxItems);

    const byDestinationTypeIds: Record<string, number[]> = {};
    for (const x of filtered) {
      const key = String(x.destinationStationId);
      if (!byDestinationTypeIds[key]) byDestinationTypeIds[key] = [];
      if (!byDestinationTypeIds[key].includes(x.typeId)) {
        byDestinationTypeIds[key].push(x.typeId);
      }
    }
    for (const key of Object.keys(byDestinationTypeIds)) {
      byDestinationTypeIds[key].sort((a, b) => a - b);
    }

    return { globalTypeIds: [], byDestinationTypeIds };
  }

  function avgP10Isk(
    rows: Array<{ profitP10Isk: number | null }> | undefined,
  ): number | null {
    if (!rows || rows.length === 0) return null;
    const vals = rows
      .map((r) => r.profitP10Isk)
      .filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const autoBlacklistCandidates: Array<{
    label: string;
    opts: {
      minRuns: number;
      minLoserRatePct: number;
      minRedRatePct: number;
      mode: "OR" | "AND";
      maxItems: number;
    };
  }> = [
    {
      label: "Strict (runs>=30, 30%/30%, OR, max 10)",
      opts: {
        minRuns: 30,
        minLoserRatePct: 30,
        minRedRatePct: 30,
        mode: "OR",
        maxItems: 10,
      },
    },
    {
      label: "Strict+ (runs>=30, 25%/25%, OR, max 15)",
      opts: {
        minRuns: 30,
        minLoserRatePct: 25,
        minRedRatePct: 25,
        mode: "OR",
        maxItems: 15,
      },
    },
    {
      label: "Balanced (runs>=20, 25%/25%, OR, max 25)",
      opts: {
        minRuns: 20,
        minLoserRatePct: 25,
        minRedRatePct: 25,
        mode: "OR",
        maxItems: 25,
      },
    },
    {
      label: "Balanced+ (runs>=20, 20%/20%, OR, max 35)",
      opts: {
        minRuns: 20,
        minLoserRatePct: 20,
        minRedRatePct: 20,
        mode: "OR",
        maxItems: 35,
      },
    },
    {
      label: "AND filter (runs>=20, 20%/20%, AND, max 25)",
      opts: {
        minRuns: 20,
        minLoserRatePct: 20,
        minRedRatePct: 20,
        mode: "AND",
        maxItems: 25,
      },
    },
    {
      label: "Wide (runs>=15, 20%/20%, OR, max 50)",
      opts: {
        minRuns: 15,
        minLoserRatePct: 20,
        minRedRatePct: 20,
        mode: "OR",
        maxItems: 50,
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Strategy Lab
          </h1>
          <p className="text-sm text-muted-foreground">
            Backtest planner knobs using MarketOrderTradeDaily (MVP).
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Cycle Walk-Forward (Rolling Cycle Simulation)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Simulates repeated 14-day cycles with rebuy triggers and
                rollover-at-cost. Ranking is by total profit across cycles (cash
                based; leftover inventory is neutralized by cost rollover).
              </div>

              {coverage.data && (
                <Alert
                  variant={
                    coverage.data.coverage.isComplete
                      ? "default"
                      : "destructive"
                  }
                >
                  <AlertDescription className="text-xs">
                    Market data coverage for {coverage.data.requested.startDate}{" "}
                    → {coverage.data.requested.endDate} (
                    {coverage.data.requested.days} days): haveDays=
                    {coverage.data.coverage.haveDays}, missingDays=
                    {coverage.data.coverage.missingDays}. Table earliest/latest:{" "}
                    {coverage.data.available.minDate ?? "—"} →{" "}
                    {coverage.data.available.maxDate ?? "—"}.
                    {coverage.data.missingDates?.length ? (
                      <>
                        {" "}
                        Missing dates (first {coverage.data.missingDates.length}
                        ): {coverage.data.missingDates.join(", ")}.
                      </>
                    ) : null}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Cycle start date (YYYY-MM-DD)</Label>
                  <Input
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cycles</Label>
                  <Input
                    value={cycleCount}
                    onChange={(e) => setCycleCount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cycle days</Label>
                  <Input
                    value={cycleDays}
                    onChange={(e) => setCycleDays(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Initial capital (ISK)</Label>
                  <Input
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Daily volume share (sellSharePct)</Label>
                  <Input
                    value={sellSharePct}
                    onChange={(e) => setSellSharePct(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price model</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={priceModel}
                    onChange={(e) =>
                      setPriceModel(e.target.value as "LOW" | "AVG" | "HIGH")
                    }
                  >
                    <option value="LOW">LOW</option>
                    <option value="AVG">AVG</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Rebuy trigger cash % (e.g. 0.25)</Label>
                  <Input
                    value={rebuyTriggerCashPct}
                    onChange={(e) => setRebuyTriggerCashPct(e.target.value)}
                    disabled={singleBuy}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reserve cash % after buy (e.g. 0.02)</Label>
                  <Input
                    value={reserveCashPct}
                    onChange={(e) => setReserveCashPct(e.target.value)}
                    disabled={singleBuy}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Strategy name contains (filter)</Label>
                  <Input
                    value={nameContains}
                    onChange={(e) => setNameContains(e.target.value)}
                    placeholder="SL-"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Reprices/day (fee multiplier)</Label>
                  <Input
                    value={repricesPerDay}
                    onChange={(e) => setRepricesPerDay(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Skip reprice if margin% ≤ (red)</Label>
                  <Input
                    value={skipRepriceIfMarginPctLeq}
                    onChange={(e) =>
                      setSkipRepriceIfMarginPctLeq(e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inventory mode (rebuy planning)</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={inventoryMode}
                    onChange={(e) =>
                      setInventoryMode(
                        e.target.value as
                          | "IGNORE"
                          | "SKIP_EXISTING"
                          | "TOP_OFF",
                      )
                    }
                  >
                    <option value="IGNORE">
                      IGNORE (Strategy Lab legacy / no inventory limits)
                    </option>
                    <option value="SKIP_EXISTING">
                      SKIP_EXISTING (prod default)
                    </option>
                    <option value="TOP_OFF">
                      TOP_OFF (allowInventoryTopOff)
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="sl-single-buy"
                  checked={singleBuy}
                  onCheckedChange={(v) => setSingleBuy(Boolean(v))}
                />
                <div className="space-y-1">
                  <label
                    htmlFor="sl-single-buy"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Single buy mode
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Run the planner once at cycle start, then only sell/reprice
                    until positions are sold or marked red (no rebuys).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  disabled={cycleWalkForwardAll.isPending}
                  onClick={async () => {
                    setError(null);
                    setCycleWfReport(null);
                    try {
                      if (coverage.data && !coverage.data.coverage.isComplete) {
                        const ok = confirm(
                          `Market data has ${coverage.data.coverage.missingDays} missing day(s) in this window. The simulator will effectively treat those as "no data" days (no sells/reprices). Continue anyway?`,
                        );
                        if (!ok) return;
                      }
                      const report = await cycleWalkForwardAll.mutateAsync({
                        startDate,
                        cycles: Number(cycleCount),
                        cycleDays: Number(cycleDays),
                        initialCapitalIsk: Number(initialCapital),
                        rebuyTriggerCashPct: Number(rebuyTriggerCashPct),
                        reserveCashPct: Number(reserveCashPct),
                        repricesPerDay: Number(repricesPerDay),
                        skipRepriceIfMarginPctLeq: Number(
                          skipRepriceIfMarginPctLeq,
                        ),
                        nameContains: nameContains || undefined,
                        singleBuy,
                        sellModel: "VOLUME_SHARE",
                        sellSharePct: Number(sellSharePct),
                        priceModel,
                        inventoryMode,
                      });
                      setCycleWfReport(report);
                    } catch (e: unknown) {
                      setError(
                        e instanceof Error ? e.message : "Request failed",
                      );
                    }
                  }}
                >
                  {cycleWalkForwardAll.isPending
                    ? "Simulating..."
                    : "Run cycle walk-forward (all strategies)"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCycleWfReport(null)}
                >
                  Clear
                </Button>
              </div>

              {cycleWfReport && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    cycles={cycleWfReport.settings.cycles} • days=
                    {cycleWfReport.settings.cycleDays} • sellShare=
                    {cycleWfReport.settings.sellSharePct} • rebuyTrigger=
                    {cycleWfReport.settings.rebuyTriggerCashPct} • reserve=
                    {cycleWfReport.settings.reserveCashPct} • invMode=
                    {cycleWfReport.settings.inventoryMode}
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Ranking (cash profit)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {cycleWfReport.results.length ? (
                        <div className="space-y-2">
                          {cycleWfReport.results.slice(0, 25).map((r) => (
                            <div
                              key={r.strategyId}
                              className="rounded-md border p-3 flex items-center justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {r.strategyName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  cashProfit={formatIsk(r.totalProfitCashIsk)} •
                                  avgCash/cycle=
                                  {formatIsk(r.avgProfitCashIskPerCycle)}
                                  {" • "}
                                  navΔ={formatIsk(r.totalProfitIsk)}
                                  {" • "}
                                  lastCycleProfit=
                                  {r.cycles.length
                                    ? formatIsk(
                                        r.cycles[r.cycles.length - 1]
                                          .profitCashIsk,
                                      )
                                    : "—"}
                                </div>
                              </div>
                              <div className="text-sm tabular-nums">
                                {Number.isFinite(r.totalProfitCashIsk)
                                  ? formatIsk(r.totalProfitCashIsk)
                                  : "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">—</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Best strategy cycles</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {cycleWfReport.results[0]?.cycles?.length ? (
                        <div className="space-y-2">
                          {cycleWfReport.results[0].cycles.map((c) => (
                            <div
                              key={c.cycleIndex}
                              className="rounded-md border p-3 flex items-start justify-between gap-4"
                            >
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-baseline justify-between gap-3">
                                  <div className="text-sm font-medium">
                                    cycle {c.cycleIndex}: {c.startDate} {"→"}{" "}
                                    {c.endDate}
                                  </div>
                                  <div className="text-sm tabular-nums">
                                    {formatIsk(c.profitCashIsk)}
                                  </div>
                                </div>

                                <div className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                                  <div>
                                    <span className="text-muted-foreground">
                                      buyEvents:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {c.buyEvents}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      relistFees:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {formatIsk(c.relistFeesPaidIsk)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      salesTax:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {formatIsk(c.salesTaxIsk)}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-muted-foreground">
                                      brokersFee:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {formatIsk(c.brokerFeesIsk)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      shipping:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {formatIsk(c.totalShippingIsk)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      netSales:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {formatIsk(c.salesNetIsk)}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-muted-foreground">
                                      COGS:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {formatIsk(c.cogsIsk)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      profit:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {formatIsk(c.profitCashIsk)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      margin:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {c.roiPct !== null
                                        ? `${c.roiPct.toFixed(2)}%`
                                        : "—"}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-muted-foreground">
                                      cashEnd:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {formatIsk(c.cashEndIsk)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      invCostEnd:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {formatIsk(c.inventoryCostEndIsk)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      sellNet/u:
                                    </span>{" "}
                                    <span className="tabular-nums">
                                      {c.avgNetSellPerUnitIsk !== null
                                        ? formatIsk(c.avgNetSellPerUnitIsk)
                                        : "—"}
                                    </span>
                                  </div>
                                </div>

                                {c.buyDates?.length ? (
                                  <details className="text-sm">
                                    <summary className="cursor-pointer text-muted-foreground">
                                      Details{" "}
                                      <span className="tabular-nums">
                                        (buyDates {c.buyDates.length}, spend{" "}
                                        {formatIsk(c.totalSpendIsk)}, reprices{" "}
                                        {c.repricesApplied}, skippedRed{" "}
                                        {c.repricesSkippedRed}, unitsSold{" "}
                                        {c.unitsSold}, heldPairsEnd{" "}
                                        {c.positionsHeldEnd}, cashPct(min/max){" "}
                                        {c.cashPctMin.toFixed(2)}/
                                        {c.cashPctMax.toFixed(2)}, ΔNAV{" "}
                                        {formatIsk(c.profitIsk)})
                                      </span>
                                    </summary>
                                    <div className="mt-1 whitespace-normal break-words tabular-nums">
                                      {c.buyDates.join(", ")}
                                    </div>
                                  </details>
                                ) : (
                                  <details className="text-sm">
                                    <summary className="cursor-pointer text-muted-foreground">
                                      Details{" "}
                                      <span className="tabular-nums">
                                        (spend {formatIsk(c.totalSpendIsk)},
                                        reprices {c.repricesApplied}, skippedRed{" "}
                                        {c.repricesSkippedRed}, unitsSold{" "}
                                        {c.unitsSold}, heldPairsEnd{" "}
                                        {c.positionsHeldEnd}, cashPct(min/max){" "}
                                        {c.cashPctMin.toFixed(2)}/
                                        {c.cashPctMax.toFixed(2)}, ΔNAV{" "}
                                        {formatIsk(c.profitIsk)})
                                      </span>
                                    </summary>
                                    <div className="mt-1 text-muted-foreground">
                                      —
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">—</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Robustness (Multi-start, tail-risk first)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Runs the single-buy simulator across many start dates and ranks
                strategies by <span className="font-medium">profit p10</span>{" "}
                (bad-case), then median. This is designed to reduce bad cycles.
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Start date from</Label>
                  <Input
                    value={robustFrom}
                    onChange={(e) => setRobustFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start date to</Label>
                  <Input
                    value={robustTo}
                    onChange={(e) => setRobustTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Step days</Label>
                  <Input
                    value={robustStepDays}
                    onChange={(e) => setRobustStepDays(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max days / start</Label>
                  <Input
                    value={robustMaxDays}
                    onChange={(e) => setRobustMaxDays(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="sl-robust-compare-blacklist"
                  checked={useBlacklistCompare}
                  onCheckedChange={(v) => setUseBlacklistCompare(Boolean(v))}
                />
                <div className="space-y-1">
                  <label
                    htmlFor="sl-robust-compare-blacklist"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Compare with blacklist
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Runs the robustness report twice: without blacklist and with
                    your blacklist, so you can detect when blacklisting starts
                    hurting results.
                  </p>
                </div>
              </div>

              {useBlacklistCompare ? (
                <div className="space-y-2">
                  <Label>Blacklist (JSON)</Label>
                  <Textarea
                    value={blacklistJson}
                    onChange={(e) => setBlacklistJson(e.target.value)}
                    className="min-h-40 font-mono text-xs"
                  />
                  <div className="text-xs text-muted-foreground">
                    Shape:{" "}
                    <span className="font-mono">
                      {
                        "{ globalTypeIds: number[], byDestinationTypeIds: { [stationId]: number[] } }"
                      }
                    </span>
                  </div>

                  <div className="rounded-md border p-3 space-y-3">
                    <div className="text-sm font-medium">
                      Blacklist builder (from repeat offenders)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Uses the last robustness report’s repeat offenders list to
                      generate a per-destination blacklist JSON.
                    </div>

                    <div className="grid gap-3 md:grid-cols-5">
                      <div className="space-y-2">
                        <Label>Build from</Label>
                        <Select
                          value={blacklistBuildFrom}
                          onValueChange={(v) =>
                            setBlacklistBuildFrom(
                              v as "noBlacklist" | "withBlacklist",
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="noBlacklist">
                              NO blacklist
                            </SelectItem>
                            <SelectItem value="withBlacklist">
                              WITH blacklist
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Min runs</Label>
                        <Input
                          value={blacklistBuildMinRuns}
                          onChange={(e) =>
                            setBlacklistBuildMinRuns(e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Min loserRate %</Label>
                        <Input
                          value={blacklistBuildMinLoserRatePct}
                          onChange={(e) =>
                            setBlacklistBuildMinLoserRatePct(e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Min redRate %</Label>
                        <Input
                          value={blacklistBuildMinRedRatePct}
                          onChange={(e) =>
                            setBlacklistBuildMinRedRatePct(e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max items</Label>
                        <Input
                          value={blacklistBuildMaxItems}
                          onChange={(e) =>
                            setBlacklistBuildMaxItems(e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">
                          Mode
                        </Label>
                        <Select
                          value={blacklistBuildMode}
                          onValueChange={(v) =>
                            setBlacklistBuildMode(v as "OR" | "AND")
                          }
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OR">
                              OR (either threshold)
                            </SelectItem>
                            <SelectItem value="AND">
                              AND (both thresholds)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        disabled={
                          !robustReport ||
                          (blacklistBuildFrom === "withBlacklist" &&
                            !robustReport.reports.withBlacklist)
                        }
                        onClick={() => {
                          if (!robustReport) return;
                          const src =
                            blacklistBuildFrom === "withBlacklist" &&
                            robustReport.reports.withBlacklist
                              ? robustReport.reports.withBlacklist
                              : robustReport.reports.noBlacklist;
                          const next = buildBlacklistFromRepeatOffenders(
                            src.repeatOffenders,
                            {
                              minRuns: Number(blacklistBuildMinRuns),
                              minLoserRatePct: Number(
                                blacklistBuildMinLoserRatePct,
                              ),
                              minRedRatePct: Number(
                                blacklistBuildMinRedRatePct,
                              ),
                              mode: blacklistBuildMode,
                              maxItems: Number(blacklistBuildMaxItems),
                            },
                          );
                          setBlacklistJson(JSON.stringify(next, null, 2));
                        }}
                      >
                        Generate JSON from offenders
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border p-3 space-y-3">
                    <div className="text-sm font-medium">
                      Auto-tune blacklist (grid search)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Runs robustness once for a baseline, then tries a handful
                      of blacklist tiers automatically and picks the one with
                      the best average p10 uplift across the matched strategies.
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="default"
                        disabled={cycleRobustness.isPending}
                        onClick={async () => {
                          setError(null);
                          setBlacklistAutoBest(null);
                          setBlacklistAutoStatus("Running baseline…");
                          try {
                            const base = await cycleRobustness.mutateAsync({
                              startDateFrom: robustFrom,
                              startDateTo: robustTo,
                              stepDays: Number(robustStepDays),
                              maxDays: Number(robustMaxDays),
                              initialCapitalIsk: Number(initialCapital),
                              sellSharePct: Number(sellSharePct),
                              repricesPerDay: Number(repricesPerDay),
                              skipRepriceIfMarginPctLeq: Number(
                                skipRepriceIfMarginPctLeq,
                              ),
                              inventoryMode,
                              nameContains: nameContains.trim() || undefined,
                              priceModel,
                            });

                            const offenders =
                              base.reports.noBlacklist.repeatOffenders ?? [];
                            const baselineAvg = avgP10Isk(
                              base.reports.noBlacklist.results,
                            );

                            if (!offenders.length) {
                              setBlacklistAutoStatus(
                                "No repeat offenders in baseline (nothing to auto-blacklist).",
                              );
                              setRobustReport(base);
                              return;
                            }

                            let best: {
                              label: string;
                              baselineAvgP10Isk: number | null;
                              bestAvgP10Isk: number | null;
                              avgDeltaP10Isk: number | null;
                              blacklistJson: string;
                              report: TradeStrategyCycleRobustnessReport;
                            } | null = null;

                            for (
                              let i = 0;
                              i < autoBlacklistCandidates.length;
                              i++
                            ) {
                              const cand = autoBlacklistCandidates[i];
                              setBlacklistAutoStatus(
                                `Testing ${i + 1}/${autoBlacklistCandidates.length}: ${cand.label}`,
                              );

                              const bl = buildBlacklistFromRepeatOffenders(
                                offenders,
                                cand.opts,
                              );
                              const report = await cycleRobustness.mutateAsync({
                                startDateFrom: robustFrom,
                                startDateTo: robustTo,
                                stepDays: Number(robustStepDays),
                                maxDays: Number(robustMaxDays),
                                initialCapitalIsk: Number(initialCapital),
                                sellSharePct: Number(sellSharePct),
                                repricesPerDay: Number(repricesPerDay),
                                skipRepriceIfMarginPctLeq: Number(
                                  skipRepriceIfMarginPctLeq,
                                ),
                                inventoryMode,
                                nameContains: nameContains.trim() || undefined,
                                priceModel,
                                blacklist: bl,
                              });

                              const withAvg = avgP10Isk(
                                report.reports.withBlacklist?.results,
                              );
                              const delta =
                                baselineAvg !== null && withAvg !== null
                                  ? withAvg - baselineAvg
                                  : null;

                              const candJson = JSON.stringify(bl, null, 2);
                              if (
                                !best ||
                                (best.avgDeltaP10Isk === null &&
                                  delta !== null) ||
                                (best.avgDeltaP10Isk !== null &&
                                  delta !== null &&
                                  delta > best.avgDeltaP10Isk)
                              ) {
                                best = {
                                  label: cand.label,
                                  baselineAvgP10Isk: baselineAvg,
                                  bestAvgP10Isk: withAvg,
                                  avgDeltaP10Isk: delta,
                                  blacklistJson: candJson,
                                  report,
                                };
                              }
                            }

                            if (!best) {
                              setBlacklistAutoStatus(
                                "Auto-tune failed to pick a best tier.",
                              );
                              setRobustReport(base);
                              return;
                            }

                            setUseBlacklistCompare(true);
                            setBlacklistJson(best.blacklistJson);
                            setRobustReport(best.report);
                            setBlacklistAutoBest({
                              label: best.label,
                              baselineAvgP10Isk: best.baselineAvgP10Isk,
                              bestAvgP10Isk: best.bestAvgP10Isk,
                              avgDeltaP10Isk: best.avgDeltaP10Isk,
                              blacklistJson: best.blacklistJson,
                            });
                            setBlacklistAutoStatus("Done.");
                          } catch (e: unknown) {
                            setBlacklistAutoStatus(null);
                            setError(
                              e instanceof Error ? e.message : "Request failed",
                            );
                          }
                        }}
                      >
                        Auto-tune & apply best
                      </Button>
                      {blacklistAutoStatus ? (
                        <div className="text-xs text-muted-foreground">
                          {blacklistAutoStatus}
                        </div>
                      ) : null}
                    </div>

                    {blacklistAutoBest ? (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        bestTier=&quot;{blacklistAutoBest.label}&quot; •
                        avgP10(baseline)=
                        {blacklistAutoBest.baselineAvgP10Isk !== null
                          ? formatIsk(blacklistAutoBest.baselineAvgP10Isk)
                          : "—"}{" "}
                        • avgP10(best)=
                        {blacklistAutoBest.bestAvgP10Isk !== null
                          ? formatIsk(blacklistAutoBest.bestAvgP10Isk)
                          : "—"}{" "}
                        • ΔavgP10=
                        {blacklistAutoBest.avgDeltaP10Isk !== null
                          ? formatIsk(blacklistAutoBest.avgDeltaP10Isk)
                          : "—"}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Button
                  disabled={cycleRobustness.isPending}
                  onClick={async () => {
                    setError(null);
                    setRobustReport(null);
                    try {
                      const report = await cycleRobustness.mutateAsync({
                        startDateFrom: robustFrom,
                        startDateTo: robustTo,
                        stepDays: Number(robustStepDays),
                        maxDays: Number(robustMaxDays),
                        initialCapitalIsk: Number(initialCapital),
                        sellSharePct: Number(sellSharePct),
                        repricesPerDay: Number(repricesPerDay),
                        skipRepriceIfMarginPctLeq: Number(
                          skipRepriceIfMarginPctLeq,
                        ),
                        inventoryMode,
                        nameContains: nameContains.trim() || undefined,
                        priceModel,
                        blacklist: useBlacklistCompare
                          ? (JSON.parse(blacklistJson) as {
                              globalTypeIds?: number[];
                              byDestinationTypeIds?: Record<string, number[]>;
                            })
                          : undefined,
                      });
                      setRobustReport(report);
                    } catch (e: unknown) {
                      setError(
                        e instanceof Error ? e.message : "Request failed",
                      );
                    }
                  }}
                >
                  {cycleRobustness.isPending
                    ? "Running..."
                    : "Run robustness report"}
                </Button>
                <Button variant="outline" onClick={() => setRobustReport(null)}>
                  Clear
                </Button>
              </div>

              {robustReport && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    starts={robustReport.starts.length} • step=
                    {robustReport.config.stepDays} • maxDays=
                    {robustReport.config.maxDays} • priceModel=
                    {robustReport.config.priceModel} • invMode=
                    {robustReport.config.inventoryMode}
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Ranking (NO blacklist)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="divide-y rounded-md border">
                        {robustReport.reports.noBlacklist.results
                          .slice(0, 30)
                          .map((r) => (
                            <div
                              key={r.strategyId}
                              className="p-3 flex items-center justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {r.strategyName}
                                </div>
                                <div className="text-xs text-muted-foreground tabular-nums">
                                  p10=
                                  {r.profitP10Isk !== null
                                    ? formatIsk(r.profitP10Isk)
                                    : "—"}{" "}
                                  • med=
                                  {r.profitMedianIsk !== null
                                    ? formatIsk(r.profitMedianIsk)
                                    : "—"}{" "}
                                  • p90=
                                  {r.profitP90Isk !== null
                                    ? formatIsk(r.profitP90Isk)
                                    : "—"}{" "}
                                  • lossRate=
                                  {r.lossRate !== null
                                    ? `${(r.lossRate * 100).toFixed(1)}%`
                                    : "—"}{" "}
                                  • runs={r.runs}
                                </div>
                              </div>
                              <div className="text-sm tabular-nums">
                                {r.profitP10Isk !== null
                                  ? formatIsk(r.profitP10Isk)
                                  : "—"}
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Repeat offenders (NO blacklist)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {robustReport.reports.noBlacklist.repeatOffenders
                        .length ? (
                        <div className="divide-y rounded-md border">
                          {robustReport.reports.noBlacklist.repeatOffenders.map(
                            (x) => (
                              <div
                                key={`${x.destinationStationId}:${x.typeId}`}
                                className="p-3 flex items-center justify-between gap-4"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {x.typeName
                                      ? `${x.typeName} (typeId=${x.typeId})`
                                      : `typeId=${x.typeId}`}{" "}
                                    •{" "}
                                    {x.stationName
                                      ? x.stationName
                                      : `dst ${x.destinationStationId}`}
                                  </div>
                                  <div className="text-xs text-muted-foreground tabular-nums">
                                    {formatRepeatOffenderDetails(x)}
                                  </div>
                                </div>
                                <div className="text-sm tabular-nums">
                                  {formatIsk(x.totalLossCashIsk)}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">—</div>
                      )}
                    </CardContent>
                  </Card>

                  {robustReport.reports.withBlacklist ? (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle>Ranking (WITH blacklist)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="divide-y rounded-md border">
                            {robustReport.reports.withBlacklist.results
                              .slice(0, 30)
                              .map((r) => (
                                <div
                                  key={r.strategyId}
                                  className="p-3 flex items-center justify-between gap-4"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {r.strategyName}
                                    </div>
                                    <div className="text-xs text-muted-foreground tabular-nums">
                                      p10=
                                      {r.profitP10Isk !== null
                                        ? formatIsk(r.profitP10Isk)
                                        : "—"}{" "}
                                      • med=
                                      {r.profitMedianIsk !== null
                                        ? formatIsk(r.profitMedianIsk)
                                        : "—"}{" "}
                                      • p90=
                                      {r.profitP90Isk !== null
                                        ? formatIsk(r.profitP90Isk)
                                        : "—"}{" "}
                                      • lossRate=
                                      {r.lossRate !== null
                                        ? `${(r.lossRate * 100).toFixed(1)}%`
                                        : "—"}{" "}
                                      • runs={r.runs}
                                    </div>
                                  </div>
                                  <div className="text-sm tabular-nums">
                                    {r.profitP10Isk !== null
                                      ? formatIsk(r.profitP10Isk)
                                      : "—"}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>
                            Repeat offenders (WITH blacklist)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {robustReport.reports.withBlacklist.repeatOffenders
                            .length ? (
                            <div className="divide-y rounded-md border">
                              {robustReport.reports.withBlacklist.repeatOffenders.map(
                                (x) => (
                                  <div
                                    key={`${x.destinationStationId}:${x.typeId}`}
                                    className="p-3 flex items-center justify-between gap-4"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium truncate">
                                        {x.typeName
                                          ? `${x.typeName} (typeId=${x.typeId})`
                                          : `typeId=${x.typeId}`}{" "}
                                        •{" "}
                                        {x.stationName
                                          ? x.stationName
                                          : `dst ${x.destinationStationId}`}
                                      </div>
                                      <div className="text-xs text-muted-foreground tabular-nums">
                                        {formatRepeatOffenderDetails(x)}
                                      </div>
                                    </div>
                                    <div className="text-sm tabular-nums">
                                      {formatIsk(x.totalLossCashIsk)}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              —
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lab Sweep (Single-Button Ranking)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Runs a multi-scenario sweep across active strategies and returns
                a ranked report (ROI-first, then drawdown, light relist
                penalty).
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Train days</Label>
                  <Input
                    value={wfTrainDays}
                    onChange={(e) => setWfTrainDays(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Test days</Label>
                  <Input
                    value={wfTestDays}
                    onChange={(e) => setWfTestDays(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Step days</Label>
                  <Input
                    value={wfStepDays}
                    onChange={(e) => setWfStepDays(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max runs</Label>
                  <Input
                    value={wfMaxRuns}
                    onChange={(e) => setWfMaxRuns(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Start date (YYYY-MM-DD)</Label>
                  <Input
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End date (YYYY-MM-DD)</Label>
                  <Input
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial Capital (ISK)</Label>
                  <Input
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Daily volume share (0..1)</Label>
                  <Input
                    value={sellSharePct}
                    onChange={(e) => setSellSharePct(e.target.value)}
                    disabled={sellModel === "CALIBRATED_CAPTURE"}
                  />
                  {sellModel === "CALIBRATED_CAPTURE" ? (
                    <div className="text-xs text-muted-foreground">
                      Ignored for calibrated capture (uses observed capture per
                      item/destination).
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Sell model</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={sellModel}
                    onChange={(e) =>
                      setSellModel(
                        e.target.value as "VOLUME_SHARE" | "CALIBRATED_CAPTURE",
                      )
                    }
                  >
                    <option value="VOLUME_SHARE">VOLUME_SHARE</option>
                    <option value="CALIBRATED_CAPTURE">
                      CALIBRATED_CAPTURE
                    </option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Price model</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={priceModel}
                    onChange={(e) =>
                      setPriceModel(e.target.value as "LOW" | "AVG" | "HIGH")
                    }
                  >
                    <option value="LOW">LOW (conservative)</option>
                    <option value="AVG">AVG</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Strategy name contains (filter)</Label>
                  <Input
                    value={nameContains}
                    onChange={(e) => setNameContains(e.target.value)}
                    placeholder='e.g. "SL-01V" (leave blank for all)'
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  disabled={labSweep.isPending}
                  onClick={async () => {
                    try {
                      setError(null);
                      setSweepReport(null);
                      const cap = Number(initialCapital);
                      const trainDays = Number(wfTrainDays);
                      const testDays = Number(wfTestDays);
                      const stepDays = Number(wfStepDays);
                      const maxRuns = Number(wfMaxRuns);

                      if (!startDate || !endDate)
                        throw new Error("Provide start/end dates");
                      if (!Number.isFinite(cap) || cap <= 0)
                        throw new Error("Invalid initial capital");

                      const report = await labSweep.mutateAsync({
                        startDate,
                        endDate,
                        initialCapitalIsk: cap,
                        trainWindowDays: trainDays,
                        testWindowDays: testDays,
                        stepDays,
                        maxRuns,
                        sellModel,
                        // default sweep: price models x sell shares (includes a more realistic low-share grid)
                        priceModels: ["LOW", "AVG", "HIGH"],
                        sellSharePcts:
                          sellModel === "VOLUME_SHARE"
                            ? [0.05, 0.1, 0.15, 0.2]
                            : [0.05],
                        nameContains: nameContains.trim() || undefined,
                      });
                      setSweepReport(report);
                    } catch (e: unknown) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  {labSweep.isPending ? "Sweeping..." : "Run lab sweep"}
                </Button>
                <Button variant="outline" onClick={() => setSweepReport(null)}>
                  Clear
                </Button>
              </div>

              {sweepReport && (
                <div className="space-y-4">
                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-medium">Lab sweep report</div>
                    <div className="text-muted-foreground">
                      sweep={sweepReport.globalSweepId} • scenarios=
                      {sweepReport.scenarios.length} • strategies=
                      {sweepReport.results.length}
                    </div>
                    <div className="text-muted-foreground">
                      score = roiMedian − 0.15×worstDD −
                      0.05×relistFeesMedian%capital (ROI dominates; DD
                      secondary; relist is a light penalty)
                    </div>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Winner (robust score)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {sweepReport.results[0] ? (
                        (() => {
                          const w = sweepReport.results[0];
                          const medianOfSorted = (arr: number[]) => {
                            if (arr.length === 0) return null;
                            const mid = Math.floor(arr.length / 2);
                            return arr.length % 2 === 1
                              ? arr[mid]
                              : (arr[mid - 1] + arr[mid]) / 2;
                          };

                          const rois = w.scenarioScores
                            .map((s) => s.roiMedian)
                            .filter(
                              (x): x is number =>
                                typeof x === "number" && Number.isFinite(x),
                            )
                            .sort((a, b) => a - b);
                          const dds = w.scenarioScores
                            .map((s) => s.worstDD)
                            .filter(
                              (x): x is number =>
                                typeof x === "number" && Number.isFinite(x),
                            )
                            .sort((a, b) => a - b);
                          const relists = w.scenarioScores
                            .map((s) => s.relistFeesMedianIsk)
                            .filter(
                              (x): x is number =>
                                typeof x === "number" && Number.isFinite(x),
                            )
                            .sort((a, b) => a - b);

                          const roiMed = medianOfSorted(rois);
                          const ddMed = medianOfSorted(dds);
                          const relistMed = medianOfSorted(relists);

                          return (
                            <div className="rounded-md border p-3 flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {w.strategyName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  overallScore=
                                  {w.overallScore !== null
                                    ? w.overallScore.toFixed(3)
                                    : "—"}
                                  {" • "}
                                  roiMedian=
                                  {roiMed !== null
                                    ? `${roiMed.toFixed(2)}%`
                                    : "—"}
                                  {" • "}
                                  worstDD(med)=
                                  {ddMed !== null
                                    ? `${ddMed.toFixed(2)}%`
                                    : "—"}
                                  {" • "}
                                  relistFees(med)=
                                  {relistMed !== null
                                    ? formatIsk(relistMed)
                                    : "—"}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-sm text-muted-foreground">—</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Robust ranking (sorted by low sell-share score)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="divide-y rounded-md border">
                        {sweepReport.results.map((r) => {
                          const medianOfSorted = (arr: number[]) => {
                            if (arr.length === 0) return null;
                            const mid = Math.floor(arr.length / 2);
                            return arr.length % 2 === 1
                              ? arr[mid]
                              : (arr[mid - 1] + arr[mid]) / 2;
                          };

                          const rois = r.scenarioScores
                            .map((s) => s.roiMedian)
                            .filter(
                              (x): x is number =>
                                typeof x === "number" && Number.isFinite(x),
                            )
                            .sort((a, b) => a - b);
                          const dds = r.scenarioScores
                            .map((s) => s.worstDD)
                            .filter(
                              (x): x is number =>
                                typeof x === "number" && Number.isFinite(x),
                            )
                            .sort((a, b) => a - b);
                          const relists = r.scenarioScores
                            .map((s) => s.relistFeesMedianIsk)
                            .filter(
                              (x): x is number =>
                                typeof x === "number" && Number.isFinite(x),
                            )
                            .sort((a, b) => a - b);

                          const roiMed = medianOfSorted(rois);
                          const ddMed = medianOfSorted(dds);
                          const relistMed = medianOfSorted(relists);

                          const lowShareScore =
                            r.sellShareSummary?.scoreAtMinSellShare ?? null;
                          const robustMin =
                            r.sellShareSummary
                              ?.robustScoreMinAcrossSellShares ?? null;
                          const robustMed =
                            r.sellShareSummary
                              ?.robustScoreMedianAcrossSellShares ?? null;
                          const primaryRankScore = lowShareScore;

                          return (
                            <div
                              key={r.strategyId}
                              className="p-3 flex items-center justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {r.strategyName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  roiMedian=
                                  {roiMed !== null
                                    ? `${roiMed.toFixed(2)}%`
                                    : "—"}
                                  {" • "}
                                  worstDD(med)=
                                  {ddMed !== null
                                    ? `${ddMed.toFixed(2)}%`
                                    : "—"}
                                  {" • "}
                                  relistFees(med)=
                                  {relistMed !== null
                                    ? formatIsk(relistMed)
                                    : "—"}
                                  {" • "}
                                  lowSellShareScore=
                                  {lowShareScore !== null
                                    ? lowShareScore.toFixed(3)
                                    : "—"}
                                  {" • "}
                                  robust(min/med)=
                                  {robustMin !== null
                                    ? robustMin.toFixed(3)
                                    : "—"}
                                  /
                                  {robustMed !== null
                                    ? robustMed.toFixed(3)
                                    : "—"}
                                  {" • "}
                                  overallScore=
                                  {r.overallScore !== null
                                    ? r.overallScore.toFixed(3)
                                    : "—"}
                                </div>
                              </div>
                              <div className="text-sm tabular-nums">
                                {primaryRankScore !== null
                                  ? primaryRankScore.toFixed(3)
                                  : "—"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Recent Runs</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={clearRuns.isPending}
                    onClick={async () => {
                      setError(null);
                      const ok = confirm(
                        "Delete ALL Strategy Lab runs? This will remove run history (days/positions) and cannot be undone.",
                      );
                      if (!ok) return;
                      try {
                        const res = await clearRuns.mutateAsync({});
                        setError(null);
                        if (res.deletedRuns === 0) return;
                      } catch (e: unknown) {
                        setError(
                          e instanceof Error ? e.message : "Request failed",
                        );
                      }
                    }}
                  >
                    {clearRuns.isPending ? "Clearing..." : "Clear runs"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {runs.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No runs yet.
                </div>
              ) : (
                <div className="divide-y rounded-md border">
                  {runs.slice(0, 20).map((r) => {
                    const summary = parseRunSummary(r.summary);
                    const profit = summary.totalProfitIsk ?? null;
                    return (
                      <div
                        key={r.id}
                        className="p-3 flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {r.strategy?.name ?? r.strategyId} — {r.status}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {String(r.startDate).slice(0, 10)} →{" "}
                            {String(r.endDate).slice(0, 10)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm tabular-nums">
                            {profit !== null ? formatIsk(Number(profit)) : "—"}
                          </div>
                          <Link href={`/tradecraft/admin/strategy-lab/${r.id}`}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategies" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={createMode === "form" ? "default" : "outline"}
                  onClick={() => setCreateMode("form")}
                >
                  Form (Planner template)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={createMode === "json" ? "default" : "outline"}
                  onClick={() => setCreateMode("json")}
                >
                  Raw JSON
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="My strategy"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              {createMode === "form" ? (
                <div className="space-y-4">
                  <div className="rounded-md border p-4 space-y-4">
                    <div className="text-sm font-medium">Planner</div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Package Capacity (m³)"
                        tooltip="Maximum volume per package."
                      >
                        <Input
                          value={packageCapacityM3}
                          onChange={(e) => setPackageCapacityM3(e.target.value)}
                          placeholder="13000"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Total Investment (ISK)"
                        tooltip="Total budget available."
                      >
                        <Input
                          value={investmentISK}
                          onChange={(e) => setInvestmentISK(e.target.value)}
                          placeholder="50000000000"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Max Packages"
                        tooltip="Maximum number of packages."
                      >
                        <Input
                          value={maxPackagesHint}
                          onChange={(e) => setMaxPackagesHint(e.target.value)}
                          placeholder="100"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Per-Item Budget Share (%)"
                        tooltip="Max budget % per item per destination."
                      >
                        <Input
                          value={perItemBudgetSharePct}
                          onChange={(e) =>
                            setPerItemBudgetSharePct(e.target.value)
                          }
                          placeholder="15"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Max Package Collateral (ISK)"
                        tooltip="Max total value per package (collateral cap)."
                      >
                        <Input
                          value={maxPackageCollateralISK}
                          onChange={(e) =>
                            setMaxPackageCollateralISK(e.target.value)
                          }
                          placeholder="4000000000"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Allocation Mode"
                        tooltip="Strategy for distributing opportunities across packages."
                      >
                        <Select
                          value={allocationMode}
                          onValueChange={(v) =>
                            setAllocationMode(
                              v as "best" | "targetWeighted" | "roundRobin",
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="best">
                              Best (Efficiency First)
                            </SelectItem>
                            <SelectItem value="roundRobin">
                              Round Robin (Even Distribution)
                            </SelectItem>
                            <SelectItem value="targetWeighted">
                              Target Weighted (Custom)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </LabeledInput>
                      <LabeledInput
                        label="Spread Bias"
                        tooltip="For targetWeighted mode: how strongly to bias selection toward under-target destinations."
                      >
                        <Input
                          value={spreadBias}
                          onChange={(e) => setSpreadBias(e.target.value)}
                          placeholder="Default"
                          disabled={allocationMode !== "targetWeighted"}
                        />
                      </LabeledInput>
                    </div>

                    {allocationMode === "targetWeighted" && (
                      <div className="space-y-2">
                        <Label>Allocation targets (JSON)</Label>
                        <Textarea
                          value={allocationTargetsJson}
                          onChange={(e) =>
                            setAllocationTargetsJson(e.target.value)
                          }
                          className="font-mono text-xs min-h-24"
                          placeholder='{"60008494":0.5,"60005686":0.5}'
                        />
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border p-4 space-y-3">
                    <div className="text-sm font-medium">
                      Shipping Cost (by Station ID)
                    </div>
                    <div className="space-y-2">
                      {shippingRows.map((r, idx) => (
                        <div key={idx} className="grid gap-2 md:grid-cols-3">
                          <div className="md:col-span-1">
                            <Input
                              value={r.stationId}
                              onChange={(e) => {
                                const next = [...shippingRows];
                                next[idx] = {
                                  ...next[idx]!,
                                  stationId: e.target.value,
                                };
                                setShippingRows(next);
                              }}
                              placeholder="Station ID (e.g. 60008494)"
                            />
                          </div>
                          <div className="md:col-span-1">
                            <Input
                              value={r.costIsk}
                              onChange={(e) => {
                                const next = [...shippingRows];
                                next[idx] = {
                                  ...next[idx]!,
                                  costIsk: e.target.value,
                                };
                                setShippingRows(next);
                              }}
                              placeholder="Shipping cost (ISK)"
                            />
                          </div>
                          <div className="md:col-span-1 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const next = shippingRows.filter(
                                  (_, i) => i !== idx,
                                );
                                setShippingRows(
                                  next.length
                                    ? next
                                    : [{ stationId: "", costIsk: "" }],
                                );
                              }}
                              disabled={shippingRows.length <= 1}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setShippingRows([
                            ...shippingRows,
                            { stationId: "", costIsk: "" },
                          ])
                        }
                      >
                        Add station
                      </Button>
                    </div>
                  </div>

                  <Collapsible
                    open={showAdvancedCreate}
                    onOpenChange={setShowAdvancedCreate}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" type="button">
                        {showAdvancedCreate ? "Hide" : "Show"} advanced{" "}
                        {"(Liquidity + Arbitrage + Package Quality)"}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3 space-y-4">
                      <div className="rounded-md border p-4 space-y-4">
                        <div className="text-sm font-medium">
                          Liquidity Filters
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <LabeledInput
                            label="Time Window (days)"
                            tooltip="Override the liquidity window for deeper analysis."
                          >
                            <Input
                              value={liquidityWindowDays}
                              onChange={(e) =>
                                setLiquidityWindowDays(e.target.value)
                              }
                              placeholder="14"
                            />
                          </LabeledInput>
                          <LabeledInput
                            label="Min Coverage Ratio"
                            tooltip="Minimum fraction of days with trades (0-1)."
                          >
                            <Input
                              value={liquidityMinCoverageRatio}
                              onChange={(e) =>
                                setLiquidityMinCoverageRatio(e.target.value)
                              }
                              placeholder="Default"
                            />
                          </LabeledInput>
                          <LabeledInput
                            label="Min Daily ISK Volume"
                            tooltip="Minimum average daily ISK value traded."
                          >
                            <Input
                              value={liquidityMinLiquidityThresholdISK}
                              onChange={(e) =>
                                setLiquidityMinLiquidityThresholdISK(
                                  e.target.value,
                                )
                              }
                              placeholder="Default"
                            />
                          </LabeledInput>
                          <LabeledInput
                            label="Min Daily Trades"
                            tooltip="Minimum average number of trades per day."
                          >
                            <Input
                              value={liquidityMinWindowTrades}
                              onChange={(e) =>
                                setLiquidityMinWindowTrades(e.target.value)
                              }
                              placeholder="Default"
                            />
                          </LabeledInput>
                        </div>
                      </div>

                      <div className="rounded-md border p-4 space-y-4">
                        <div className="text-sm font-medium">
                          Arbitrage Constraints
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <LabeledInput
                            label="Max Inventory Days"
                            tooltip="Maximum days of average daily volume to hold as inventory."
                          >
                            <Input
                              value={arbMaxInventoryDays}
                              onChange={(e) =>
                                setArbMaxInventoryDays(e.target.value)
                              }
                              placeholder="Default (3)"
                            />
                          </LabeledInput>
                          <LabeledInput
                            label="Min Margin %"
                            tooltip="Minimum profit margin percentage after fees."
                          >
                            <Input
                              value={arbMinMarginPercent}
                              onChange={(e) =>
                                setArbMinMarginPercent(e.target.value)
                              }
                              placeholder="Default (10)"
                            />
                          </LabeledInput>
                          <LabeledInput
                            label="Max Price Deviation Multiple"
                            tooltip="Reject opportunities where current price > historical average by this multiple."
                          >
                            <Input
                              value={arbMaxPriceDeviationMultiple}
                              onChange={(e) =>
                                setArbMaxPriceDeviationMultiple(e.target.value)
                              }
                              placeholder="No limit"
                            />
                          </LabeledInput>
                          <LabeledInput
                            label="Min Total Profit (ISK)"
                            tooltip="Minimum total profit per opportunity."
                          >
                            <Input
                              value={arbMinTotalProfitISK}
                              onChange={(e) =>
                                setArbMinTotalProfitISK(e.target.value)
                              }
                              placeholder="Default"
                            />
                          </LabeledInput>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="sl-create-disableInv"
                              checked={arbDisableInventoryLimit}
                              onCheckedChange={(v) =>
                                setArbDisableInventoryLimit(Boolean(v))
                              }
                            />
                            <div className="space-y-1">
                              <label
                                htmlFor="sl-create-disableInv"
                                className="text-sm font-medium leading-none cursor-pointer"
                              >
                                Disable Inventory Limits
                              </label>
                              <p className="text-xs text-muted-foreground">
                                Ignore inventory constraints
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="sl-create-topoff"
                              checked={arbAllowInventoryTopOff}
                              onCheckedChange={(v) =>
                                setArbAllowInventoryTopOff(Boolean(v))
                              }
                              disabled={arbDisableInventoryLimit}
                            />
                            <div className="space-y-1">
                              <label
                                htmlFor="sl-create-topoff"
                                className="text-sm font-medium leading-none cursor-pointer"
                              >
                                Allow Inventory Top-Off
                              </label>
                              <p className="text-xs text-muted-foreground">
                                Add to existing positions up to max inventory
                                days
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-md border p-4 space-y-4">
                        <div className="text-sm font-medium">
                          Package Quality Filters
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <LabeledInput
                            label="Min Package Net Profit (ISK)"
                            tooltip="Reject packages with net profit below this threshold."
                          >
                            <Input
                              value={minPackageNetProfitISK}
                              onChange={(e) =>
                                setMinPackageNetProfitISK(e.target.value)
                              }
                              placeholder="No minimum"
                            />
                          </LabeledInput>
                          <LabeledInput
                            label="Min Package ROI %"
                            tooltip="Reject packages with ROI (netProfit/spend * 100) below this threshold."
                          >
                            <Input
                              value={minPackageROIPercent}
                              onChange={(e) =>
                                setMinPackageROIPercent(e.target.value)
                              }
                              placeholder="No minimum"
                            />
                          </LabeledInput>
                          <LabeledInput
                            label="Shipping Margin Multiplier"
                            tooltip="Require box gross profit ≥ shipping cost × this multiplier."
                          >
                            <Input
                              value={shippingMarginMultiplier}
                              onChange={(e) =>
                                setShippingMarginMultiplier(e.target.value)
                              }
                              placeholder="Default (1.0)"
                            />
                          </LabeledInput>
                          <LabeledInput
                            label="Density Weight"
                            tooltip="Item prioritization blend: 1.0 = density (profit/m³), 0.0 = ROI (profit/cost)."
                          >
                            <Input
                              value={densityWeight}
                              onChange={(e) => setDensityWeight(e.target.value)}
                              placeholder="Default (1.0)"
                            />
                          </LabeledInput>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Params (JSON)</Label>
                  <Textarea
                    className="min-h-72 font-mono text-xs"
                    value={paramsJson}
                    onChange={(e) => setParamsJson(e.target.value)}
                  />
                </div>
              )}

              <Button
                disabled={createStrategy.isPending}
                onClick={async () => {
                  try {
                    setError(null);
                    if (!newName.trim()) throw new Error("Name is required");
                    const params =
                      createMode === "form"
                        ? buildParamsFromForm()
                        : JSON.parse(paramsJson);
                    await createStrategy.mutateAsync({
                      name: newName.trim(),
                      description: newDescription.trim() || undefined,
                      params,
                      isActive: true,
                    });
                    setNewName("");
                    setNewDescription("");
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                {createStrategy.isPending ? "Creating..." : "Create"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Strategies</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deactivateStrategies.isPending}
                    onClick={async () => {
                      setError(null);
                      const ok = confirm(
                        "Deactivate ALL strategies? (Sets isActive=false; you can recreate fresh strategies after.)",
                      );
                      if (!ok) return;
                      try {
                        await deactivateStrategies.mutateAsync({});
                      } catch (e: unknown) {
                        setError(
                          e instanceof Error ? e.message : "Request failed",
                        );
                      }
                    }}
                  >
                    {deactivateStrategies.isPending
                      ? "Deactivating..."
                      : "Deactivate all"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deactivateStrategies.isPending}
                    onClick={async () => {
                      const filter = nameContains.trim();
                      if (!filter) {
                        setError("Set 'Strategy name contains' first.");
                        return;
                      }
                      setError(null);
                      const ok = confirm(
                        `Deactivate strategies whose name contains "${filter}"?`,
                      );
                      if (!ok) return;
                      try {
                        await deactivateStrategies.mutateAsync({
                          nameContains: filter,
                        });
                      } catch (e: unknown) {
                        setError(
                          e instanceof Error ? e.message : "Request failed",
                        );
                      }
                    }}
                  >
                    Deactivate matching filter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={clearStrategies.isPending}
                    onClick={async () => {
                      setError(null);
                      const ok = confirm(
                        "DELETE ALL strategies? This will permanently delete Strategy Lab strategies (and cascade-delete their runs). This cannot be undone.",
                      );
                      if (!ok) return;
                      try {
                        await clearStrategies.mutateAsync({});
                      } catch (e: unknown) {
                        setError(
                          e instanceof Error ? e.message : "Request failed",
                        );
                      }
                    }}
                  >
                    {clearStrategies.isPending ? "Deleting..." : "Delete all"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={clearStrategies.isPending}
                    onClick={async () => {
                      const filter = nameContains.trim();
                      if (!filter) {
                        setError("Set 'Strategy name contains' first.");
                        return;
                      }
                      setError(null);
                      const ok = confirm(
                        `DELETE strategies whose name contains "${filter}"? This cannot be undone.`,
                      );
                      if (!ok) return;
                      try {
                        await clearStrategies.mutateAsync({
                          nameContains: filter,
                        });
                      } catch (e: unknown) {
                        setError(
                          e instanceof Error ? e.message : "Request failed",
                        );
                      }
                    }}
                  >
                    Delete matching filter
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {strategies.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No strategies yet.
                </div>
              ) : (
                <div className="divide-y rounded-md border">
                  {strategies.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.description ?? "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground">
                          {s.isActive ? "Active" : "Inactive"}
                        </div>
                        <StrategyParamsDialog
                          strategyName={s.name}
                          params={(s as unknown as { params?: unknown }).params}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
