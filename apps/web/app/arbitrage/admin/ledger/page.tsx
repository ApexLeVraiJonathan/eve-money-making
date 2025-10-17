"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
} from "lucide-react";

type Entry = {
  id: string;
  occurredAt: string;
  entryType: string;
  amount: string;
  memo: string | null;
  planCommitId: string | null;
  characterName: string | null;
  stationName: string | null;
  typeName: string | null;
  source: string;
  matchStatus: string | null;
};

export default function LedgerPage() {
  const [cycleId, setCycleId] = React.useState("");
  const [rows, setRows] = React.useState<Entry[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [cycles, setCycles] = React.useState<
    Array<{ id: string; name: string | null }>
  >([]);

  const loadEntriesForCycle = async (targetCycleId: string) => {
    if (!targetCycleId) {
      setError("Please select a cycle");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ledger/entries?cycleId=${encodeURIComponent(targetCycleId)}`,
        {
          cache: "no-store",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setRows(data as Entry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const load = async () => {
    await loadEntriesForCycle(cycleId);
  };

  const loadCycles = async () => {
    try {
      const res = await fetch("/api/ledger/cycles", { cache: "no-store" });
      const data = (await res.json()) as Array<{
        id: string;
        name: string | null;
        startedAt: string;
        closedAt: string | null;
      }>;
      if (res.ok) {
        setCycles(data);
        // Auto-select the latest cycle (first in the list)
        if (data.length > 0 && !cycleId) {
          const latestCycle = data[0];
          setCycleId(latestCycle.id);
          // Auto-load the entries for the latest cycle
          loadEntriesForCycle(latestCycle.id);
        }
      }
    } catch {}
  };

  React.useEffect(() => {
    void loadCycles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatIsk = (value: string) => {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(parseFloat(value));
  };

  const getEntryTypeBadge = (type: string) => {
    const typeUpper = type.toUpperCase();
    if (typeUpper.includes("BUY") || typeUpper.includes("PURCHASE")) {
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-600 gap-1 text-xs"
        >
          <ArrowDownLeft className="h-3 w-3" />
          {type}
        </Badge>
      );
    } else if (typeUpper.includes("SELL") || typeUpper.includes("SALE")) {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 gap-1 text-xs"
        >
          <ArrowUpRight className="h-3 w-3" />
          {type}
        </Badge>
      );
    } else if (
      typeUpper.includes("FEE") ||
      typeUpper.includes("TAX") ||
      typeUpper.includes("BROKER")
    ) {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 text-xs">
          {type}
        </Badge>
      );
    } else if (typeUpper.includes("DEPOSIT") || typeUpper.includes("INJECT")) {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 text-xs"
        >
          {type}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {type}
      </Badge>
    );
  };

  const totalAmount = rows.reduce((acc, r) => acc + parseFloat(r.amount), 0);
  const positiveEntries = rows.filter((r) => parseFloat(r.amount) > 0);
  const negativeEntries = rows.filter((r) => parseFloat(r.amount) < 0);
  const totalPositive = positiveEntries.reduce(
    (acc, r) => acc + parseFloat(r.amount),
    0,
  );
  const totalNegative = negativeEntries.reduce(
    (acc, r) => acc + parseFloat(r.amount),
    0,
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <BookOpen className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cycle Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            View all financial entries for a specific cycle
          </p>
        </div>
      </div>

      {/* Summary Stats (only show if data loaded) */}
      {rows.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                Total Entries
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                {rows.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ledger entries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                Credits
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums text-emerald-600">
                {positiveEntries.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                +{formatIsk(totalPositive.toString())} ISK
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <ArrowDownLeft className="h-4 w-4 text-red-600" />
                Debits
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums text-red-600">
                {negativeEntries.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatIsk(totalNegative.toString())} ISK
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Net Amount
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-semibold tabular-nums ${
                  totalAmount > 0
                    ? "text-emerald-600"
                    : totalAmount < 0
                      ? "text-red-600"
                      : ""
                }`}
              >
                {totalAmount > 0 ? "+" : ""}
                {formatIsk(totalAmount.toString())} ISK
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total balance
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ledger Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Ledger Entries
          </CardTitle>
          <CardDescription>
            Select a cycle to view all its financial transactions and entries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cycle Selection */}
          <div className="flex gap-2">
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a cycle..." />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name || c.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => void load()}
              disabled={loading || !cycleId}
              variant="outline"
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Load Entries
                </>
              )}
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-sm font-medium mb-1">No entries yet</h3>
              <p className="text-sm text-muted-foreground">
                {cycleId
                  ? "This cycle has no ledger entries"
                  : "Select a cycle to view its ledger entries"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Character</th>
                      <th className="text-left p-3 font-medium">Station</th>
                      <th className="text-left p-3 font-medium">Item</th>
                      <th className="text-left p-3 font-medium">Source</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => {
                      const amount = parseFloat(r.amount);
                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="p-3 text-xs text-muted-foreground">
                            {new Date(r.occurredAt).toLocaleDateString()}{" "}
                            <span className="text-[10px]">
                              {new Date(r.occurredAt).toLocaleTimeString()}
                            </span>
                          </td>
                          <td className="p-3">
                            {getEntryTypeBadge(r.entryType)}
                          </td>
                          <td
                            className={`p-3 text-right font-mono text-xs font-semibold ${
                              amount > 0
                                ? "text-emerald-600"
                                : amount < 0
                                  ? "text-red-600"
                                  : ""
                            }`}
                          >
                            {amount > 0 ? "+" : ""}
                            {formatIsk(r.amount)} ISK
                          </td>
                          <td className="p-3 font-medium">
                            {r.characterName ?? "-"}
                          </td>
                          <td
                            className="p-3 text-xs text-muted-foreground"
                            title={r.stationName || undefined}
                          >
                            {(r.stationName
                              ? r.stationName.split(" ")[0]
                              : null) || "-"}
                          </td>
                          <td className="p-3">
                            <div className="max-w-[150px] truncate">
                              {r.typeName ?? "-"}
                            </div>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {r.source}
                          </td>
                          <td className="p-3">
                            {r.matchStatus ? (
                              <Badge variant="secondary" className="text-xs">
                                {r.matchStatus}
                              </Badge>
                            ) : r.planCommitId ? (
                              <Badge
                                variant="outline"
                                className="bg-green-500/10 text-green-600 text-xs"
                              >
                                Linked
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
