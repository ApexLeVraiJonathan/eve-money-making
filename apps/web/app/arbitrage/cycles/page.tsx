import * as React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Recycle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatIsk } from "@/lib/utils";
import NextCycleSection from "./next-cycle-section";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CircleHelp } from "lucide-react";

export default async function CyclesOverviewPage() {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  const dataPromise = fetch(`${base}/api/ledger/cycles/overview`, {
    // cache on edge for 30s to smooth bursts while allowing fresh-ish data
    cache: "no-store", // Disable cache for development
  }).then((r) => r.json());

  // Render quickly, hydrate with data when it arrives
  const { current, next } = (await dataPromise) as {
    current: null | {
      id: string;
      name: string | null;
      startedAt: string;
      endsAt: string | null;
      status: string;
      capital: {
        cashISK: number;
        inventoryISK: number;
        originalInvestmentISK: number;
      };
      performance: { marginPct: number; profitISK: number };
    };
    next: null | {
      id: string;
      name: string | null;
      startedAt: string;
      status: string;
    };
  };

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

      {current ? (
        <section className="rounded-lg border p-4 surface-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-medium">
              Current cycle — {current.name ?? current.id}
            </h2>
            <div className="flex items-center gap-3 text-sm">
              {current.endsAt ? (
                <Badge className="tabular-nums">
                  {formatTimeLeft(current.endsAt)}
                </Badge>
              ) : null}
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
                    {current.endsAt
                      ? new Date(current.endsAt).toLocaleString()
                      : "TBD"}
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
                    {formatIsk(current.capital.cashISK)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Inventory:</span>{" "}
                  <span className="text-foreground">
                    {formatIsk(current.capital.inventoryISK)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Orig. Invested:</span>{" "}
                  <span className="text-foreground">
                    {formatIsk(current.capital.originalInvestmentISK)}
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
                    {formatIsk(current.performance.profitISK)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border p-4 surface-1">
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleHelp className="size-6" />
              </EmptyMedia>
              <EmptyTitle>No current cycle</EmptyTitle>
              <EmptyDescription>
                Please check back another time. A new cycle will appear here
                when it opens.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      )}

      <section className="rounded-lg border p-4 surface-1">
        <h2 className="text-base font-medium">Next cycle</h2>
        <Suspense
          fallback={
            <div className="mt-2 text-sm text-muted-foreground">
              Loading next cycle…
            </div>
          }
        >
          <NextCycleSection next={next} />
        </Suspense>
      </section>
    </div>
  );
}
