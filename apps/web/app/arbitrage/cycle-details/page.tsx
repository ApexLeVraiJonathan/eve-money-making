"use client";

import * as React from "react";
import {
  Activity,
  TrendingUp,
  Wallet,
  Package,
  DollarSign,
  Users,
} from "lucide-react";
import { formatIsk } from "@/lib/utils";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CircleHelp } from "lucide-react";

type CycleDetails = {
  id: string;
  name: string | null;
  startedAt: string;
  closedAt: string | null;
  status: string;
  capital: {
    cashISK: number;
    inventoryISK: number;
    totalISK: number;
    originalInvestmentISK: number;
  };
  performance: {
    marginPct: number;
    profitISK: number;
  };
  participantCount: number;
  totalInvestorCapital: number;
  myParticipation?: {
    amountIsk: string;
    estimatedPayoutIsk: string | null;
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
    color: "#d97706",
  },
  inventory: {
    label: "Inventory",
    color: "#92400e",
  },
  profit: {
    label: "Profit",
    color: "#059669",
  },
};

export default function CycleDetailsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cycle, setCycle] = React.useState<CycleDetails | null>(null);
  const [snapshots, setSnapshots] = React.useState<CycleSnapshot[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        // Fetch current cycle overview
        const overviewRes = await fetch("/api/ledger/cycles/overview");
        const overviewData = await overviewRes.json();

        if (!overviewData.current) {
          setLoading(false);
          return;
        }

        const currentCycleId = overviewData.current.id;

        // Fetch detailed cycle data
        const capitalRes = await fetch(
          `/api/ledger/cycles/${currentCycleId}/capital`,
        );
        const capitalData = await capitalRes.json();

        // Fetch snapshots for history chart
        const snapshotsRes = await fetch(
          `/api/ledger/cycles/${currentCycleId}/snapshots?limit=20`,
        );
        const snapshotsData = await snapshotsRes.json();

        // Fetch user's participation if authenticated
        let myParticipation = undefined;
        if (status === "authenticated") {
          try {
            const partRes = await fetch(
              `/api/ledger/cycles/${currentCycleId}/participations/me`,
            );
            if (partRes.ok) {
              const partData = await partRes.json();
              myParticipation = partData;
            }
          } catch {
            // User not participating or error fetching
          }
        }

        setCycle({
          ...overviewData.current,
          capital: {
            cashISK: overviewData.current.capital.cashISK,
            inventoryISK: overviewData.current.capital.inventoryISK,
            totalISK:
              overviewData.current.capital.cashISK +
              overviewData.current.capital.inventoryISK,
            originalInvestmentISK:
              overviewData.current.capital.originalInvestmentISK,
          },
          myParticipation,
        });

        setSnapshots(snapshotsData);
      } catch (error) {
        console.error("Failed to load cycle details:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [status]);

  // Prepare pie chart data
  const pieData = cycle
    ? [
        {
          name: "Cash",
          value: cycle.capital.cashISK,
          fill: "#d97706",
        },
        {
          name: "Inventory",
          value: cycle.capital.inventoryISK,
          fill: "#92400e",
        },
      ]
    : [];

  // Prepare line chart data (capital over time)
  const sortedSnapshots = [...snapshots].sort(
    (a, b) =>
      new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime(),
  );

  const capitalOverTimeData = sortedSnapshots.map((snap) => ({
    date: new Date(snap.snapshotAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    cash: parseFloat(snap.walletCashIsk) / 1_000_000, // millions
    inventory: parseFloat(snap.inventoryIsk) / 1_000_000,
    total:
      (parseFloat(snap.walletCashIsk) + parseFloat(snap.inventoryIsk)) /
      1_000_000,
  }));

  const profitOverTimeData = sortedSnapshots.map((snap) => ({
    date: new Date(snap.snapshotAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    profit: parseFloat(snap.cycleProfitIsk) / 1_000_000,
  }));

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Activity className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cycle Details
          </h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Empty className="min-h-48">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CircleHelp className="size-6" />
                </EmptyMedia>
                <EmptyTitle>No active cycle</EmptyTitle>
                <EmptyDescription>
                  There is currently no active cycle. Check back when a new
                  cycle starts.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Activity className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {cycle.name ?? cycle.id}
            </h1>
            <p className="text-sm text-muted-foreground">
              Started {new Date(cycle.startedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-base px-3 py-1">
          {cycle.status}
        </Badge>
      </div>

      {/* My Participation Card (if authenticated and participating) */}
      {status === "authenticated" && cycle.myParticipation && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Participation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Your Investment</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatIsk(Number(cycle.myParticipation.amountIsk))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Estimated Payout
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {cycle.myParticipation.estimatedPayoutIsk
                    ? formatIsk(
                        Number(cycle.myParticipation.estimatedPayoutIsk),
                      )
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className="mt-1" variant="outline">
                  {cycle.myParticipation.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              Total Capital
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatIsk(cycle.capital.totalISK)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cash + Inventory
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              Cash
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatIsk(cycle.capital.cashISK)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {((cycle.capital.cashISK / cycle.capital.totalISK) * 100).toFixed(
                1,
              )}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Package className="h-4 w-4" />
              Inventory
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatIsk(cycle.capital.inventoryISK)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(
                (cycle.capital.inventoryISK / cycle.capital.totalISK) *
                100
              ).toFixed(1)}
              % of total
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
                cycle.performance.profitISK < 0
                  ? "text-red-500"
                  : "text-emerald-600"
              }`}
            >
              {formatIsk(cycle.performance.profitISK)}
            </div>
            <p
              className={`text-xs mt-1 font-medium ${
                cycle.performance.marginPct < 0
                  ? "text-red-500"
                  : "text-emerald-600"
              }`}
            >
              {(cycle.performance.marginPct * 100).toFixed(1)}% gain
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Total capital vs initial
              <br />
              <span className="text-[10px]">Includes inventory value</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* First Row - Capital Distribution + Investor Info */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Capital Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Capital Distribution</CardTitle>
            <CardDescription>
              Current breakdown of cash vs inventory
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {pieData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value) => formatIsk(Number(value))}
                      />
                    }
                  />
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(1)}%`
                    }
                    outerRadius={100}
                    innerRadius={60}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Investor Information */}
        <Card>
          <CardHeader>
            <CardTitle>Investor Information</CardTitle>
            <CardDescription>
              Participation summary (anonymized)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Investors
                  </p>
                  <p className="text-3xl font-semibold tabular-nums mt-1">
                    {cycle.participantCount}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Pooled Capital
                  </p>
                  <p className="text-3xl font-semibold tabular-nums mt-1">
                    {formatIsk(cycle.totalInvestorCapital)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground">
                  Individual investor amounts are kept private. Only aggregate
                  totals are shown.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row - Realized Cash Profit + Capital Over Time */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Realized Cash Profit */}
        {profitOverTimeData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Realized Cash Profit</CardTitle>
              <CardDescription>
                Profit from completed sales (in millions ISK)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={profitOverTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="#666" />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) =>
                            `${Number(value).toFixed(2)}M ISK`
                          }
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke={chartConfig.profit.color}
                      strokeWidth={3}
                      name="Profit"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Realized Cash Profit</CardTitle>
              <CardDescription>
                Profit from completed sales (in millions ISK)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No snapshot data available yet
              </div>
            </CardContent>
          </Card>
        )}

        {/* Capital Over Time */}
        {capitalOverTimeData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Capital Over Time</CardTitle>
              <CardDescription>
                Historical progression of cycle capital (in millions ISK)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={capitalOverTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) =>
                            `${Number(value).toFixed(2)}M ISK`
                          }
                        />
                      }
                    />
                    <ChartLegend />
                    <Line
                      type="monotone"
                      dataKey="cash"
                      stroke={chartConfig.cash.color}
                      strokeWidth={2}
                      name="Cash"
                    />
                    <Line
                      type="monotone"
                      dataKey="inventory"
                      stroke={chartConfig.inventory.color}
                      strokeWidth={2}
                      name="Inventory"
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#2563eb"
                      strokeWidth={2}
                      name="Total"
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Capital Over Time</CardTitle>
              <CardDescription>
                Historical progression of cycle capital (in millions ISK)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No snapshot data available yet
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* OLD Profit Over Time Chart - TO BE REMOVED */}
      {false && profitOverTimeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Profit Over Time</CardTitle>
            <CardDescription>
              Cycle profit progression (in millions ISK)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profitOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#666" />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          `${Number(value).toFixed(2)}M ISK`
                        }
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke={chartConfig.profit.color}
                    strokeWidth={3}
                    name="Profit"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
