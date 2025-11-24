"use client";

import * as React from "react";
import {
  History,
  TrendingUp,
  Calendar,
  Users,
  Clock,
  DollarSign,
  Percent,
  Target,
} from "lucide-react";
import { formatIsk } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Skeleton } from "@eve/ui";
import { Badge } from "@eve/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui";
import { useCycleHistory } from "../api";

export default function CycleHistoryPage() {
  const { data: cycles = [], isLoading: loading } = useCycleHistory();

  // Calculate statistics
  const totalCycles = cycles.length;
  const avgDuration =
    cycles.length > 0
      ? Math.round(
          cycles.reduce((sum, c) => sum + (c.durationDays ?? 0), 0) /
            cycles.length,
        )
      : 0;

  const totalProfit = cycles.reduce((sum, c) => sum + Number(c.profitIsk), 0);

  const avgRoi =
    cycles.length > 0
      ? cycles.reduce((sum, c) => sum + Number(c.roiPercent), 0) / cycles.length
      : 0;

  const profitableCycles = cycles.filter((c) => Number(c.profitIsk) > 0).length;
  const winRate = totalCycles > 0 ? (profitableCycles / totalCycles) * 100 : 0;

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <History className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cycle History</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Historical performance across all completed tradecraft cycles
            </p>
          </div>
        </div>
      </div>

      {cycles.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Empty className="min-h-48">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <History className="size-6" />
                </EmptyMedia>
                <EmptyTitle>No completed cycles yet</EmptyTitle>
                <EmptyDescription>
                  Once cycles are completed, their performance history will
                  appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Statistics Cards */}
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
                  {totalCycles}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg {avgDuration}d duration
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
                    totalProfit >= 0 ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {formatIsk(totalProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all cycles
                </p>
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
                    avgRoi >= 0 ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {avgRoi >= 0 ? "+" : ""}
                  {avgRoi.toFixed(2)}%
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
                  {winRate.toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {profitableCycles}/{totalCycles} profitable
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cycles Table */}
          <Card>
            <CardHeader>
              <CardTitle>Completed Cycles</CardTitle>
              <CardDescription>
                Historical performance of all closed trading cycles
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="pl-6 font-semibold text-foreground">
                        Cycle
                      </TableHead>
                      <TableHead className="font-semibold text-foreground">
                        Period
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground">
                        <div className="flex items-center justify-end gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          Duration
                        </div>
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground">
                        <div className="flex items-center justify-end gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          Investors
                        </div>
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground">
                        Initial Capital
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground">
                        <div className="flex items-center justify-end gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Profit
                        </div>
                      </TableHead>
                      <TableHead className="pr-6 text-right font-semibold text-foreground">
                        <div className="flex items-center justify-end gap-1.5">
                          <Percent className="h-3.5 w-3.5" />
                          ROI
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycles.map((cycle) => {
                      const profit = Number(cycle.profitIsk);
                      const roi = Number(cycle.roiPercent);
                      const isProfitable = profit >= 0;

                      return (
                        <TableRow
                          key={cycle.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="pl-6 font-medium">
                            {cycle.name ?? cycle.id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">
                              {new Date(cycle.startedAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              to{" "}
                              {cycle.closedAt
                                ? new Date(cycle.closedAt).toLocaleDateString()
                                : "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {cycle.durationDays
                              ? `${cycle.durationDays}d`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {cycle.participantCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {formatIsk(Number(cycle.initialCapitalIsk || 0))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">
                            <div
                              className={
                                isProfitable
                                  ? "text-emerald-500"
                                  : "text-red-500"
                              }
                            >
                              {isProfitable ? "+" : ""}
                              {formatIsk(profit)}
                            </div>
                          </TableCell>
                          <TableCell className="pr-6 text-right tabular-nums font-medium">
                            <Badge
                              variant={isProfitable ? "default" : "secondary"}
                              className="font-mono"
                            >
                              {roi >= 0 ? "+" : ""}
                              {roi.toFixed(2)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
