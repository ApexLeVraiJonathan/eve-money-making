"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Entry = {
  id: string;
  occurredAt: string;
  entryType: string;
  amount: string;
  memo: string | null;
  planCommitId: string | null;
  characterName: string | null;
  stationName: string | null;
  typeName: string | null;
  source: string;
  matchStatus: string | null;
};

export default function LedgerPage() {
  const [cycleId, setCycleId] = React.useState("");
  const [rows, setRows] = React.useState<Entry[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [cycles, setCycles] = React.useState<
    Array<{ id: string; name: string | null }>
  >([]);

  const load = async () => {
    if (!cycleId) {
      setError("Enter a cycleId");
      return;
    }
    setError(null);
    try {
      const res = await fetch(
        `/api/ledger/entries?cycleId=${encodeURIComponent(cycleId)}`,
        {
          cache: "no-store",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setRows(data as Entry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadCycles = async () => {
    try {
      const res = await fetch("/api/ledger/cycles", { cache: "no-store" });
      const data = (await res.json()) as Array<{
        id: string;
        name: string | null;
        startedAt: string;
        closedAt: string | null;
      }>;
      if (res.ok) setCycles(data);
    } catch {}
  };

  React.useEffect(() => {
    void loadCycles();
  }, []);

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cycle Ledger Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <select
              className="px-3 py-2 rounded border bg-background"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
            >
              <option value="">Select cycle…</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <button
              className="px-3 py-2 rounded border"
              onClick={() => void load()}
            >
              Load
            </button>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">When</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Char</th>
                  <th>Station</th>
                  <th>Item</th>
                  <th>Source</th>
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-accent/30">
                    <td className="py-1">
                      {new Date(r.occurredAt).toLocaleString()}
                    </td>
                    <td>{r.entryType}</td>
                    <td className="tabular-nums">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "ISK",
                        currencyDisplay: "code",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                        .format(Number(r.amount))
                        .replace("ISK", "ISK")}
                    </td>
                    <td>{r.characterName ?? "-"}</td>
                    <td title={r.stationName || undefined}>
                      {(r.stationName ? r.stationName.split(" ")[0] : null) ||
                        "-"}
                    </td>
                    <td>{r.typeName ?? "-"}</td>
                    <td>{r.source}</td>
                    <td>
                      {r.matchStatus ?? (r.planCommitId ? "linked" : "-")}
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
