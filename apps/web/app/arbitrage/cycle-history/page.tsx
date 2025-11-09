"use client";

import * as React from "react";
import { History, TrendingUp, Calendar, Users, Clock } from "lucide-react";
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
import { useCycles, useCycleProfit, useParticipations } from "../api";

type CycleHistory = {
  id: string;
  name: string | null;
  startedAt: string;
  closedAt: string | null;
  status: string;
  initialCapitalIsk: string;
  finalCashIsk: string | null;
  profitIsk: string | null;
  marginPct: number | null;
  participantCount: number;
  totalInvestorCapital: number;
  durationDays: number | null;
};

type Cycle = {
  id: string;
  name: string | null;
  startedAt: string;
  closedAt: string | null;
  initialCapitalIsk: string;
};

type Participation = {
  status: string;
  amountIsk: string;
};

export default function CycleHistoryPage() {
  // Use new API hook
  const { data: allCycles = [], isLoading: loading } = useCycles();

  // Only show closed cycles
  const cycles = React.useMemo(
    () => allCycles.filter((c) => c.closedAt !== null),
    [allCycles],
  );

  // We would need individual hooks for each cycle's profit/participations
  // For simplicity, showing basic cycle data - full enrichment can be added if needed

  // Calculate basic statistics
  const totalCycles = cycles.length;

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
              Review performance across all completed cycles
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
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Calendar className="h-4 w-4" />
                  Total Cycles
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {totalCycles}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Completed cycles
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="text-sm font-medium">Average Duration</div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {cycles.length > 0
                    ? Math.round(
                        cycles.reduce((sum, c) => {
                          const days = c.closedAt
                            ? Math.ceil(
                                (new Date(c.closedAt).getTime() -
                                  new Date(c.startedAt).getTime()) /
                                  (1000 * 60 * 60 * 24),
                              )
                            : 0;
                          return sum + days;
                        }, 0) / cycles.length,
                      )
                    : 0}
                  d
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Mean cycle length
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
                        Initial Capital
                      </TableHead>
                      <TableHead className="pr-6 font-semibold text-foreground">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycles.map((cycle) => (
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
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                          {cycle.closedAt
                            ? `${Math.ceil(
                                (new Date(cycle.closedAt).getTime() -
                                  new Date(cycle.startedAt).getTime()) /
                                  (1000 * 60 * 60 * 24),
                              )}d`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatIsk(Number(cycle.initialCapitalIsk || 0))}
                        </TableCell>
                        <TableCell className="pr-6">
                          <Badge variant="outline" className="font-normal">
                            Closed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
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
