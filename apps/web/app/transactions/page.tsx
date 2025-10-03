"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Tx = {
  characterId: number;
  characterName: string | null;
  transactionId: string; // bigint serialized
  date: string;
  isBuy: boolean;
  locationId: number;
  stationName: string | null;
  typeId: number;
  typeName: string | null;
  quantity: number;
  unitPrice: string;
};

export default function TransactionsPage() {
  const [rows, setRows] = React.useState<Tx[]>([]);
  const [charId, setCharId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const qs = charId ? `?characterId=${encodeURIComponent(charId)}` : "";
      const res = await fetch(`/api/wallet-import/transactions${qs}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setRows(data as Tx[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent Wallet Transactions (14d)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Filter by characterId (optional)"
              value={charId}
              onChange={(e) => setCharId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
            />
            <button
              className="px-3 py-2 rounded border"
              onClick={() => void load()}
            >
              Refresh
            </button>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Date</th>
                  <th>Char</th>
                  <th>Type</th>
                  <th>Station</th>
                  <th>Side</th>
                  <th>Qty</th>
                  <th>Unit ISK</th>
                  <th>TxId</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.transactionId}-${i}`}
                    className="border-b hover:bg-accent/30"
                  >
                    <td className="py-1">
                      {new Date(r.date).toLocaleString()}
                    </td>
                    <td title={String(r.characterId)}>
                      {r.characterName || r.characterId}
                    </td>
                    <td title={String(r.typeId)}>{r.typeName || r.typeId}</td>
                    <td title={r.stationName || String(r.locationId)}>
                      {(r.stationName ? r.stationName.split(" ")[0] : null) ||
                        r.locationId}
                    </td>
                    <td>{r.isBuy ? "BUY" : "SELL"}</td>
                    <td className="tabular-nums">{r.quantity}</td>
                    <td className="tabular-nums">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "ISK",
                        currencyDisplay: "code",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                        .format(Number(r.unitPrice))
                        .replace("ISK", "ISK")}
                    </td>
                    <td className="tabular-nums">{r.transactionId}</td>
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
