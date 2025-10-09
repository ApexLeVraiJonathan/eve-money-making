import * as React from "react";
import { getCurrentCycle } from "../../_mock/store";
import { formatISK } from "../../../brokerage/_mock/data";

export default async function CycleDetailsPage() {
  const cycle = await getCurrentCycle();
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cycle details</h1>
      <div className="text-sm text-muted-foreground">
        {cycle.name} • Ends {new Date(cycle.endsAt).toLocaleString()}
      </div>

      <section className="rounded-lg border p-4 surface-1">
        <h2 className="text-base font-medium">Capital</h2>
        <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
          <div>
            Original Investment:{" "}
            {formatISK(cycle.capital.originalInvestmentISK)}
          </div>
          <div>Cash: {formatISK(cycle.capital.cashISK)}</div>
          <div>Inventory: {formatISK(cycle.capital.inventoryISK)}</div>
        </div>
      </section>

      <section className="rounded-lg border p-4 surface-1">
        <h2 className="text-base font-medium">Commits</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Opened</th>
                <th className="p-2">Closed</th>
                <th className="p-2">Invested</th>
                <th className="p-2">Sold</th>
                <th className="p-2">Est. Sell</th>
                <th className="p-2">Est. Fees</th>
                <th className="p-2">Est. Profit</th>
                <th className="p-2">Est. Return</th>
              </tr>
            </thead>
            <tbody>
              {cycle.commits.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2">{c.name}</td>
                  <td className="p-2">
                    {new Date(c.openedAt).toLocaleString()}
                  </td>
                  <td className="p-2">
                    {c.closedAt
                      ? new Date(c.closedAt).toLocaleString()
                      : "Open"}
                  </td>
                  <td className="p-2">{formatISK(c.totals.investedISK)}</td>
                  <td className="p-2 text-emerald-500">
                    {formatISK(c.totals.soldISK)}
                  </td>
                  <td className="p-2 text-yellow-500">
                    {formatISK(c.totals.estSellISK)}
                  </td>
                  <td className="p-2 text-red-400">
                    {formatISK(c.totals.estFeesISK)}
                  </td>
                  <td
                    className={`p-2 ${c.totals.estProfitISK < 0 ? "text-red-400" : "text-emerald-500"}`}
                  >
                    {formatISK(c.totals.estProfitISK)}
                  </td>
                  <td
                    className={`p-2 ${c.totals.estReturnPct < 0 ? "text-red-400" : "text-emerald-500"}`}
                  >
                    {(c.totals.estReturnPct * 100).toFixed(1)}%
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
