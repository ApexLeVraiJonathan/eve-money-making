"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Commit = { id: string; createdAt: string; memo: string | null };

type Line = {
  typeId: number;
  typeName: string;
  sourceStationName: string;
  destinationStationName: string;
  plannedUnits: number;
  buySpendISK: string;
  sellRevenueISK: string;
  buySeen: boolean;
  sellSeen: boolean;
  buyUnits?: number;
  sellUnits?: number;
  remainingUnits?: number;
};

export default function CommitsStatusPage() {
  const [commits, setCommits] = React.useState<Commit[]>([]);
  const [selected, setSelected] = React.useState<string>("");
  const [lines, setLines] = React.useState<Line[]>([]);
  const [totals, setTotals] = React.useState<{
    buysISK: string;
    sellsISK: string;
    feesISK: string;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadCommits = async () => {
    try {
      const res = await fetch("/api/arbitrage/commits", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setCommits(data as Commit[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadStatus = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/recon/commits/${id}/status`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setLines(data.lines as Line[]);
      setTotals(data.totals);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  React.useEffect(() => {
    void loadCommits();
  }, []);

  React.useEffect(() => {
    if (selected) void loadStatus(selected);
  }, [selected]);

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Commit Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center">
            <select
              className="px-3 py-2 rounded border bg-background"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select commit…</option>
              {commits.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.memo || c.id.slice(0, 8)) +
                    " — " +
                    new Date(c.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          {totals && (
            <TotalsView
              buys={totals.buysISK}
              sells={totals.sellsISK}
              fees={totals.feesISK}
            />
          )}

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Type</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Planned</th>
                  <th>Buys</th>
                  <th>Sells</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b hover:bg-accent/30">
                    <td>{l.typeName}</td>
                    <td title={l.sourceStationName}>
                      {l.sourceStationName.split(" ")[0]}
                    </td>
                    <td title={l.destinationStationName}>
                      {l.destinationStationName.split(" ")[0]}
                    </td>
                    <td className="tabular-nums">{l.plannedUnits}</td>
                    <td
                      className={`tabular-nums ${progressCls(
                        l.buyUnits ?? 0,
                        l.plannedUnits,
                      )}`}
                    >
                      {l.buyUnits ?? 0}/{l.plannedUnits}
                    </td>
                    <td
                      className={`tabular-nums ${progressCls(
                        l.sellUnits ?? 0,
                        l.plannedUnits,
                      )}`}
                    >
                      {l.sellUnits ?? 0}/{l.plannedUnits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TotalsView({
  buys,
  sells,
  fees,
}: {
  buys: string;
  sells: string;
  fees: string;
}) {
  const fmtISK = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "ISK",
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(n)
      .replace("ISK", "ISK");
  const buysNum = Number(buys);
  const sellsNum = Number(sells);
  const feesNum = Number(fees);
  const net = sellsNum - (Math.abs(buysNum) + Math.abs(feesNum));
  const cls = (n: number) => (n >= 0 ? "text-emerald-500" : "text-red-500");

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <div className="text-muted-foreground">Buys (ISK)</div>
        <div className={`font-medium ${cls(buysNum)}`}>{fmtISK(buysNum)}</div>
      </div>
      <div>
        <div className="text-muted-foreground">Sells (ISK)</div>
        <div className={`font-medium ${cls(sellsNum)}`}>{fmtISK(sellsNum)}</div>
      </div>
      <div>
        <div className="text-muted-foreground">Fees (ISK)</div>
        <div className={`font-medium ${cls(feesNum)}`}>{fmtISK(feesNum)}</div>
      </div>
      <div>
        <div className="text-muted-foreground">
          Total (sells - (buys + fees))
        </div>
        <div className={`font-medium ${cls(net)}`}>{fmtISK(net)}</div>
      </div>
    </div>
  );
}

function progressCls(done: number, total: number): string {
  if (done >= total && total > 0) return "text-emerald-500";
  if (done > 0) return "text-amber-500";
  return "text-muted-foreground";
}
