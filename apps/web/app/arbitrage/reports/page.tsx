import * as React from "react";
import { getCurrentCycle, getMyParticipation } from "../_mock/store";
import { formatISK } from "../../brokerage/_mock/data";

export default async function ArbitrageReportsPage() {
  const [cycle, mine] = await Promise.all([
    getCurrentCycle(),
    getMyParticipation(),
  ]);

  // For now, use current cycle as part of "history" placeholder
  const history = [
    {
      id: cycle.id,
      name: cycle.name,
      invested: 10_000_000_000,
      profit: 1_000_000_000,
      marginPct: 0.1,
    },
    {
      id: "CY-2025-09",
      name: "September Cycle",
      invested: 8_000_000_000,
      profit: -80_000_000,
      marginPct: -0.01,
    },
    {
      id: "CY-2025-08",
      name: "August Cycle",
      invested: 9_500_000_000,
      profit: 760_000_000,
      marginPct: 0.08,
    },
    {
      id: "CY-2025-07",
      name: "July Cycle",
      invested: 7_000_000_000,
      profit: 2_100_000_000,
      marginPct: 0.3,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>

      <section className="rounded-lg border p-4">
        <h2 className="text-base font-medium">Your participation</h2>
        {mine ? (
          <div className="mt-2 text-sm text-muted-foreground">
            <div>
              Character:{" "}
              <span className="text-foreground">{mine.characterName}</span>
            </div>
            <div>
              Amount: {formatISK(mine.amountISK)} • Status:{" "}
              {mine.status.replaceAll("-", " ")}
            </div>
            <div>
              Estimated payout (current): {formatISK(mine.estimatedPayoutISK)}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            No participation yet.
          </div>
        )}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-base font-medium">Past cycles</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="p-2">Cycle</th>
                <th className="p-2">Investment</th>
                <th className="p-2">Profit</th>
                <th className="p-2">Margin</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="p-2">{h.name}</td>
                  <td className="p-2">{formatISK(h.invested)}</td>
                  <td
                    className={`p-2 ${h.profit < 0 ? "text-red-400" : h.profit > 0 ? "text-emerald-500" : ""}`}
                  >
                    {formatISK(h.profit)}
                  </td>
                  <td
                    className={`p-2 ${h.marginPct < 0 ? "text-red-400" : h.marginPct > 0 ? "text-emerald-500" : ""}`}
                  >
                    {(h.marginPct * 100).toFixed(1)}%
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
