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
import { formatIsk } from "@/lib/utils";
import {
  useCreateTradeStrategy,
  useCreateTradeStrategyRun,
  type TradeStrategyWalkForwardReport,
  type TradeStrategyWalkForwardAllReport,
  useTradeStrategyWalkForward,
  useTradeStrategyWalkForwardAll,
  useTradeStrategyLabSweep,
  type TradeStrategyLabSweepReport,
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

type WalkForwardAggregates = {
  runs: number;
  completed: number;
  winRate: number | null;
  roiMedian: number | null;
  roiP10: number | null;
  roiP90: number | null;
  maxDrawdownWorst: number | null;
  profitMedianIsk: number | null;
  profitP10Isk: number | null;
  profitP90Isk: number | null;
  relistFeesMedianIsk: number | null;
  relistFeesP10Isk: number | null;
  relistFeesP90Isk: number | null;
};

function parseWalkForwardAggregates(x: unknown): WalkForwardAggregates | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
      return Number(v);
    return null;
  };
  return {
    runs: num(o.runs) ?? 0,
    completed: num(o.completed) ?? 0,
    winRate: num(o.winRate),
    roiMedian: num(o.roiMedian),
    roiP10: num(o.roiP10),
    roiP90: num(o.roiP90),
    maxDrawdownWorst: num(o.maxDrawdownWorst),
    profitMedianIsk: num(o.profitMedianIsk),
    profitP10Isk: num(o.profitP10Isk),
    profitP90Isk: num(o.profitP90Isk),
    relistFeesMedianIsk: num(o.relistFeesMedianIsk),
    relistFeesP10Isk: num(o.relistFeesP10Isk),
    relistFeesP90Isk: num(o.relistFeesP90Isk),
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

export default function StrategyLabPage() {
  const { data: strategies = [] } = useTradeStrategies();
  const { data: runs = [] } = useTradeStrategyRuns();
  const createStrategy = useCreateTradeStrategy();
  const createRun = useCreateTradeStrategyRun();
  const walkForward = useTradeStrategyWalkForward();
  const walkForwardAll = useTradeStrategyWalkForwardAll();
  const labSweep = useTradeStrategyLabSweep();

  const [newName, setNewName] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [paramsJson, setParamsJson] = React.useState(
    JSON.stringify(DEFAULT_STRATEGY_PARAMS, null, 2),
  );
  const [error, setError] = React.useState<string | null>(null);

  // Run form
  const [strategyId, setStrategyId] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState<string>("2025-11-24");
  const [endDate, setEndDate] = React.useState<string>("2026-01-11");
  const [initialCapital, setInitialCapital] =
    React.useState<string>("50000000000");
  const [sellSharePct, setSellSharePct] = React.useState<string>("0.20");
  const [priceModel, setPriceModel] = React.useState<"LOW" | "AVG" | "HIGH">(
    "LOW",
  );

  // Walk-forward defaults
  const [wfTrainDays, setWfTrainDays] = React.useState<string>("14");
  const [wfTestDays, setWfTestDays] = React.useState<string>("14");
  const [wfStepDays, setWfStepDays] = React.useState<string>("7");
  const [wfMaxRuns, setWfMaxRuns] = React.useState<string>("6");
  const [wfReport, setWfReport] =
    React.useState<TradeStrategyWalkForwardReport | null>(null);
  const [wfAllReport, setWfAllReport] =
    React.useState<TradeStrategyWalkForwardAllReport | null>(null);
  const [sweepReport, setSweepReport] =
    React.useState<TradeStrategyLabSweepReport | null>(null);

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
              <CardTitle>Start Backtest Run</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Strategy</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={strategyId}
                    onChange={(e) => setStrategyId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {strategies
                      .filter((s) => s.isActive)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Initial Capital (ISK)</Label>
                  <Input
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Start date (YYYY-MM-DD)</Label>
                  <Input
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="2026-01-01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End date (YYYY-MM-DD)</Label>
                  <Input
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="2026-01-30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Daily volume share (0..1)</Label>
                  <Input
                    value={sellSharePct}
                    onChange={(e) => setSellSharePct(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
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
              </div>

              <Button
                disabled={createRun.isPending}
                onClick={async () => {
                  try {
                    setError(null);
                    const cap = Number(initialCapital);
                    const share = Number(sellSharePct);
                    if (!strategyId) throw new Error("Pick a strategy");
                    if (!startDate || !endDate)
                      throw new Error("Provide start/end dates");
                    if (!Number.isFinite(cap) || cap <= 0)
                      throw new Error("Invalid initial capital");
                    if (!Number.isFinite(share) || share < 0 || share > 1)
                      throw new Error("sellSharePct must be between 0 and 1");

                    await createRun.mutateAsync({
                      strategyId,
                      startDate,
                      endDate,
                      initialCapitalIsk: cap,
                      sellModel: "VOLUME_SHARE",
                      sellSharePct: share,
                      priceModel,
                    });
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                {createRun.isPending ? "Running..." : "Run backtest"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Walk-Forward Batch (Automated Validation)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Strategy</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={strategyId}
                    onChange={(e) => setStrategyId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {strategies
                      .filter((s) => s.isActive)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Initial Capital (ISK)</Label>
                  <Input
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                  />
                </div>
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

              <div className="grid gap-4 md:grid-cols-3">
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
                  <Label>Daily volume share (0..1)</Label>
                  <Input
                    value={sellSharePct}
                    onChange={(e) => setSellSharePct(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
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
              </div>

              <Button
                disabled={walkForward.isPending}
                onClick={async () => {
                  try {
                    setError(null);
                    setWfReport(null);
                    setWfAllReport(null);
                    setSweepReport(null);
                    const cap = Number(initialCapital);
                    const share = Number(sellSharePct);
                    const trainDays = Number(wfTrainDays);
                    const testDays = Number(wfTestDays);
                    const stepDays = Number(wfStepDays);
                    const maxRuns = Number(wfMaxRuns);

                    if (!strategyId) throw new Error("Pick a strategy");
                    if (!startDate || !endDate)
                      throw new Error("Provide start/end dates");
                    if (!Number.isFinite(cap) || cap <= 0)
                      throw new Error("Invalid initial capital");
                    if (!Number.isFinite(share) || share < 0 || share > 1)
                      throw new Error("sellSharePct must be between 0 and 1");
                    if (!Number.isFinite(trainDays) || trainDays < 1)
                      throw new Error("trainDays must be >= 1");
                    if (!Number.isFinite(testDays) || testDays < 1)
                      throw new Error("testDays must be >= 1");
                    if (!Number.isFinite(stepDays) || stepDays < 1)
                      throw new Error("stepDays must be >= 1");
                    if (!Number.isFinite(maxRuns) || maxRuns < 1)
                      throw new Error("maxRuns must be >= 1");

                    const report = await walkForward.mutateAsync({
                      strategyId,
                      startDate,
                      endDate,
                      initialCapitalIsk: cap,
                      trainWindowDays: trainDays,
                      testWindowDays: testDays,
                      stepDays,
                      maxRuns,
                      sellModel: "VOLUME_SHARE",
                      sellSharePct: share,
                      priceModel,
                    });
                    setWfReport(report);
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                {walkForward.isPending
                  ? "Running batch..."
                  : "Run walk-forward"}
              </Button>

              <Button
                variant="outline"
                disabled={walkForwardAll.isPending}
                onClick={async () => {
                  try {
                    setError(null);
                    setWfReport(null);
                    setWfAllReport(null);
                    setSweepReport(null);
                    const cap = Number(initialCapital);
                    const share = Number(sellSharePct);
                    const trainDays = Number(wfTrainDays);
                    const testDays = Number(wfTestDays);
                    const stepDays = Number(wfStepDays);
                    const maxRuns = Number(wfMaxRuns);

                    if (!startDate || !endDate)
                      throw new Error("Provide start/end dates");
                    if (!Number.isFinite(cap) || cap <= 0)
                      throw new Error("Invalid initial capital");
                    if (!Number.isFinite(share) || share < 0 || share > 1)
                      throw new Error("sellSharePct must be between 0 and 1");
                    if (!Number.isFinite(trainDays) || trainDays < 1)
                      throw new Error("trainDays must be >= 1");
                    if (!Number.isFinite(testDays) || testDays < 1)
                      throw new Error("testDays must be >= 1");
                    if (!Number.isFinite(stepDays) || stepDays < 1)
                      throw new Error("stepDays must be >= 1");
                    if (!Number.isFinite(maxRuns) || maxRuns < 1)
                      throw new Error("maxRuns must be >= 1");

                    const report = await walkForwardAll.mutateAsync({
                      startDate,
                      endDate,
                      initialCapitalIsk: cap,
                      trainWindowDays: trainDays,
                      testWindowDays: testDays,
                      stepDays,
                      maxRuns,
                      sellModel: "VOLUME_SHARE",
                      sellSharePct: share,
                      priceModel,
                      nameContains: "SL-",
                    });
                    setWfAllReport(report);
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                {walkForwardAll.isPending
                  ? "Running all..."
                  : "Run for all strategies"}
              </Button>

              <Button
                variant="outline"
                disabled={labSweep.isPending}
                onClick={async () => {
                  try {
                    setError(null);
                    setWfReport(null);
                    setWfAllReport(null);
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
                      sellModel: "VOLUME_SHARE",
                      // default sweep: price models x sell shares
                      priceModels: ["LOW", "AVG", "HIGH"],
                      sellSharePcts: [0.1, 0.2],
                      nameContains: "SL-",
                    });
                    setSweepReport(report);
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                {labSweep.isPending ? "Sweeping..." : "Run lab sweep"}
              </Button>

              {wfReport && (
                <div className="space-y-4">
                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-medium">Batch report</div>
                    <div className="text-muted-foreground">
                      {(() => {
                        const agg = parseWalkForwardAggregates(
                          (wfReport as Record<string, unknown>).aggregates,
                        );
                        if (!agg) return "—";
                        const win =
                          agg.winRate !== null
                            ? `${(agg.winRate * 100).toFixed(0)}%`
                            : "—";
                        const roiMed =
                          agg.roiMedian !== null
                            ? `${agg.roiMedian.toFixed(2)}%`
                            : "—";
                        const ddWorst =
                          agg.maxDrawdownWorst !== null
                            ? `${agg.maxDrawdownWorst.toFixed(2)}%`
                            : "—";
                        return `runs=${agg.runs}, completed=${agg.completed}, winRate=${win}, roiMedian=${roiMed}, worstDD=${ddWorst}`;
                      })()}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Runs</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="divide-y rounded-md border">
                          {(
                            (wfReport as Record<string, unknown>).runs as Array<
                              Record<string, unknown>
                            >
                          )
                            .slice(0, 20)
                            .map((r) => {
                              const id = String(r.runId ?? "");
                              const sum = parseRunSummary(r.summary);
                              return (
                                <div
                                  key={id}
                                  className="p-3 flex items-center justify-between"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {String(r.testStartDate)} →{" "}
                                      {String(r.testEndDate)} •{" "}
                                      {String(r.status)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      train {String(r.trainStartDate)} →{" "}
                                      {String(r.trainEndDate)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-sm tabular-nums">
                                      {sum.totalProfitIsk !== undefined
                                        ? formatIsk(sum.totalProfitIsk)
                                        : "—"}
                                    </div>
                                    <Link
                                      href={`/tradecraft/admin/strategy-lab/${id}`}
                                    >
                                      <Button variant="outline" size="sm">
                                        View
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Recurring losers (blacklist candidates)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="divide-y rounded-md border">
                          {(
                            (wfReport as Record<string, unknown>)
                              .blacklistSuggestions as Array<
                              Record<string, unknown>
                            >
                          )
                            .slice(0, 20)
                            .map((x) => (
                              <div
                                key={`${String(x.typeId)}:${String(
                                  x.destinationStationId,
                                )}`}
                                className="p-3 flex items-center justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {String(x.typeName ?? `typeId=${x.typeId}`)}{" "}
                                    • dst {String(x.destinationStationId)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    loserRuns={String(x.loserRuns)}
                                  </div>
                                </div>
                                <div className="text-sm tabular-nums">
                                  {formatIsk(Number(x.totalLossIsk))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {wfAllReport && (
                <div className="space-y-4">
                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-medium">All-strategies report</div>
                    <div className="text-muted-foreground">
                      batch={wfAllReport.globalBatchId} • strategies=
                      {wfAllReport.results.length}
                    </div>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Strategy leaderboard (median ROI)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="divide-y rounded-md border">
                        {wfAllReport.results.map((r) => {
                          const agg = parseWalkForwardAggregates(
                            r.report.aggregates,
                          );
                          const roi =
                            agg?.roiMedian !== null &&
                            agg?.roiMedian !== undefined
                              ? `${agg.roiMedian.toFixed(2)}%`
                              : "—";
                          const dd =
                            agg?.maxDrawdownWorst !== null &&
                            agg?.maxDrawdownWorst !== undefined
                              ? `${agg.maxDrawdownWorst.toFixed(2)}%`
                              : "—";
                          const win =
                            agg?.winRate !== null && agg?.winRate !== undefined
                              ? `${(agg.winRate * 100).toFixed(0)}%`
                              : "—";
                          const relist =
                            agg?.relistFeesMedianIsk !== null &&
                            agg?.relistFeesMedianIsk !== undefined
                              ? formatIsk(agg.relistFeesMedianIsk)
                              : "—";
                          return (
                            <div
                              key={r.strategyId}
                              className="p-3 flex items-center justify-between"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {r.strategyName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  runs={agg?.runs ?? "—"} • winRate={win} •
                                  worstDD={dd} • relistFees(med)={relist}
                                </div>
                              </div>
                              <div className="text-sm tabular-nums">{roi}</div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {wfAllReport.globalBlacklistSuggestions?.length ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Global blacklist candidates</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="divide-y rounded-md border">
                          {wfAllReport.globalBlacklistSuggestions
                            .slice(0, 25)
                            .map((x) => (
                              <div
                                key={`${x.typeId}:${x.destinationStationId}`}
                                className="p-3 flex items-center justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {x.typeName ?? `typeId=${x.typeId}`} • dst{" "}
                                    {x.destinationStationId}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    loserRuns={x.loserRuns} • strategies=
                                    {x.strategies.slice(0, 3).join(", ")}
                                    {x.strategies.length > 3 ? "…" : ""}
                                  </div>
                                </div>
                                <div className="text-sm tabular-nums">
                                  {formatIsk(Number(x.totalLossIsk))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              )}

              {sweepReport && (
                <div className="space-y-4">
                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-medium">Lab sweep report</div>
                    <div className="text-muted-foreground">
                      sweep={sweepReport.globalSweepId} • scenarios=
                      {sweepReport.scenarios.length} • strategies=
                      {sweepReport.results.length}
                    </div>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Winner (robust score)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {sweepReport.results[0] ? (
                        <div className="rounded-md border p-3 flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {sweepReport.results[0].strategyName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              overallScore=
                              {sweepReport.results[0].overallScore !== null
                                ? sweepReport.results[0].overallScore.toFixed(3)
                                : "—"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">—</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Robust ranking (median score across scenarios)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="divide-y rounded-md border">
                        {sweepReport.results.map((r) => (
                          <div
                            key={r.strategyId}
                            className="p-3 flex items-center justify-between"
                          >
                            <div className="text-sm font-medium truncate">
                              {r.strategyName}
                            </div>
                            <div className="text-sm tabular-nums">
                              {r.overallScore !== null
                                ? r.overallScore.toFixed(3)
                                : "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Runs</CardTitle>
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

              <div className="space-y-2">
                <Label>Params (JSON)</Label>
                <Textarea
                  className="min-h-72 font-mono text-xs"
                  value={paramsJson}
                  onChange={(e) => setParamsJson(e.target.value)}
                />
              </div>

              <Button
                disabled={createStrategy.isPending}
                onClick={async () => {
                  try {
                    setError(null);
                    if (!newName.trim()) throw new Error("Name is required");
                    const params = JSON.parse(paramsJson);
                    const created = await createStrategy.mutateAsync({
                      name: newName.trim(),
                      description: newDescription.trim() || undefined,
                      params,
                      isActive: true,
                    });
                    setStrategyId(created.id);
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
              <CardTitle>Strategies</CardTitle>
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
                      <div className="text-xs text-muted-foreground">
                        {s.isActive ? "Active" : "Inactive"}
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
