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
} from "@/components/ui/empty";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserRound, LogIn, Wallet, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
};

export default function MyInvestmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [participations, setParticipations] = React.useState<
    ParticipationHistory[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [authRequired, setAuthRequired] = React.useState(false);

  React.useEffect(() => {
    // Don't do anything until we have a definitive auth status
    if (status === "loading") {
      return;
    }

    // If not authenticated, stop loading and don't fetch
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }

    // Only fetch if we're authenticated AND have a session with access token
    if (status === "authenticated" && session?.accessToken) {
      async function loadParticipations() {
        try {
          // Fetch all participations for the current user
          const res = await fetch("/api/ledger/participations/all");
          if (!res.ok) {
            // Don't throw error, just log and set loading to false
            if (res.status === 401) {
              // Session exists but backend rejected the token: treat as unauthenticated for UX
              setAuthRequired(true);
            } else {
              console.error("Failed to fetch participations:", res.status);
            }
            setLoading(false);
            return;
          }
          const data = await res.json();
          setParticipations(data);
        } catch (error) {
          console.error("Failed to load participations:", error);
        } finally {
          setLoading(false);
        }
      }

      loadParticipations();
    } else if (status === "authenticated" && !session?.accessToken) {
      // Authenticated but no access token yet, keep loading
      return;
    }
  }, [status, session]);

  // Calculate summary statistics
  const totalInvested = participations.reduce(
    (sum, p) => sum + Number(p.amountIsk),
    0,
  );
  // Total returned = investment + profit for all completed payouts
  const totalReturned = participations.reduce((sum, p) => {
    if (p.payoutAmountIsk && p.payoutPaidAt) {
      const investment = Number(p.amountIsk);
      const profitShare = Number(p.payoutAmountIsk);
      return sum + investment + profitShare;
    }
    return sum;
  }, 0);
  const netProfit = totalReturned - totalInvested;
  const activeParticipations = participations.filter(
    (p) =>
      p.status === "OPTED_IN" ||
      p.status === "AWAITING_INVESTMENT" ||
      p.status === "AWAITING_VALIDATION",
  ).length;

  // Not authenticated or auth required - show login CTA
  if (!session || status === "unauthenticated" || authRequired) {
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
                          : "/arbitrage/my-investments",
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
  if (loading || status === "loading") {
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
                <EmptyTitle>No investments yet</EmptyTitle>
                <EmptyDescription>
                  You haven't participated in any arbitrage cycles yet. Opt-in
                  to the next cycle to start investing and earning passive
                  income.
                </EmptyDescription>
                <Button
                  onClick={() => router.push("/arbitrage/cycles")}
                  className="mt-4"
                >
                  View Cycles
                </Button>
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
            <CardDescription className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              Total Invested
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatIsk(totalInvested)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {participations.length} cycle
              {participations.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Returned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatIsk(totalReturned)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From completed cycles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Net Profit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold tabular-nums ${
                netProfit < 0 ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {formatIsk(netProfit)}
            </div>
            <p
              className={`text-xs mt-1 font-medium ${
                netProfit < 0 ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {totalInvested > 0
                ? `${((netProfit / totalInvested) * 100).toFixed(1)}% ROI`
                : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Investments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {activeParticipations}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Participation History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Investment History</CardTitle>
          <CardDescription>
            All your participations across arbitrage cycles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle</TableHead>
                  <TableHead className="text-right">Investment</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">ROI %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participations.map((p) => {
                  const invested = Number(p.amountIsk);
                  // payoutAmountIsk is the profit share, total payout = investment + profit
                  const profitShare = Number(p.payoutAmountIsk || 0);
                  const totalPayout =
                    profitShare > 0 ? invested + profitShare : 0;
                  const roi = invested > 0 ? (profitShare / invested) * 100 : 0;

                  return (
                    <TableRow key={p.cycleId}>
                      <TableCell className="font-medium">
                        {p.cycle.name || p.cycleId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatIsk(invested)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totalPayout > 0 ? (
                          <div>
                            <div className="font-semibold">
                              {formatIsk(totalPayout)}
                            </div>
                            {!p.payoutPaidAt && (
                              <div className="text-xs text-amber-600">
                                Pending
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
