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
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

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
  const [cycles, setCycles] = React.useState<CycleHistory[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadHistory() {
      try {
        // Fetch all cycles
        const res = await fetch("/api/ledger/cycles");
        const data = await res.json();

        // Only show closed cycles in history
        const closedCycles = (data as Cycle[]).filter(
          (c) => c.closedAt !== null,
        );

        // Fetch detailed info for each closed cycle
        const detailedCycles = await Promise.all(
          closedCycles.map(async (cycle) => {
            try {
              // Get participant count
              const participationsRes = await fetch(
                `/api/ledger/cycles/${cycle.id}/participations`,
              );
              const participationsData = await participationsRes.json();

              const validParticipations = (
                participationsData as Participation[]
              ).filter(
                (p) => p.status === "OPTED_IN" || p.status === "COMPLETED",
              );

              const participantCount = validParticipations.length;
              const totalInvestorCapital = validParticipations.reduce(
                (sum: number, p) => sum + Number(p.amountIsk),
                0,
              );

              // Get profit data
              const profitRes = await fetch(
                `/api/ledger/cycles/${cycle.id}/profit`,
              );
              const profitData = await profitRes.json();
              const finalProfitIsk = Number(profitData.cycleProfitCash || 0);

              const initialCapitalIsk = Number(cycle.initialCapitalIsk || 0);

              // Final cash = starting capital + realized profit
              // This is the actual liquid cash available for payouts
              const finalCashIsk = initialCapitalIsk + finalProfitIsk;

              const marginPct =
                initialCapitalIsk > 0 ? finalProfitIsk / initialCapitalIsk : 0;

              // Calculate duration in days
              const durationDays = cycle.closedAt
                ? Math.ceil(
                    (new Date(cycle.closedAt).getTime() -
                      new Date(cycle.startedAt).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                : null;

              return {
                id: cycle.id,
                name: cycle.name,
                startedAt: cycle.startedAt,
                closedAt: cycle.closedAt,
                status: "Closed",
                initialCapitalIsk: initialCapitalIsk.toString(),
                finalCashIsk: finalCashIsk.toString(),
                profitIsk: finalProfitIsk.toString(),
                marginPct,
                participantCount,
                totalInvestorCapital,
                durationDays,
              };
            } catch (error) {
              console.error(
                `Failed to load details for cycle ${cycle.id}:`,
                error,
              );
              return {
                id: cycle.id,
                name: cycle.name,
                startedAt: cycle.startedAt,
                closedAt: cycle.closedAt,
                status: "Closed",
                initialCapitalIsk: cycle.initialCapitalIsk || "0",
                finalCashIsk: null,
                profitIsk: null,
                marginPct: null,
                participantCount: 0,
                totalInvestorCapital: 0,
                durationDays: null,
              };
            }
          }),
        );

        setCycles(detailedCycles);
      } catch (error) {
        console.error("Failed to load cycle history:", error);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  // Calculate aggregate statistics
  const totalCycles = cycles.length;
  const successfulCycles = cycles.filter(
    (c) => c.marginPct !== null && c.marginPct > 0,
  ).length;
  const totalProfitGenerated = cycles.reduce(
    (sum, c) => sum + Number(c.profitIsk || 0),
    0,
  );
  const averageROI =
    cycles.length > 0
      ? cycles.reduce((sum, c) => sum + (c.marginPct || 0), 0) / cycles.length
      : 0;

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
          <div className="grid gap-4 md:grid-cols-4">
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
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  Successful Cycles
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums text-emerald-600">
                  {successfulCycles}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalCycles > 0
                    ? `${((successfulCycles / totalCycles) * 100).toFixed(0)}% success rate`
                    : "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="text-sm font-medium">
                  Total Profit Generated
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-semibold tabular-nums ${
                    totalProfitGenerated < 0
                      ? "text-red-500"
                      : "text-emerald-600"
                  }`}
                >
                  {formatIsk(totalProfitGenerated)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all cycles
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="text-sm font-medium">Average ROI</div>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-semibold tabular-nums ${
                    averageROI < 0 ? "text-red-500" : "text-emerald-600"
                  }`}
                >
                  {(averageROI * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Mean return on investment
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
                        Starting Capital
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground">
                        Final Cash
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground">
                        Realized Profit
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground">
                        ROI %
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
                          {cycle.durationDays !== null
                            ? `${cycle.durationDays}d`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {cycle.participantCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatIsk(Number(cycle.initialCapitalIsk))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-sm">
                          {cycle.finalCashIsk
                            ? formatIsk(Number(cycle.finalCashIsk))
                            : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-semibold text-sm ${
                            cycle.profitIsk && Number(cycle.profitIsk) < 0
                              ? "text-red-500"
                              : cycle.profitIsk && Number(cycle.profitIsk) > 0
                                ? "text-emerald-600"
                                : ""
                          }`}
                        >
                          {cycle.profitIsk
                            ? formatIsk(Number(cycle.profitIsk))
                            : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-semibold text-sm ${
                            cycle.marginPct && cycle.marginPct < 0
                              ? "text-red-500"
                              : cycle.marginPct && cycle.marginPct > 0
                                ? "text-emerald-600"
                                : ""
                          }`}
                        >
                          {cycle.marginPct !== null
                            ? `${(cycle.marginPct * 100).toFixed(1)}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="pr-6">
                          <Badge variant="outline" className="font-normal">
                            {cycle.status}
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
