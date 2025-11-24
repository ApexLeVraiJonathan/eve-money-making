"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@eve/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import { ArrowLeft } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import { useCycleProfit, useTransportFees } from "@/app/tradecraft/api";
import { Skeleton } from "@eve/ui";

export default function CycleProfitPage() {
  const params = useParams();
  const router = useRouter();
  const cycleId = params.cycleId as string;

  // Use new API hooks
  const { data: profit, isLoading } = useCycleProfit(cycleId);
  const { data: transportFees = [] } = useTransportFees(cycleId);

  if (isLoading || !profit) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/tradecraft/cycles")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cycle Profit
            </h1>
            <p className="text-sm text-muted-foreground">Loading...</p>
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
          onClick={() => router.push("/tradecraft/cycles")}
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

      {/* Transport Fees */}
      {transportFees.length > 0 && (
        <div className="rounded-lg border surface-1 overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-base font-medium">Transport Fees</h2>
          </div>
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
        </div>
      )}
    </div>
  );
}
