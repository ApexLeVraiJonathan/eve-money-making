import * as React from "react";
import { formatISK } from "../../../brokerage/_mock/data";

type HistoryCycle = {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string;
  totalInvestedISK: number;
  profitISK: number;
  marginPct: number;
};

async function getHistory(): Promise<HistoryCycle[]> {
  // Mocked with realism and edge cases: negative, flat, strong wins
  await new Promise((r) => setTimeout(r, 100));
  return [
    {
      id: "CY-2025-09",
      name: "September Cycle",
      startedAt: "2025-09-01T00:00:00Z",
      endedAt: "2025-09-30T23:59:59Z",
      totalInvestedISK: 8_000_000_000,
      profitISK: -120_000_000,
      marginPct: -0.015, // -1.5%
    },
    {
      id: "CY-2025-08",
      name: "August Cycle",
      startedAt: "2025-08-01T00:00:00Z",
      endedAt: "2025-08-31T23:59:59Z",
      totalInvestedISK: 9_500_000_000,
      profitISK: 975_000_000,
      marginPct: 0.1026, // 10.26%
    },
    {
      id: "CY-2025-07",
      name: "July Cycle",
      startedAt: "2025-07-01T00:00:00Z",
      endedAt: "2025-07-31T23:59:59Z",
      totalInvestedISK: 7_000_000_000,
      profitISK: 2_100_000_000,
      marginPct: 0.3, // 30%
    },
  ];
}

export default async function CyclesHistory() {
  const rows = await getHistory();
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Past cycles</h1>
      <section className="rounded-lg border p-4 surface-1">
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="p-2">Cycle</th>
                <th className="p-2">Period</th>
                <th className="p-2">Total Invested</th>
                <th className="p-2">Profit</th>
                <th className="p-2">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">
                    {new Date(r.startedAt).toLocaleDateString()} -{" "}
                    {new Date(r.endedAt).toLocaleDateString()}
                  </td>
                  <td className="p-2">{formatISK(r.totalInvestedISK)}</td>
                  <td
                    className={`p-2 ${r.profitISK < 0 ? "text-red-400" : r.profitISK > 0 ? "text-emerald-500" : ""}`}
                  >
                    {formatISK(r.profitISK)}
                  </td>
                  <td
                    className={`p-2 ${r.marginPct < 0 ? "text-red-400" : r.marginPct > 0 ? "text-emerald-500" : ""}`}
                  >
                    {(r.marginPct * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
