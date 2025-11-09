"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Input } from "@eve/ui";
import { Button } from "@eve/ui";
import { Badge } from "@eve/ui";
import { Alert, AlertDescription } from "@eve/ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  RefreshCw,
  Loader2,
  AlertCircle,
  Filter,
} from "lucide-react";
import { useWalletTransactions } from "../../api";

type Tx = {
  characterId: number;
  characterName: string | null;
  transactionId: string; // bigint serialized
  date: string;
  isBuy: boolean;
  locationId: number;
  stationName: string | null;
  typeId: number;
  typeName: string | null;
  quantity: number;
  unitPrice: string;
};

export default function TransactionsPage() {
  const [charId, setCharId] = React.useState("");
  const [filterCharId, setFilterCharId] = React.useState<number | undefined>(
    undefined,
  );

  // Use new API hook
  const {
    data: rows = [],
    isLoading: loading,
    error,
    refetch,
  } = useWalletTransactions(filterCharId);

  const load = () => {
    // Update filter to trigger refetch
    const numCharId = charId ? Number(charId) : undefined;
    if ((numCharId !== undefined && !isNaN(numCharId)) || charId === "") {
      setFilterCharId(charId === "" ? undefined : numCharId);
    }
  };

  const formatIsk = (value: string) => {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(parseFloat(value));
  };

  const buyTransactions = rows.filter((r) => r.isBuy);
  const sellTransactions = rows.filter((r) => !r.isBuy);
  const totalBuyVolume = buyTransactions.reduce(
    (acc, r) => acc + r.quantity * parseFloat(r.unitPrice),
    0,
  );
  const totalSellVolume = sellTransactions.reduce(
    (acc, r) => acc + r.quantity * parseFloat(r.unitPrice),
    0,
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Receipt className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Wallet Transactions
          </h1>
          <p className="text-sm text-muted-foreground">
            Recent transactions from the last 14 days
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Total Transactions
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {rows.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 14 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <ArrowDownLeft className="h-4 w-4 text-blue-600" />
              Buy Orders
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-blue-600">
              {buyTransactions.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatIsk(totalBuyVolume.toString())} ISK
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              Sell Orders
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-emerald-600">
              {sellTransactions.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatIsk(totalSellVolume.toString())} ISK
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Net Volume
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold tabular-nums ${
                totalSellVolume - totalBuyVolume > 0
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {formatIsk((totalSellVolume - totalBuyVolume).toString())} ISK
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sell - Buy volume
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>
            View and filter all wallet transactions from the last 14 days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Controls */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by character ID (optional)"
                value={charId}
                onChange={(e) => setCharId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void load();
                }}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => void load()}
              disabled={loading}
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
                  Refresh
                </>
              )}
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error instanceof Error ? error.message : String(error)}
              </AlertDescription>
            </Alert>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-sm font-medium mb-1">
                No transactions found
              </h3>
              <p className="text-sm text-muted-foreground">
                {charId
                  ? "Try a different character ID or clear the filter"
                  : "No transactions recorded in the last 14 days"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Character</th>
                      <th className="text-left p-3 font-medium">Item</th>
                      <th className="text-left p-3 font-medium">Station</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-right p-3 font-medium">Qty</th>
                      <th className="text-right p-3 font-medium">Unit Price</th>
                      <th className="text-right p-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r, i) => {
                      const total = r.quantity * parseFloat(r.unitPrice);
                      return (
                        <tr
                          key={`${r.transactionId}-${i}`}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="p-3 text-xs text-muted-foreground">
                            {new Date(r.date).toLocaleDateString()}{" "}
                            <span className="text-[10px]">
                              {new Date(r.date).toLocaleTimeString()}
                            </span>
                          </td>
                          <td
                            className="p-3 font-medium"
                            title={String(r.characterId)}
                          >
                            {r.characterName || r.characterId}
                          </td>
                          <td className="p-3" title={String(r.typeId)}>
                            <div className="max-w-[200px] truncate">
                              {r.typeName || r.typeId}
                            </div>
                          </td>
                          <td
                            className="p-3 text-xs text-muted-foreground"
                            title={r.stationName || String(r.locationId)}
                          >
                            {(r.stationName
                              ? r.stationName.split(" ")[0]
                              : null) || r.locationId}
                          </td>
                          <td className="p-3">
                            {r.isBuy ? (
                              <Badge
                                variant="outline"
                                className="bg-blue-500/10 text-blue-600 gap-1"
                              >
                                <ArrowDownLeft className="h-3 w-3" />
                                Buy
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 gap-1"
                              >
                                <ArrowUpRight className="h-3 w-3" />
                                Sell
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {r.quantity.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-xs">
                            {formatIsk(r.unitPrice)}
                          </td>
                          <td className="p-3 text-right font-mono text-xs font-semibold">
                            {formatIsk(total.toString())}
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
