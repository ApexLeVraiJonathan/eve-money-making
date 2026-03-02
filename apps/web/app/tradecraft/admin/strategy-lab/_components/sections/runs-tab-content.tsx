import Link from "next/link";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TabsContent,
  Textarea,
} from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import type {
  TradeStrategyCycleRobustnessReport,
  TradeStrategyCycleWalkForwardAllReport,
  TradeStrategyLabSweepReport,
} from "../../../../api";
import {
  useClearTradeStrategyRuns,
  useTradeStrategyCycleRobustness,
  useTradeStrategyCycleWalkForwardAll,
  useTradeStrategyLabSweep,
} from "../../../../api";
import { parseRunSummary } from "../lib/parse-run-summary";
import { AUTO_BLACKLIST_CANDIDATES } from "../lib/blacklist-candidates";
import {
  avgP10Isk,
  buildBlacklistFromRepeatOffenders,
  formatRepeatOffenderDetails,
} from "../lib/blacklist-utils";
import type { BlacklistAutoBest } from "../lib/types";

export type RunsTabContentProps = {
  coverage: ReturnType<typeof import("../../../../api").useStrategyLabMarketDataCoverage>;
  cycleWalkForwardAll: ReturnType<typeof useTradeStrategyCycleWalkForwardAll>;
  cycleRobustness: ReturnType<typeof useTradeStrategyCycleRobustness>;
  labSweep: ReturnType<typeof useTradeStrategyLabSweep>;
  clearRuns: ReturnType<typeof useClearTradeStrategyRuns>;
  runs: ReturnType<typeof import("../../../../api").useTradeStrategyRuns>["data"];

  setError: (value: string | null) => void;

  startDate: string;
  setStartDate: (value: string) => void;
  cycleCount: string;
  setCycleCount: (value: string) => void;
  cycleDays: string;
  setCycleDays: (value: string) => void;
  initialCapital: string;
  setInitialCapital: (value: string) => void;
  sellSharePct: string;
  setSellSharePct: (value: string) => void;
  priceModel: "LOW" | "AVG" | "HIGH";
  setPriceModel: (value: "LOW" | "AVG" | "HIGH") => void;
  rebuyTriggerCashPct: string;
  setRebuyTriggerCashPct: (value: string) => void;
  reserveCashPct: string;
  setReserveCashPct: (value: string) => void;
  nameContains: string;
  setNameContains: (value: string) => void;
  repricesPerDay: string;
  setRepricesPerDay: (value: string) => void;
  skipRepriceIfMarginPctLeq: string;
  setSkipRepriceIfMarginPctLeq: (value: string) => void;
  inventoryMode: "IGNORE" | "SKIP_EXISTING" | "TOP_OFF";
  setInventoryMode: (value: "IGNORE" | "SKIP_EXISTING" | "TOP_OFF") => void;
  singleBuy: boolean;
  setSingleBuy: (value: boolean) => void;

  cycleWfReport: TradeStrategyCycleWalkForwardAllReport | null;
  setCycleWfReport: (value: TradeStrategyCycleWalkForwardAllReport | null) => void;

  robustFrom: string;
  setRobustFrom: (value: string) => void;
  robustTo: string;
  setRobustTo: (value: string) => void;
  robustStepDays: string;
  setRobustStepDays: (value: string) => void;
  robustMaxDays: string;
  setRobustMaxDays: (value: string) => void;
  useBlacklistCompare: boolean;
  setUseBlacklistCompare: (value: boolean) => void;
  blacklistJson: string;
  setBlacklistJson: (value: string) => void;
  blacklistBuildFrom: "noBlacklist" | "withBlacklist";
  setBlacklistBuildFrom: (value: "noBlacklist" | "withBlacklist") => void;
  blacklistBuildMinRuns: string;
  setBlacklistBuildMinRuns: (value: string) => void;
  blacklistBuildMinLoserRatePct: string;
  setBlacklistBuildMinLoserRatePct: (value: string) => void;
  blacklistBuildMinRedRatePct: string;
  setBlacklistBuildMinRedRatePct: (value: string) => void;
  blacklistBuildMode: "OR" | "AND";
  setBlacklistBuildMode: (value: "OR" | "AND") => void;
  blacklistBuildMaxItems: string;
  setBlacklistBuildMaxItems: (value: string) => void;
  blacklistAutoStatus: string | null;
  setBlacklistAutoStatus: (value: string | null) => void;
  blacklistAutoBest: BlacklistAutoBest | null;
  setBlacklistAutoBest: (value: BlacklistAutoBest | null) => void;
  robustReport: TradeStrategyCycleRobustnessReport | null;
  setRobustReport: (value: TradeStrategyCycleRobustnessReport | null) => void;

  wfTrainDays: string;
  setWfTrainDays: (value: string) => void;
  wfTestDays: string;
  setWfTestDays: (value: string) => void;
  wfStepDays: string;
  setWfStepDays: (value: string) => void;
  wfMaxRuns: string;
  setWfMaxRuns: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  sellModel: "VOLUME_SHARE" | "CALIBRATED_CAPTURE";
  setSellModel: (value: "VOLUME_SHARE" | "CALIBRATED_CAPTURE") => void;
  sweepReport: TradeStrategyLabSweepReport | null;
  setSweepReport: (value: TradeStrategyLabSweepReport | null) => void;
};

export function RunsTabContent({
  coverage,
  cycleWalkForwardAll,
  cycleRobustness,
  labSweep,
  clearRuns,
  runs = [],
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
}: RunsTabContentProps) {
  return (
    <TabsContent value="runs" className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cycle Walk-Forward (Rolling Cycle Simulation)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Simulates repeated 14-day cycles with rebuy triggers and
            rollover-at-cost. Ranking is by total profit across cycles (cash
            based; leftover inventory is neutralized by cost rollover).
          </div>

          {coverage.data && (
            <Alert
              variant={coverage.data.coverage.isComplete ? "default" : "destructive"}
            >
              <AlertDescription className="text-xs">
                Market data coverage for {coverage.data.requested.startDate} →{" "}
                {coverage.data.requested.endDate} ({coverage.data.requested.days}{" "}
                days): haveDays={coverage.data.coverage.haveDays}, missingDays=
                {coverage.data.coverage.missingDays}. Table earliest/latest:{" "}
                {coverage.data.available.minDate ?? "—"} →{" "}
                {coverage.data.available.maxDate ?? "—"}.
                {coverage.data.missingDates?.length ? (
                  <>
                    {" "}
                    Missing dates (first {coverage.data.missingDates.length}):{" "}
                    {coverage.data.missingDates.join(", ")}.
                  </>
                ) : null}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Cycle start date (YYYY-MM-DD)</Label>
              <Input value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cycles</Label>
              <Input value={cycleCount} onChange={(e) => setCycleCount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cycle days</Label>
              <Input value={cycleDays} onChange={(e) => setCycleDays(e.target.value)} />
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
                onChange={(e) => setSkipRepriceIfMarginPctLeq(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Inventory mode (rebuy planning)</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={inventoryMode}
                onChange={(e) =>
                  setInventoryMode(
                    e.target.value as "IGNORE" | "SKIP_EXISTING" | "TOP_OFF",
                  )
                }
              >
                <option value="IGNORE">
                  IGNORE (Strategy Lab legacy / no inventory limits)
                </option>
                <option value="SKIP_EXISTING">SKIP_EXISTING (prod default)</option>
                <option value="TOP_OFF">TOP_OFF (allowInventoryTopOff)</option>
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
                Run the planner once at cycle start, then only sell/reprice until
                positions are sold or marked red (no rebuys).
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
                    skipRepriceIfMarginPctLeq: Number(skipRepriceIfMarginPctLeq),
                    nameContains: nameContains || undefined,
                    singleBuy,
                    sellModel: "VOLUME_SHARE",
                    sellSharePct: Number(sellSharePct),
                    priceModel,
                    inventoryMode,
                  });
                  setCycleWfReport(report);
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Request failed");
                }
              }}
            >
              {cycleWalkForwardAll.isPending
                ? "Simulating..."
                : "Run cycle walk-forward (all strategies)"}
            </Button>
            <Button variant="outline" onClick={() => setCycleWfReport(null)}>
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
                              avgCash/cycle={formatIsk(r.avgProfitCashIskPerCycle)}
                              {" • "}navΔ={formatIsk(r.totalProfitIsk)}
                              {" • "}lastCycleProfit=
                              {r.cycles.length
                                ? formatIsk(r.cycles[r.cycles.length - 1].profitCashIsk)
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
                                cycle {c.cycleIndex}: {c.startDate} {"→"} {c.endDate}
                              </div>
                              <div className="text-sm tabular-nums">
                                {formatIsk(c.profitCashIsk)}
                              </div>
                            </div>

                            <div className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                              <div>
                                <span className="text-muted-foreground">buyEvents:</span>{" "}
                                <span className="tabular-nums">{c.buyEvents}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">relistFees:</span>{" "}
                                <span className="tabular-nums">
                                  {formatIsk(c.relistFeesPaidIsk)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">salesTax:</span>{" "}
                                <span className="tabular-nums">
                                  {formatIsk(c.salesTaxIsk)}
                                </span>
                              </div>

                              <div>
                                <span className="text-muted-foreground">brokersFee:</span>{" "}
                                <span className="tabular-nums">
                                  {formatIsk(c.brokerFeesIsk)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">shipping:</span>{" "}
                                <span className="tabular-nums">
                                  {formatIsk(c.totalShippingIsk)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">netSales:</span>{" "}
                                <span className="tabular-nums">
                                  {formatIsk(c.salesNetIsk)}
                                </span>
                              </div>

                              <div>
                                <span className="text-muted-foreground">COGS:</span>{" "}
                                <span className="tabular-nums">{formatIsk(c.cogsIsk)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">profit:</span>{" "}
                                <span className="tabular-nums">
                                  {formatIsk(c.profitCashIsk)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">margin:</span>{" "}
                                <span className="tabular-nums">
                                  {c.roiPct !== null ? `${c.roiPct.toFixed(2)}%` : "—"}
                                </span>
                              </div>

                              <div>
                                <span className="text-muted-foreground">cashEnd:</span>{" "}
                                <span className="tabular-nums">
                                  {formatIsk(c.cashEndIsk)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">invCostEnd:</span>{" "}
                                <span className="tabular-nums">
                                  {formatIsk(c.inventoryCostEndIsk)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">sellNet/u:</span>{" "}
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
                                    {c.repricesApplied}, skippedRed {c.repricesSkippedRed},
                                    unitsSold {c.unitsSold}, heldPairsEnd {c.positionsHeldEnd},
                                    cashPct(min/max) {c.cashPctMin.toFixed(2)}/
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
                                    (spend {formatIsk(c.totalSpendIsk)}, reprices{" "}
                                    {c.repricesApplied}, skippedRed {c.repricesSkippedRed},
                                    unitsSold {c.unitsSold}, heldPairsEnd {c.positionsHeldEnd},
                                    cashPct(min/max) {c.cashPctMin.toFixed(2)}/
                                    {c.cashPctMax.toFixed(2)}, ΔNAV{" "}
                                    {formatIsk(c.profitIsk)})
                                  </span>
                                </summary>
                                <div className="mt-1 text-muted-foreground">—</div>
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
            strategies by <span className="font-medium">profit p10</span> (bad-case),
            then median. This is designed to reduce bad cycles.
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Start date from</Label>
              <Input value={robustFrom} onChange={(e) => setRobustFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Start date to</Label>
              <Input value={robustTo} onChange={(e) => setRobustTo(e.target.value)} />
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
              <Input value={robustMaxDays} onChange={(e) => setRobustMaxDays(e.target.value)} />
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
                Runs the robustness report twice: without blacklist and with your
                blacklist, so you can detect when blacklisting starts hurting results.
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
                  {"{ globalTypeIds: number[], byDestinationTypeIds: { [stationId]: number[] } }"}
                </span>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="text-sm font-medium">
                  Blacklist builder (from repeat offenders)
                </div>
                <div className="text-xs text-muted-foreground">
                  Uses the last robustness report&apos;s repeat offenders list to
                  generate a per-destination blacklist JSON.
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <div className="space-y-2">
                    <Label>Build from</Label>
                    <Select
                      value={blacklistBuildFrom}
                      onValueChange={(v) =>
                        setBlacklistBuildFrom(v as "noBlacklist" | "withBlacklist")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="noBlacklist">NO blacklist</SelectItem>
                        <SelectItem value="withBlacklist">WITH blacklist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Min runs</Label>
                    <Input
                      value={blacklistBuildMinRuns}
                      onChange={(e) => setBlacklistBuildMinRuns(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min loserRate %</Label>
                    <Input
                      value={blacklistBuildMinLoserRatePct}
                      onChange={(e) => setBlacklistBuildMinLoserRatePct(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min redRate %</Label>
                    <Input
                      value={blacklistBuildMinRedRatePct}
                      onChange={(e) => setBlacklistBuildMinRedRatePct(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max items</Label>
                    <Input
                      value={blacklistBuildMaxItems}
                      onChange={(e) => setBlacklistBuildMaxItems(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Mode</Label>
                    <Select
                      value={blacklistBuildMode}
                      onValueChange={(v) => setBlacklistBuildMode(v as "OR" | "AND")}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OR">OR (either threshold)</SelectItem>
                        <SelectItem value="AND">AND (both thresholds)</SelectItem>
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
                      const next = buildBlacklistFromRepeatOffenders(src.repeatOffenders, {
                        minRuns: Number(blacklistBuildMinRuns),
                        minLoserRatePct: Number(blacklistBuildMinLoserRatePct),
                        minRedRatePct: Number(blacklistBuildMinRedRatePct),
                        mode: blacklistBuildMode,
                        maxItems: Number(blacklistBuildMaxItems),
                      });
                      setBlacklistJson(JSON.stringify(next, null, 2));
                    }}
                  >
                    Generate JSON from offenders
                  </Button>
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="text-sm font-medium">Auto-tune blacklist (grid search)</div>
                <div className="text-xs text-muted-foreground">
                  Runs robustness once for a baseline, then tries a handful of
                  blacklist tiers automatically and picks the one with the best
                  average p10 uplift across the matched strategies.
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
                          skipRepriceIfMarginPctLeq: Number(skipRepriceIfMarginPctLeq),
                          inventoryMode,
                          nameContains: nameContains.trim() || undefined,
                          priceModel,
                        });

                        const offenders = base.reports.noBlacklist.repeatOffenders ?? [];
                        const baselineAvg = avgP10Isk(base.reports.noBlacklist.results);

                        if (!offenders.length) {
                          setBlacklistAutoStatus(
                            "No repeat offenders in baseline (nothing to auto-blacklist).",
                          );
                          setRobustReport(base);
                          return;
                        }

                        let best: (BlacklistAutoBest & {
                          report: TradeStrategyCycleRobustnessReport;
                        }) | null = null;

                        for (let i = 0; i < AUTO_BLACKLIST_CANDIDATES.length; i++) {
                          const cand = AUTO_BLACKLIST_CANDIDATES[i];
                          setBlacklistAutoStatus(
                            `Testing ${i + 1}/${AUTO_BLACKLIST_CANDIDATES.length}: ${cand.label}`,
                          );

                          const bl = buildBlacklistFromRepeatOffenders(offenders, cand.opts);
                          const report = await cycleRobustness.mutateAsync({
                            startDateFrom: robustFrom,
                            startDateTo: robustTo,
                            stepDays: Number(robustStepDays),
                            maxDays: Number(robustMaxDays),
                            initialCapitalIsk: Number(initialCapital),
                            sellSharePct: Number(sellSharePct),
                            repricesPerDay: Number(repricesPerDay),
                            skipRepriceIfMarginPctLeq: Number(skipRepriceIfMarginPctLeq),
                            inventoryMode,
                            nameContains: nameContains.trim() || undefined,
                            priceModel,
                            blacklist: bl,
                          });

                          const withAvg = avgP10Isk(report.reports.withBlacklist?.results);
                          const delta =
                            baselineAvg !== null && withAvg !== null
                              ? withAvg - baselineAvg
                              : null;

                          const candJson = JSON.stringify(bl, null, 2);
                          if (
                            !best ||
                            (best.avgDeltaP10Isk === null && delta !== null) ||
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
                          setBlacklistAutoStatus("Auto-tune failed to pick a best tier.");
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
                        setError(e instanceof Error ? e.message : "Request failed");
                      }
                    }}
                  >
                    Auto-tune & apply best
                  </Button>
                  {blacklistAutoStatus ? (
                    <div className="text-xs text-muted-foreground">{blacklistAutoStatus}</div>
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
                    skipRepriceIfMarginPctLeq: Number(skipRepriceIfMarginPctLeq),
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
                  setError(e instanceof Error ? e.message : "Request failed");
                }
              }}
            >
              {cycleRobustness.isPending ? "Running..." : "Run robustness report"}
            </Button>
            <Button variant="outline" onClick={() => setRobustReport(null)}>
              Clear
            </Button>
          </div>

          {robustReport && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                starts={robustReport.starts.length} • step={robustReport.config.stepDays} •
                maxDays={robustReport.config.maxDays} • priceModel=
                {robustReport.config.priceModel} • invMode=
                {robustReport.config.inventoryMode}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Ranking (NO blacklist)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="divide-y rounded-md border">
                    {robustReport.reports.noBlacklist.results.slice(0, 30).map((r) => (
                      <div
                        key={r.strategyId}
                        className="p-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{r.strategyName}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            p10=
                            {r.profitP10Isk !== null ? formatIsk(r.profitP10Isk) : "—"} •
                            med=
                            {r.profitMedianIsk !== null ? formatIsk(r.profitMedianIsk) : "—"} •
                            p90=
                            {r.profitP90Isk !== null ? formatIsk(r.profitP90Isk) : "—"} •
                            lossRate=
                            {r.lossRate !== null ? `${(r.lossRate * 100).toFixed(1)}%` : "—"} •
                            runs={r.runs}
                          </div>
                        </div>
                        <div className="text-sm tabular-nums">
                          {r.profitP10Isk !== null ? formatIsk(r.profitP10Isk) : "—"}
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
                  {robustReport.reports.noBlacklist.repeatOffenders.length ? (
                    <div className="divide-y rounded-md border">
                      {robustReport.reports.noBlacklist.repeatOffenders.map((x) => (
                        <div
                          key={`${x.destinationStationId}:${x.typeId}`}
                          className="p-3 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {x.typeName
                                ? `${x.typeName} (typeId=${x.typeId})`
                                : `typeId=${x.typeId}`}{" "}
                              • {x.stationName ? x.stationName : `dst ${x.destinationStationId}`}
                            </div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {formatRepeatOffenderDetails(x)}
                            </div>
                          </div>
                          <div className="text-sm tabular-nums">
                            {formatIsk(x.totalLossCashIsk)}
                          </div>
                        </div>
                      ))}
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
                        {robustReport.reports.withBlacklist.results.slice(0, 30).map((r) => (
                          <div
                            key={r.strategyId}
                            className="p-3 flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{r.strategyName}</div>
                              <div className="text-xs text-muted-foreground tabular-nums">
                                p10=
                                {r.profitP10Isk !== null ? formatIsk(r.profitP10Isk) : "—"} •
                                med=
                                {r.profitMedianIsk !== null
                                  ? formatIsk(r.profitMedianIsk)
                                  : "—"}{" "}
                                • p90=
                                {r.profitP90Isk !== null ? formatIsk(r.profitP90Isk) : "—"} •
                                lossRate=
                                {r.lossRate !== null
                                  ? `${(r.lossRate * 100).toFixed(1)}%`
                                  : "—"}{" "}
                                • runs={r.runs}
                              </div>
                            </div>
                            <div className="text-sm tabular-nums">
                              {r.profitP10Isk !== null ? formatIsk(r.profitP10Isk) : "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Repeat offenders (WITH blacklist)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {robustReport.reports.withBlacklist.repeatOffenders.length ? (
                        <div className="divide-y rounded-md border">
                          {robustReport.reports.withBlacklist.repeatOffenders.map((x) => (
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
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">—</div>
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
            Runs a multi-scenario sweep across active strategies and returns a
            ranked report (ROI-first, then drawdown, light relist penalty).
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Train days</Label>
              <Input value={wfTrainDays} onChange={(e) => setWfTrainDays(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Test days</Label>
              <Input value={wfTestDays} onChange={(e) => setWfTestDays(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Step days</Label>
              <Input value={wfStepDays} onChange={(e) => setWfStepDays(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Max runs</Label>
              <Input value={wfMaxRuns} onChange={(e) => setWfMaxRuns(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Start date (YYYY-MM-DD)</Label>
              <Input value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End date (YYYY-MM-DD)</Label>
              <Input value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
                  setSellModel(e.target.value as "VOLUME_SHARE" | "CALIBRATED_CAPTURE")
                }
              >
                <option value="VOLUME_SHARE">VOLUME_SHARE</option>
                <option value="CALIBRATED_CAPTURE">CALIBRATED_CAPTURE</option>
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

                  if (!startDate || !endDate) throw new Error("Provide start/end dates");
                  if (!Number.isFinite(cap) || cap <= 0) {
                    throw new Error("Invalid initial capital");
                  }

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
                      sellModel === "VOLUME_SHARE" ? [0.05, 0.1, 0.15, 0.2] : [0.05],
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
                  {sweepReport.scenarios.length} • strategies={sweepReport.results.length}
                </div>
                <div className="text-muted-foreground">
                  score = roiMedian − 0.15×worstDD − 0.05×relistFeesMedian%capital
                  (ROI dominates; DD secondary; relist is a light penalty)
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
                        return arr.length % 2 === 1 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
                      };

                      const rois = w.scenarioScores
                        .map((s) => s.roiMedian)
                        .filter(
                          (x): x is number => typeof x === "number" && Number.isFinite(x),
                        )
                        .sort((a, b) => a - b);
                      const dds = w.scenarioScores
                        .map((s) => s.worstDD)
                        .filter(
                          (x): x is number => typeof x === "number" && Number.isFinite(x),
                        )
                        .sort((a, b) => a - b);
                      const relists = w.scenarioScores
                        .map((s) => s.relistFeesMedianIsk)
                        .filter(
                          (x): x is number => typeof x === "number" && Number.isFinite(x),
                        )
                        .sort((a, b) => a - b);

                      const roiMed = medianOfSorted(rois);
                      const ddMed = medianOfSorted(dds);
                      const relistMed = medianOfSorted(relists);

                      return (
                        <div className="rounded-md border p-3 flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{w.strategyName}</div>
                            <div className="text-xs text-muted-foreground">
                              overallScore=
                              {w.overallScore !== null ? w.overallScore.toFixed(3) : "—"}
                              {" • "}roiMedian=
                              {roiMed !== null ? `${roiMed.toFixed(2)}%` : "—"}
                              {" • "}worstDD(med)=
                              {ddMed !== null ? `${ddMed.toFixed(2)}%` : "—"}
                              {" • "}relistFees(med)=
                              {relistMed !== null ? formatIsk(relistMed) : "—"}
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
                  <CardTitle>Robust ranking (sorted by low sell-share score)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="divide-y rounded-md border">
                    {sweepReport.results.map((r) => {
                      const medianOfSorted = (arr: number[]) => {
                        if (arr.length === 0) return null;
                        const mid = Math.floor(arr.length / 2);
                        return arr.length % 2 === 1 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
                      };

                      const rois = r.scenarioScores
                        .map((s) => s.roiMedian)
                        .filter(
                          (x): x is number => typeof x === "number" && Number.isFinite(x),
                        )
                        .sort((a, b) => a - b);
                      const dds = r.scenarioScores
                        .map((s) => s.worstDD)
                        .filter(
                          (x): x is number => typeof x === "number" && Number.isFinite(x),
                        )
                        .sort((a, b) => a - b);
                      const relists = r.scenarioScores
                        .map((s) => s.relistFeesMedianIsk)
                        .filter(
                          (x): x is number => typeof x === "number" && Number.isFinite(x),
                        )
                        .sort((a, b) => a - b);

                      const roiMed = medianOfSorted(rois);
                      const ddMed = medianOfSorted(dds);
                      const relistMed = medianOfSorted(relists);

                      const lowShareScore = r.sellShareSummary?.scoreAtMinSellShare ?? null;
                      const robustMin =
                        r.sellShareSummary?.robustScoreMinAcrossSellShares ?? null;
                      const robustMed =
                        r.sellShareSummary?.robustScoreMedianAcrossSellShares ?? null;
                      const primaryRankScore = lowShareScore;

                      return (
                        <div
                          key={r.strategyId}
                          className="p-3 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{r.strategyName}</div>
                            <div className="text-xs text-muted-foreground">
                              roiMedian=
                              {roiMed !== null ? `${roiMed.toFixed(2)}%` : "—"}
                              {" • "}worstDD(med)=
                              {ddMed !== null ? `${ddMed.toFixed(2)}%` : "—"}
                              {" • "}relistFees(med)=
                              {relistMed !== null ? formatIsk(relistMed) : "—"}
                              {" • "}lowSellShareScore=
                              {lowShareScore !== null ? lowShareScore.toFixed(3) : "—"}
                              {" • "}robust(min/med)=
                              {robustMin !== null ? robustMin.toFixed(3) : "—"}/
                              {robustMed !== null ? robustMed.toFixed(3) : "—"}
                              {" • "}overallScore=
                              {r.overallScore !== null ? r.overallScore.toFixed(3) : "—"}
                            </div>
                          </div>
                          <div className="text-sm tabular-nums">
                            {primaryRankScore !== null ? primaryRankScore.toFixed(3) : "—"}
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
                    setError(e instanceof Error ? e.message : "Request failed");
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
            <div className="text-sm text-muted-foreground">No runs yet.</div>
          ) : (
            <div className="divide-y rounded-md border">
              {runs.slice(0, 20).map((r) => {
                const summary = parseRunSummary(r.summary);
                const profit = summary.totalProfitIsk ?? null;
                return (
                  <div key={r.id} className="p-3 flex items-center justify-between">
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
  );
}
