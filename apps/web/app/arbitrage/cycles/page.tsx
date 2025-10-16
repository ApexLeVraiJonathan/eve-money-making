"use client";

import * as React from "react";
import Link from "next/link";
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
import { Skeleton } from "@/components/ui/skeleton";

type CycleOverviewData = {
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

export default function CyclesOverviewPage() {
  const [data, setData] = React.useState<CycleOverviewData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/ledger/cycles/overview")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

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

      {/* Current Cycle Section */}
      {isLoading ? (
        <section className="rounded-lg border p-4 surface-1">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-md border p-3 surface-2">
                <Skeleton className="h-4 w-24 mb-2" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : data?.current ? (
        <section className="rounded-lg border p-4 surface-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-medium">
              Current cycle — {data.current.name ?? data.current.id}
            </h2>
            <div className="flex items-center gap-3 text-sm">
              {data.current.endsAt ? (
                <Badge className="tabular-nums">
                  {formatTimeLeft(data.current.endsAt)}
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
                    {data.current.endsAt
                      ? new Date(data.current.endsAt).toLocaleString()
                      : "TBD"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="text-foreground">{data.current.status}</span>
                </div>
              </div>
            </div>
            <div className="rounded-md border p-3 surface-2">
              <div className="text-xs text-muted-foreground">Capital</div>
              <div className="mt-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Cash:</span>{" "}
                  <span className="text-foreground">
                    {formatIsk(data.current.capital.cashISK)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Inventory:</span>{" "}
                  <span className="text-foreground">
                    {formatIsk(data.current.capital.inventoryISK)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Orig. Invested:</span>{" "}
                  <span className="text-foreground">
                    {formatIsk(data.current.capital.originalInvestmentISK)}
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
                      data.current.performance.marginPct < 0
                        ? "text-red-400"
                        : "text-emerald-500"
                    }
                  >
                    {(data.current.performance.marginPct * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Profit:</span>{" "}
                  <span
                    className={
                      data.current.performance.profitISK < 0
                        ? "text-red-400"
                        : "text-foreground"
                    }
                  >
                    {formatIsk(data.current.performance.profitISK)}
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

      {/* Next Cycle Section */}
      <section className="rounded-lg border p-4 surface-1">
        <h2 className="text-base font-medium">Next cycle</h2>
        {isLoading ? (
          <div className="mt-2">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <NextCycleSection next={data?.next || null} />
        )}
      </section>
    </div>
  );
}
