"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type CycleProfit = {
  lineProfitExclTransport: string;
  transportFees: string;
  cycleProfitCash: string;
  lineBreakdown: Array<{
    lineId: string;
    typeId: number;
    typeName: string;
    destinationStationName: string;
    profit: string;
  }>;
};

type TransportFee = {
  id: string;
  occurredAt: string;
  amountIsk: string;
  memo: string | null;
};

export default function CycleProfitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParamCycleId = searchParams.get("cycleId");

  const [cycleId, setCycleId] = React.useState<string>("");
  const [profit, setProfit] = React.useState<CycleProfit | null>(null);
  const [transportFees, setTransportFees] = React.useState<TransportFee[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Transport fee dialog state
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [feeAmount, setFeeAmount] = React.useState("");
  const [feeMemo, setFeeMemo] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Fetch latest open cycle if no cycleId provided
  React.useEffect(() => {
    const fetchLatestCycle = async () => {
      if (queryParamCycleId) {
        setCycleId(queryParamCycleId);
        return;
      }

      try {
        const resp = await fetch("/api/arbitrage/commits?limit=1");
        if (!resp.ok) return;
        const rows: Array<{
          id: string;
          createdAt: string;
          name?: string | null;
          closedAt?: Date | null;
        }> = await resp.json();
        // Get the first open cycle (not closed)
        const openCycle = rows.find((r) => !r.closedAt);
        if (openCycle) {
          setCycleId(openCycle.id);
        } else if (rows.length > 0) {
          // Fallback to most recent cycle if no open one
          setCycleId(rows[0].id);
        }
      } catch {
        // ignore
      }
    };
    fetchLatestCycle();
  }, [queryParamCycleId]);

  // Load profit data when cycleId changes
  React.useEffect(() => {
    if (!cycleId) return;

    setIsLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/ledger/cycles/${cycleId}/profit`).then(async (r) => {
        if (!r.ok) throw new Error(`Profit API error: ${r.status}`);
        return r.json();
      }),
      fetch(`/api/ledger/cycles/${cycleId}/transport-fees`).then(async (r) => {
        if (!r.ok) throw new Error(`Transport fees API error: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([profitData, feesData]) => {
        setProfit(profitData);
        setTransportFees(feesData || []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load cycle profit:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
        setIsLoading(false);
      });
  }, [cycleId]);

  const loadData = React.useCallback(async () => {
    if (!cycleId) return;

    setIsLoading(true);
    setError(null);
    try {
      const [profitData, feesData] = await Promise.all([
        fetch(`/api/ledger/cycles/${cycleId}/profit`).then(async (r) => {
          if (!r.ok) throw new Error(`Profit API error: ${r.status}`);
          return r.json();
        }),
        fetch(`/api/ledger/cycles/${cycleId}/transport-fees`).then(
          async (r) => {
            if (!r.ok) throw new Error(`Transport fees API error: ${r.status}`);
            return r.json();
          },
        ),
      ]);
      setProfit(profitData);
      setTransportFees(feesData || []);
    } catch (err) {
      console.error("Failed to load cycle profit:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [cycleId]);

  const handleAddTransportFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleId || !feeAmount) return;

    // Validate amount format (must be decimal with 2 places)
    const amountNum = Number(feeAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setSubmitError("Please enter a valid amount greater than 0");
      return;
    }
    const amountIsk = amountNum.toFixed(2);

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const resp = await fetch(`/api/ledger/cycles/${cycleId}/transport-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountIsk,
          memo: feeMemo.trim() || undefined,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to add transport fee");
      }

      // Success - reload data and close dialog
      await loadData();
      setIsDialogOpen(false);
      setFeeAmount("");
      setFeeMemo("");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to add transport fee",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/arbitrage/cycles")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cycle Profit
            </h1>
            <p className="text-sm text-muted-foreground">Error loading data</p>
          </div>
        </div>
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !profit) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/arbitrage/cycles")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cycle Profit
            </h1>
            {cycleId ? (
              <p className="text-sm text-muted-foreground">
                Loading profit for cycle {cycleId.slice(0, 8)}...
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Loading latest open cycle...
              </p>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const lineProfitNum = Number(profit.lineProfitExclTransport);
  const transportFeesNum = Number(profit.transportFees);
  const totalProfitNum = Number(profit.cycleProfitCash);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/arbitrage/cycles")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cycle Profit
          </h1>
          <p className="text-sm text-muted-foreground">
            Cash-only profit for cycle {cycleId.slice(0, 8)}...
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4 surface-1">
          <div className="text-sm text-muted-foreground">Line Profit</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatIsk(lineProfitNum)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sales net minus costs and fees (excl. transport)
          </p>
        </div>
        <div className="rounded-lg border p-4 surface-1">
          <div className="text-sm text-muted-foreground">Transport Fees</div>
          <div className="mt-2 text-2xl font-semibold text-red-400">
            {formatIsk(transportFeesNum)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total transport costs
          </p>
        </div>
        <div className="rounded-lg border p-4 surface-1">
          <div className="text-sm text-muted-foreground">Net Cash Profit</div>
          <div
            className={`mt-2 text-2xl font-semibold ${
              totalProfitNum < 0 ? "text-red-400" : "text-emerald-500"
            }`}
          >
            {formatIsk(totalProfitNum)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Line profit minus transport fees
          </p>
        </div>
      </div>

      {/* Line Breakdown */}
      {profit.lineBreakdown && profit.lineBreakdown.length > 0 ? (
        <div className="rounded-lg border surface-1 overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-base font-medium">Line Breakdown</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profit.lineBreakdown.map((line) => {
                const lineProfit = Number(line.profit);
                const isNegative = lineProfit < 0;

                return (
                  <TableRow key={line.lineId}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="text-sm">{line.typeName}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {line.typeId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{line.destinationStationName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          isNegative ? "text-red-400" : "text-emerald-500"
                        }
                      >
                        {formatIsk(lineProfit)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center surface-1">
          <p className="text-muted-foreground">
            No cycle lines yet. Commit a plan to get started.
          </p>
        </div>
      )}

      {/* Transport Fees */}
      <div className="rounded-lg border surface-1 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-base font-medium">Transport Fees</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Record Transport Fee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddTransportFee}>
                <DialogHeader>
                  <DialogTitle>Record Transport Fee</DialogTitle>
                  <DialogDescription>
                    Add a manual transport fee for this cycle (e.g., hauling
                    contract cost).
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">
                      Amount (ISK) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="1000000.00"
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="memo">Memo (optional)</Label>
                    <Textarea
                      id="memo"
                      placeholder="e.g., Contract from Jita to Dodixie"
                      value={feeMemo}
                      onChange={(e) => setFeeMemo(e.target.value)}
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </div>
                  {submitError && (
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {submitError}
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setSubmitError(null);
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !feeAmount}>
                    {isSubmitting ? "Adding..." : "Add Fee"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {transportFees.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transportFees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell>
                    {new Date(fee.occurredAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{fee.memo || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-400">
                    {formatIsk(Number(fee.amountIsk))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No transport fees recorded yet. Click "Record Transport Fee" to
              add one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
