"use client";

import * as React from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatIsk } from "@/lib/utils";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import {
  UserRound,
  LogIn,
  Wallet,
  TrendingUp,
  DollarSign,
  History,
} from "lucide-react";
import { Button } from "@eve/ui";
import { Badge } from "@eve/ui";
import { Skeleton } from "@eve/ui";
import { useMyParticipationHistory } from "../api";

type ParticipationHistory = {
  cycleId: string;
  cycle: {
    id: string;
    name: string | null;
    startedAt: string;
    closedAt: string | null;
  };
  amountIsk: string;
  status: string;
  createdAt: string;
  validatedAt: string | null;
  payoutAmountIsk?: string | null;
  payoutPaidAt?: string | null;
  rolloverDeductedIsk?: string | null; // Amount that was rolled over to next cycle
};

export default function MyInvestmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Use new API hook
  const {
    data: participations = [],
    isLoading: loading,
    error,
  } = useMyParticipationHistory();

  const authRequired = status === "unauthenticated" || error;

  // Calculate summary statistics

  // Filter completed and active cycles
  const completedCycles = participations.filter(
    (p) => p.status === "COMPLETED",
  );
  const activeCycles = participations.filter(
    (p) =>
      p.status === "OPTED_IN" ||
      p.status === "AWAITING_INVESTMENT" ||
      p.status === "AWAITING_VALIDATION" ||
      p.status === "AWAITING_PAYOUT",
  );

  // Total profit from completed cycles (including rolled-over amounts)
  const totalProfit = completedCycles.reduce((sum, p) => {
    const payoutReceived = Number(p.payoutAmountIsk || 0);
    const rolloverDeducted = Number(p.rolloverDeductedIsk || 0);
    const fullPayout = payoutReceived + rolloverDeducted;
    const invested = Number(p.amountIsk);
    const profit = fullPayout > 0 ? fullPayout - invested : 0;
    return sum + profit;
  }, 0);

  // Average ROI from completed cycles
  const totalInvestedInCompletedCycles = completedCycles.reduce(
    (sum, p) => sum + Number(p.amountIsk),
    0,
  );
  const averageRoi =
    totalInvestedInCompletedCycles > 0
      ? (totalProfit / totalInvestedInCompletedCycles) * 100
      : 0;

  // Active investment amount
  const activeInvestment = activeCycles.reduce(
    (sum, p) => sum + Number(p.amountIsk),
    0,
  );

  // Total cycles and breakdown
  const totalCycles = participations.length;
  const completedCount = completedCycles.length;
  const activeCount = activeCycles.length;

  // Not authenticated or auth required - show login CTA
  if (!session || status !== "authenticated" || authRequired) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Wallet className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            My Investments
          </h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LogIn className="size-6" />
                </EmptyMedia>
                <EmptyTitle>Sign in to view your investments</EmptyTitle>
                <EmptyDescription>
                  Connect your EVE Online character to see your participation
                  history, returns, and investment performance.
                </EmptyDescription>
                <Button
                  onClick={() =>
                    signIn("eveonline", {
                      callbackUrl:
                        typeof window !== "undefined"
                          ? window.location.href
                          : "/tradecraft/my-investments",
                    })
                  }
                  className="mt-4 gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in with EVE Online
                </Button>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state (including session loading)
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

  // Authenticated but no participations
  if (participations.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Wallet className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            My Investments
          </h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Empty className="min-h-64">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UserRound className="size-6" />
                </EmptyMedia>
                <EmptyTitle>Start Your Investment Journey</EmptyTitle>
                <EmptyDescription>
                  You haven&apos;t participated in any tradecraft cycles yet.
                  Join the next cycle to start earning passive income through
                  our EVE Online trading program. Check out our historical
                  performance to see what returns you can expect!
                </EmptyDescription>
                <div className="flex gap-3 mt-4">
                  <Button
                    onClick={() => router.push("/tradecraft/cycles")}
                    className="gap-2"
                  >
                    <TrendingUp className="h-4 w-4" />
                    View Available Cycles
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/tradecraft/cycle-history")}
                    className="gap-2"
                  >
                    <History className="h-4 w-4" />
                    View Performance History
                  </Button>
                </div>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authenticated with participations - show full dashboard
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Wallet className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          My Investments
        </h1>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Total Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold tabular-nums ${
                totalProfit < 0 ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {formatIsk(totalProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From completed cycles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold tabular-nums ${
                averageRoi < 0 ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {completedCycles.length > 0 ? `${averageRoi.toFixed(1)}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across completed cycles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              Active Investment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatIsk(activeInvestment)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <History className="h-4 w-4" />
              Total Cycles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {totalCycles}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCount} active, {completedCount} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Participation History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Investment History</CardTitle>
          <CardDescription>
            All your participations across tradecraft cycles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Cycle</TableHead>
                  <TableHead className="text-right text-foreground">
                    Investment
                  </TableHead>
                  <TableHead className="text-right text-foreground">
                    Payout
                  </TableHead>
                  <TableHead className="text-right text-foreground">
                    Profit
                  </TableHead>
                  <TableHead className="text-right text-foreground">
                    ROI %
                  </TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participations.map((p) => {
                  const invested = Number(p.amountIsk);
                  // Calculate actual profit including any amount rolled over
                  const payoutReceived = Number(p.payoutAmountIsk || 0);
                  const rolloverDeducted = Number(p.rolloverDeductedIsk || 0);
                  const fullPayout = payoutReceived + rolloverDeducted;
                  const profitShare =
                    fullPayout > 0 ? fullPayout - invested : 0;
                  const totalPayout = fullPayout > 0 ? fullPayout : 0;
                  const roi = invested > 0 ? (profitShare / invested) * 100 : 0;
                  const isPaid = !!p.payoutPaidAt;

                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.cycle?.name || p.cycleId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatIsk(invested)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totalPayout > 0 ? (
                          <div>
                            <div className="font-semibold">
                              {rolloverDeducted > 0 ? (
                                <span className="text-amber-600">0.00 ISK</span>
                              ) : (
                                formatIsk(totalPayout)
                              )}
                            </div>
                            {rolloverDeducted > 0 && (
                              <div className="text-xs text-emerald-600">
                                Rolled Over
                              </div>
                            )}
                            {!isPaid && rolloverDeducted === 0 && (
                              <div className="text-xs text-amber-600">
                                Awaiting Payment
                              </div>
                            )}
                            {isPaid && rolloverDeducted === 0 && (
                              <div className="text-xs text-emerald-600">
                                Paid
                              </div>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          profitShare < 0
                            ? "text-red-500"
                            : profitShare > 0
                              ? "text-emerald-600"
                              : ""
                        }`}
                      >
                        {profitShare > 0 ? formatIsk(profitShare) : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          roi < 0
                            ? "text-red-500"
                            : roi > 0
                              ? "text-emerald-600"
                              : ""
                        }`}
                      >
                        {profitShare > 0 ? `${roi.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {p.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
