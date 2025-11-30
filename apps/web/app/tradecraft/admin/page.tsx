"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Skeleton } from "@eve/ui";
import { Button } from "@eve/ui";
import { Activity, Database, TrendingUp, Wallet } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@eve/ui";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatIsk } from "@/lib/utils";
import { useCycles, useCycleCapital, useCycleSnapshots } from "../api";
import { useMarketStaleness } from "../api/jobs";
import { useEsiMetrics } from "../api/esi";

const chartConfig = {
  cash: {
    label: "Cash",
    color: "#f59e0b", // Emerald-600 for cash (darker, less neon)
  },
  inventory: {
    label: "Inventory",
    color: "#2563eb", // Blue-600 for inventory (darker, less neon)
  },
  profit: {
    label: "Profit",
    color: "#d97706", // Emerald-600 for profit line (matches cash, darker green)
  },
};

export default function AdminPage() {
  // Use React Query hooks for data fetching
  const { data: cycles = [], isLoading: cyclesLoading } = useCycles();
  // Prioritize open cycle, fall back to latest cycle
  const openCycle = cycles.find((c) => c.status === "OPEN");
  const latestCycle = openCycle || cycles[0] || null;

  const { data: capital, isLoading: capitalLoading } = useCycleCapital(
    latestCycle?.id || "",
  );

  const { data: snapshots = [], isLoading: snapshotsLoading } =
    useCycleSnapshots(latestCycle?.id || "", 10);

  const { data: stalenessData } = useMarketStaleness();

  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useEsiMetrics();

  const loading =
    cyclesLoading || capitalLoading || snapshotsLoading || metricsLoading;
  const error = metricsError ? String(metricsError) : null;

  const staleness = stalenessData?.stations?.length || 0;

  // Prepare data for pie chart
  // Use darker, more muted colors for a professional look
  const pieData = capital
    ? [
        {
          name: "Cash",
          value: parseFloat(capital.capital.cash),
          fill: "#d97706", // Emerald-600 for cash (darker green)
        },
        {
          name: "Inventory",
          value: parseFloat(capital.capital.inventory),
          fill: "#92400e", // Blue-600 for inventory (darker blue)
        },
      ]
    : [];

  // Prepare data for line chart
  // Sort by snapshotAt to ensure chronological order (oldest to newest)
  const sortedSnapshots = [...snapshots].sort(
    (a, b) =>
      new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime(),
  );

  const lineData = sortedSnapshots.map((snap) => ({
    date: new Date(snap.snapshotAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    time: new Date(snap.snapshotAt).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    profit: parseFloat(snap.cycleProfitIsk) / 1_000_000, // Convert to millions for readability
    snapshotAt: snap.snapshotAt, // Keep for debugging
  }));

  // Calculate Y-axis domain to include zero and have nice bounds
  const minProfit = lineData.length
    ? Math.min(...lineData.map((d) => d.profit))
    : 0;
  const maxProfit = lineData.length
    ? Math.max(...lineData.map((d) => d.profit))
    : 0;
  const yAxisMin = Math.floor(Math.min(minProfit, 0) * 1.1); // Add 10% padding, ensure includes 0
  const yAxisMax = Math.ceil(Math.max(maxProfit, 0) * 1.1); // Add 10% padding, ensure includes 0

  const totalCacheHits = metrics ? metrics.cacheHitMem + metrics.cacheHitDb : 0;
  const totalRequests = metrics
    ? metrics.cacheHitMem +
      metrics.cacheHitDb +
      metrics.cacheMiss +
      metrics.http200
    : 1;
  const cacheHitRate =
    totalRequests > 0 ? ((totalCacheHits / totalRequests) * 100).toFixed(1) : 0;

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Quick overview of system health and cycle performance
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm px-4 py-3">
          Error: {error}
        </div>
      )}

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Trade Data Missing
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums">
                  {staleness}
                </div>
                <p className="text-xs text-muted-foreground">
                  {staleness === 1 ? "station" : "stations"} stale
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ESI Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums">
                  {metrics ? metrics.http200.toLocaleString() : 0}
                </div>
                <p className="text-xs text-muted-foreground">successful</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cache Hit Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums">
                  {cacheHitRate}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalCacheHits.toLocaleString()} hits
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capital</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums">
                  {capital
                    ? `${(parseFloat(capital.capital.total) / 1_000_000_000).toFixed(2)}B`
                    : "0B"}
                </div>
                <p className="text-xs text-muted-foreground">ISK</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capital Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Capital Distribution</CardTitle>
            <CardDescription>
              {latestCycle?.name
                ? `Current allocation for ${latestCycle.name}`
                : "Current cycle capital breakdown"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !capital ? (
              <div className="flex items-center justify-center h-[300px]">
                <Skeleton className="h-[250px] w-[250px] rounded-full" />
              </div>
            ) : pieData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px]">
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
                No capital data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profit Over Time Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Profit Over Time</CardTitle>
            <CardDescription>
              {latestCycle?.name
                ? `Historical snapshots for ${latestCycle.name}`
                : "Cycle profit progression"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Skeleton className="h-full w-full" />
              </div>
            ) : lineData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickMargin={8}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    domain={[yAxisMin, yAxisMax]}
                    tick={{ fontSize: 12 }}
                    tickMargin={8}
                    tickFormatter={(value) => `${value}M`}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0]) {
                            return `${payload[0].payload.date} ${payload[0].payload.time}`;
                          }
                          return label;
                        }}
                        formatter={(value) =>
                          `${formatIsk(Number(value) * 1_000_000)}`
                        }
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke={chartConfig.profit.color}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No snapshot data available. Create snapshots to see profit
                trends.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common administrative tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() =>
                (window.location.href = "/tradecraft/admin/triggers")
              }
            >
              <Database className="mr-2 h-4 w-4" />
              Manual Triggers
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => (window.location.href = "/tradecraft/admin/lines")}
            >
              <Activity className="mr-2 h-4 w-4" />
              Manage Lines
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() =>
                (window.location.href = "/tradecraft/admin/profit")
              }
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              View Profit
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => (window.location.href = "/tradecraft/cycles")}
            >
              <Wallet className="mr-2 h-4 w-4" />
              All Cycles
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cycle Info */}
      {latestCycle && (
        <Card>
          <CardHeader>
            <CardTitle>Current Cycle</CardTitle>
            <CardDescription>
              {latestCycle.name || "Unnamed Cycle"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Started</div>
                <div className="font-medium">
                  {new Date(latestCycle.startedAt).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <div className="font-medium">
                  {latestCycle.status === "COMPLETED"
                    ? "Closed"
                    : latestCycle.status === "PLANNED"
                      ? "Planned"
                      : "Open"}
                </div>
              </div>
              {capital && (
                <>
                  <div>
                    <div className="text-muted-foreground">Cash</div>
                    <div className="font-medium tabular-nums">
                      {formatIsk(parseFloat(capital.capital.cash))}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Inventory</div>
                    <div className="font-medium tabular-nums">
                      {formatIsk(parseFloat(capital.capital.inventory))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
