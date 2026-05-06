import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import { DollarSign, History, TrendingUp } from "lucide-react";
import type { InvestmentsMetrics } from "../lib/investment-metrics";

type InvestmentStatsGridProps = {
  metrics: InvestmentsMetrics;
};

export function InvestmentStatsGrid({ metrics }: InvestmentStatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            Total Profit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-semibold tabular-nums ${
              metrics.totalProfit < 0 ? "text-red-500" : "text-emerald-600"
            }`}
          >
            {formatIsk(metrics.totalProfit)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">From completed cycles</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Average ROI</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-semibold tabular-nums ${
              metrics.averageRoi < 0 ? "text-red-500" : "text-emerald-600"
            }`}
          >
            {metrics.completedCount > 0 ? `${metrics.averageRoi.toFixed(1)}%` : "—"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Across completed cycles
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
            <DollarSign className="h-4 w-4" />
            Active Investment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {formatIsk(metrics.activeInvestment)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Currently running</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
            <History className="h-4 w-4" />
            Total Cycles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {metrics.totalCycles}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {metrics.activeCount} active, {metrics.completedCount} completed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
