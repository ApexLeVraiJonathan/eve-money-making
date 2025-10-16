"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Recycle, Users, Wallet, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

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
    participantCount?: number;
    totalInvestorCapital?: number;
  };
  next: null | {
    id: string;
    name: string | null;
    startedAt: string;
    status: string;
  };
};

type CycleSnapshot = {
  id: string;
  cycleId: string;
  snapshotAt: string;
  walletCashIsk: string;
  inventoryIsk: string;
  cycleProfitIsk: string;
};

const chartConfig = {
  cash: {
    label: "Cash",
    color: "#d97706", // Amber-600
  },
  inventory: {
    label: "Inventory",
    color: "#92400e", // Amber-800
  },
  profit: {
    label: "Profit",
    color: "#059669", // Emerald-600
  },
};

export default function CyclesOverviewPage() {
  const router = useRouter();
  const [data, setData] = React.useState<CycleOverviewData | null>(null);
  const [snapshots, setSnapshots] = React.useState<CycleSnapshot[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        const overviewRes = await fetch("/api/ledger/cycles/overview");
        const overviewData = await overviewRes.json();
        setData(overviewData);

        // Fetch snapshots if there's a current cycle
        if (overviewData.current?.id) {
          const snapshotsRes = await fetch(
            `/api/ledger/cycles/${overviewData.current.id}/snapshots?limit=10`,
          );
          if (snapshotsRes.ok) {
            const snapshotsData = await snapshotsRes.json();
            setSnapshots(snapshotsData);
          }
        }
      } catch (error) {
        console.error("Failed to load cycle data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
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

  // Prepare pie chart data
  const pieData = data?.current
    ? [
        {
          name: "Cash",
          value: data.current.capital.cashISK,
          fill: "#d97706", // Amber-600
        },
        {
          name: "Inventory",
          value: data.current.capital.inventoryISK,
          fill: "#92400e", // Amber-800
        },
      ]
    : [];

  // Prepare profit line chart data
  const sortedSnapshots = [...snapshots].sort(
    (a, b) =>
      new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime(),
  );

  const profitOverTimeData = sortedSnapshots.map((snap) => ({
    date: new Date(snap.snapshotAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    profit: parseFloat(snap.cycleProfitIsk) / 1_000_000, // Convert to millions
  }));

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
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      ) : data?.current ? (
        <section className="space-y-4">
          {/* Header Card */}
          <Card>
            <CardHeader>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: Cycle Info */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-xl">
                      {data.current.name ?? data.current.id}
                    </CardTitle>
                    <CardDescription className="mt-1.5">
                      Started{" "}
                      {new Date(data.current.startedAt).toLocaleDateString()}
                      {data.current.endsAt && (
                        <span>
                          {" "}
                          • Ends{" "}
                          {new Date(data.current.endsAt).toLocaleDateString()}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {data.current.endsAt && (
                      <Badge className="tabular-nums text-sm px-3 py-1.5">
                        {formatTimeLeft(data.current.endsAt)}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-sm px-3 py-1.5">
                      {data.current.status}
                    </Badge>
                  </div>
                </div>

                {/* Right: More Details Link */}
                <div className="flex items-center justify-between border-l pl-6">
                  <div>
                    <p className="text-sm font-medium">Want more details?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      View charts, capital over time, and in-depth analytics
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/arbitrage/cycle-details")}
                    className="ml-3"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Key Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium">Total Capital</div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatIsk(
                    data.current.capital.cashISK +
                      data.current.capital.inventoryISK,
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cash + Inventory
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  Investors
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {data.current.participantCount ?? "—"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active participants
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  Investor Capital
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {data.current.totalInvestorCapital
                    ? formatIsk(data.current.totalInvestorCapital)
                    : "—"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total pooled ISK
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Portfolio Value Growth
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-semibold tabular-nums ${
                    data.current.performance.profitISK < 0
                      ? "text-red-500"
                      : "text-emerald-600"
                  }`}
                >
                  {formatIsk(data.current.performance.profitISK)}
                </div>
                <p
                  className={`text-xs mt-1 font-medium ${
                    data.current.performance.marginPct < 0
                      ? "text-red-500"
                      : "text-emerald-600"
                  }`}
                >
                  {(data.current.performance.marginPct * 100).toFixed(1)}% gain
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Total capital vs initial
                  <br />
                  <span className="text-[10px]">Includes inventory value</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : (
        <Card>
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>
      )}

      {/* Next Cycle Section */}
      <Card>
        <CardHeader>
          <CardTitle>Next Cycle</CardTitle>
          <CardDescription>
            Opt-in to participate in upcoming trading opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <NextCycleSection next={data?.next || null} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
