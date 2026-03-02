"use client";

import { Calendar, DollarSign, Percent, Target } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@eve/ui";
import type { CycleHistoryMetrics } from "../lib/types";

type CycleHistoryStatsGridProps = {
  metrics: CycleHistoryMetrics;
};

export function CycleHistoryStatsGrid({ metrics }: CycleHistoryStatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Total Cycles
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {metrics.totalCycles}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Avg {metrics.averageDurationDays}d duration
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Total Profit
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold tabular-nums ${
              metrics.totalProfitIsk >= 0 ? "text-emerald-500" : "text-red-500"
            }`}
          >
            {formatIsk(metrics.totalProfitIsk)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Across all cycles</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Percent className="h-4 w-4" />
            Average ROI
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold tabular-nums ${
              metrics.averageRoiPercent >= 0 ? "text-emerald-500" : "text-red-500"
            }`}
          >
            {metrics.averageRoiPercent >= 0 ? "+" : ""}
            {metrics.averageRoiPercent.toFixed(2)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Return on investment
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Target className="h-4 w-4" />
            Success Rate
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {metrics.winRatePercent.toFixed(0)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.profitableCycles}/{metrics.totalCycles} profitable
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
