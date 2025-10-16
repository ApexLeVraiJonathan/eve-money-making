"use client";

import * as React from "react";
import { History, TrendingUp, Calendar, Users } from "lucide-react";
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
  finalCapitalIsk: string | null;
  profitIsk: string | null;
  marginPct: number | null;
  participantCount: number;
  totalInvestorCapital: number;
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
        const closedCycles = data.filter(
          (c: any) => c.closedAt !== null,
        ) as any[];

        // Fetch detailed info for each closed cycle
        const detailedCycles = await Promise.all(
          closedCycles.map(async (cycle) => {
            try {
              // Get participant count
              const participationsRes = await fetch(
                `/api/ledger/cycles/${cycle.id}/participations`,
              );
              const participationsData = await participationsRes.json();

              const validParticipations = participationsData.filter(
                (p: any) => p.status === "OPTED_IN" || p.status === "COMPLETED",
              );

              const participantCount = validParticipations.length;
              const totalInvestorCapital = validParticipations.reduce(
                (sum: number, p: any) => sum + Number(p.amountIsk),
                0,
              );

              // Get capital snapshot
              const capitalRes = await fetch(
                `/api/ledger/cycles/${cycle.id}/capital`,
              );
              const capitalData = await capitalRes.json();

              const finalCapitalIsk =
                Number(capitalData.capital.cash) +
                Number(capitalData.capital.inventory);
              const initialCapitalIsk = Number(cycle.initialCapitalIsk || 0);
              const profitIsk = finalCapitalIsk - initialCapitalIsk;
              const marginPct =
                initialCapitalIsk > 0 ? profitIsk / initialCapitalIsk : 0;

              return {
                id: cycle.id,
                name: cycle.name,
                startedAt: cycle.startedAt,
                closedAt: cycle.closedAt,
                status: "Closed",
                initialCapitalIsk: initialCapitalIsk.toString(),
                finalCapitalIsk: finalCapitalIsk.toString(),
                profitIsk: profitIsk.toString(),
                marginPct,
                participantCount,
                totalInvestorCapital,
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
                finalCapitalIsk: null,
                profitIsk: null,
                marginPct: null,
                participantCount: 0,
                totalInvestorCapital: 0,
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
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <History className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Cycle History</h1>
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
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Total Cycles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums">
                  {totalCycles}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Completed cycles
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Successful Cycles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums text-emerald-600">
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
              <CardHeader className="pb-2">
                <CardDescription>Total Profit Generated</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-3xl font-semibold tabular-nums ${
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
              <CardHeader className="pb-2">
                <CardDescription>Average ROI</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-3xl font-semibold tabular-nums ${
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
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          Investors
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        Pooled Capital
                      </TableHead>
                      <TableHead className="text-right">
                        Final Capital
                      </TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">ROI %</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycles.map((cycle) => (
                      <TableRow key={cycle.id}>
                        <TableCell className="font-medium">
                          {cycle.name ?? cycle.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div>
                            {new Date(cycle.startedAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs">
                            to{" "}
                            {cycle.closedAt
                              ? new Date(cycle.closedAt).toLocaleDateString()
                              : "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {cycle.participantCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatIsk(cycle.totalInvestorCapital)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {cycle.finalCapitalIsk
                            ? formatIsk(Number(cycle.finalCapitalIsk))
                            : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
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
                          className={`text-right tabular-nums ${
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
                        <TableCell>
                          <Badge variant="outline">{cycle.status}</Badge>
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
