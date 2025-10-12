import * as React from "react";
import Link from "next/link";
import { Recycle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCurrentCycle, getNextCycle } from "../_mock/store";
// TODO: Replace mocks by fetching from backend planned cycles when available
import { formatISK } from "../../brokerage/_mock/data";
import OptInDialog from "./opt-in-dialog";

export default async function CyclesOverviewPage() {
  const [current, next] = await Promise.all([
    getCurrentCycle(),
    getNextCycle(),
  ]);
  const openCommit = current.commits.find((c) => !c.closedAt);
  const formatTimeLeft = (end: string | number | Date) => {
    const endMs = new Date(end).getTime();
    const nowMs = Date.now();
    const diffMs = Math.max(0, endMs - nowMs);
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor(
      (diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
    );
    if (days > 0) return `${days}d ${hours}h left`;
    const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    if (hours > 0) return `${hours}h ${mins}m left`;
    const secs = Math.floor((diffMs % (60 * 1000)) / 1000);
    return `${mins}m ${secs}s left`;
  };
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Recycle className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Cycles</h1>
      </div>

      <section className="rounded-lg border p-4 surface-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium">
            Current cycle — {current.name}
          </h2>
          <div className="flex items-center gap-3 text-sm">
            <Badge className="tabular-nums">
              {formatTimeLeft(current.endsAt)}
            </Badge>
            <Link
              href="/arbitrage/cycles/details"
              className="underline underline-offset-4"
            >
              View details
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-md border p-3 surface-2">
            <div className="text-xs text-muted-foreground">Data & Status</div>
            <div className="mt-1 text-sm">
              <div>
                <span className="text-muted-foreground">Ends:</span>{" "}
                <span className="text-foreground">
                  {new Date(current.endsAt).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <span className="text-foreground">{current.status}</span>
              </div>
            </div>
          </div>
          <div className="rounded-md border p-3 surface-2">
            <div className="text-xs text-muted-foreground">Capital</div>
            <div className="mt-1 text-sm">
              <div>
                <span className="text-muted-foreground">Cash:</span>{" "}
                <span className="text-foreground">
                  {formatISK(current.capital.cashISK)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Inventory:</span>{" "}
                <span className="text-foreground">
                  {formatISK(current.capital.inventoryISK)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Orig. Invested:</span>{" "}
                <span className="text-foreground">
                  {formatISK(current.capital.originalInvestmentISK)}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-md border p-3 surface-2">
            <div className="text-xs text-muted-foreground">Performance</div>
            <div className="mt-1 text-sm">
              <div>
                <span className="text-muted-foreground">Margin:</span>{" "}
                <span
                  className={
                    current.performance.marginPct < 0
                      ? "text-red-400"
                      : "text-emerald-500"
                  }
                >
                  {(current.performance.marginPct * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Profit:</span>{" "}
                <span
                  className={
                    current.performance.profitISK < 0
                      ? "text-red-400"
                      : "text-foreground"
                  }
                >
                  {formatISK(current.performance.profitISK)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border p-4 surface-1">
        <h2 className="text-base font-medium">Open commit</h2>
        {openCommit ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
            <div className="rounded-md border p-3 surface-2">
              <div className="text-xs text-muted-foreground">Commit</div>
              <div className="mt-1 text-foreground font-medium">
                {openCommit.name}
              </div>
              <div className="mt-1 text-muted-foreground">
                Opened: {new Date(openCommit.openedAt).toLocaleString()}
              </div>
            </div>
            <div className="rounded-md border p-3 surface-2">
              <div className="text-xs text-muted-foreground">Totals</div>
              <div className="mt-1">
                <span className="text-muted-foreground">Invested:</span>{" "}
                <span className="text-foreground">
                  {formatISK(openCommit.totals.investedISK)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Sold:</span>{" "}
                <span className="text-emerald-500">
                  {formatISK(openCommit.totals.soldISK)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Est. Sell:</span>{" "}
                <span className="text-yellow-500">
                  {formatISK(openCommit.totals.estSellISK)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Est. Fees:</span>{" "}
                <span className="text-foreground">
                  {formatISK(openCommit.totals.estFeesISK)}
                </span>
              </div>
            </div>
            <div className="rounded-md border p-3 surface-2">
              <div className="text-xs text-muted-foreground">P&L</div>
              <div className="mt-1">
                <span className="text-muted-foreground">Est. Profit:</span>{" "}
                <span
                  className={
                    openCommit.totals.estProfitISK < 0
                      ? "text-red-400"
                      : "text-emerald-500"
                  }
                >
                  {formatISK(openCommit.totals.estProfitISK)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Est. Return:</span>{" "}
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
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            No commit currently open.
          </div>
        )}
      </section>

      <section className="rounded-lg border p-4 surface-1">
        <h2 className="text-base font-medium">Next cycle</h2>
        <div className="mt-2 text-sm">
          <div>
            <span className="text-muted-foreground">Name:</span>{" "}
            <span className="text-foreground">{next.name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Starts:</span>{" "}
            {new Date(next.startedAt).toLocaleString()} •
            <span className="ml-1 text-muted-foreground">Status:</span>{" "}
            <span className="text-foreground">{next.status}</span>
          </div>
        </div>
        <div className="mt-3">
          <OptInDialog
            nextCycleName={next.name}
            triggerClassName="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
          />
        </div>
      </section>
    </div>
  );
}
