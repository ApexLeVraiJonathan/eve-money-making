import * as React from "react";
import Link from "next/link";
import { Recycle } from "lucide-react";
import { getCurrentCycle, getNextCycle } from "../_mock/store";
import { formatISK } from "../../brokerage/_mock/data";

export default async function CyclesOverviewPage() {
  const [current, next] = await Promise.all([
    getCurrentCycle(),
    getNextCycle(),
  ]);
  const openCommit = current.commits.find((c) => !c.closedAt);
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Recycle className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Cycles</h1>
      </div>

      <section className="rounded-lg border p-4 surface-1">
        <h2 className="text-base font-medium">Current cycle</h2>
        <div className="mt-2 text-sm text-muted-foreground">
          <div>
            Name: <span className="text-foreground">{current.name}</span>
          </div>
          <div>
            Ends: {new Date(current.endsAt).toLocaleString()} • Status:{" "}
            {current.status}
          </div>
          <div className="mt-1">
            Capital: cash {formatISK(current.capital.cashISK)}, inventory{" "}
            {formatISK(current.capital.inventoryISK)}
          </div>
          <div>
            Performance: margin{" "}
            {(current.performance.marginPct * 100).toFixed(1)}% • profit{" "}
            {formatISK(current.performance.profitISK)}
          </div>
        </div>
        <div className="mt-3 flex gap-3 text-sm">
          <Link
            href="/arbitrage/cycles/details"
            className="underline underline-offset-4"
          >
            View details
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/arbitrage/cycles/opt-in"
            className="underline underline-offset-4"
          >
            Opt-in to next cycle
          </Link>
        </div>
      </section>

      <section className="rounded-lg border p-4 surface-1">
        <h2 className="text-base font-medium">Open commit</h2>
        {openCommit ? (
          <div className="mt-2 text-sm text-muted-foreground">
            <div className="text-foreground font-medium">{openCommit.name}</div>
            <div>Opened: {new Date(openCommit.openedAt).toLocaleString()}</div>
            <div className="mt-1">
              Invested: {formatISK(openCommit.totals.investedISK)} •{" "}
              <span className="text-emerald-500">
                Sold: {formatISK(openCommit.totals.soldISK)}
              </span>{" "}
              •{" "}
              <span className="text-yellow-500">
                Est. Sell: {formatISK(openCommit.totals.estSellISK)}
              </span>
            </div>
            <div className="mt-1">
              Est. Profit:{" "}
              <span
                className={
                  openCommit.totals.estProfitISK < 0
                    ? "text-red-400"
                    : "text-emerald-500"
                }
              >
                {formatISK(openCommit.totals.estProfitISK)}
              </span>{" "}
              • Est. Return{" "}
              <span
                className={
                  openCommit.totals.estReturnPct < 0
                    ? "text-red-400"
                    : "text-emerald-500"
                }
              >
                {(openCommit.totals.estReturnPct * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            No commit currently open.
          </div>
        )}
      </section>

      <section className="rounded-lg border p-4 surface-1">
        <h2 className="text-base font-medium">Next cycle</h2>
        <div className="mt-2 text-sm text-muted-foreground">
          <div>
            Name: <span className="text-foreground">{next.name}</span>
          </div>
          <div>
            Starts: {new Date(next.startedAt).toLocaleString()} • Status:{" "}
            {next.status}
          </div>
        </div>
        <div className="mt-3">
          <Link
            href="/arbitrage/cycles/opt-in"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
          >
            Opt-in now
          </Link>
        </div>
      </section>
    </div>
  );
}
