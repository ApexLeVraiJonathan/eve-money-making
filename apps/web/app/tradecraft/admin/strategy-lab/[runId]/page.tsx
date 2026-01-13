"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import { useTradeStrategyRun } from "../../../api";

type RunSummary = {
  totalProfitIsk?: number;
  roiPercent?: number | null;
  maxDrawdownPct?: number;
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
  };
}

export default function StrategyRunDetailPage() {
  const params = useParams();
  const runId = String((params as { runId?: string }).runId ?? "");
  const { data, isLoading, error } = useTradeStrategyRun(runId);

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error)
    return (
      <div className="p-6">
        <div className="rounded-md border p-4 text-sm">
          {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  if (!data) return <div className="p-6">Not found.</div>;

  const summary = parseRunSummary(data.summary);
  const totalProfit = summary.totalProfitIsk ?? null;
  const roi = summary.roiPercent ?? null;
  const dd = summary.maxDrawdownPct ?? null;

  const last = data.days[data.days.length - 1];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Run: {data.strategy.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {String(data.startDate).slice(0, 10)} →{" "}
            {String(data.endDate).slice(0, 10)} • {data.status}
          </p>
        </div>
        <Link href="/tradecraft/admin/strategy-lab">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Profit</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {totalProfit !== null ? formatIsk(Number(totalProfit)) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ROI %</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {roi !== null ? `${Number(roi).toFixed(2)}%` : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Max Drawdown %</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {dd !== null ? `${Number(dd).toFixed(2)}%` : "—"}
          </CardContent>
        </Card>
      </div>

      {last && (
        <Card>
          <CardHeader>
            <CardTitle>End-of-run snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4 text-sm">
            <div>
              <div className="text-muted-foreground">Cash</div>
              <div className="font-medium tabular-nums">
                {formatIsk(Number(last.cashIsk))}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Inventory (mark)</div>
              <div className="font-medium tabular-nums">
                {formatIsk(Number(last.inventoryMarkIsk))}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Inventory (cost)</div>
              <div className="font-medium tabular-nums">
                {formatIsk(Number(last.inventoryCostIsk))}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">NAV</div>
              <div className="font-medium tabular-nums">
                {formatIsk(Number(last.navIsk))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Positions (worst first)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="divide-y rounded-md border">
            {data.positions.slice(0, 50).map((p) => (
              <div
                key={`${p.destinationStationId}:${p.typeId}`}
                className="p-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.typeName ?? `typeId=${p.typeId}`} • dst{" "}
                    {p.destinationStationId}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    planned {p.plannedUnits.toLocaleString()} • remaining{" "}
                    {p.unitsRemaining.toLocaleString()}
                  </div>
                </div>
                <div className="text-sm tabular-nums">
                  {formatIsk(Number(p.realizedProfitIsk))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
