"use client";

import { Clock, Percent, TrendingUp, Users } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import type { CycleHistoryCycle } from "../lib/types";

type CycleHistoryTableSectionProps = {
  cycles: CycleHistoryCycle[];
};

export function CycleHistoryTableSection({
  cycles,
}: CycleHistoryTableSectionProps) {
  return (
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
                      {cycle.durationDays ? `${cycle.durationDays}d` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {cycle.participantCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatIsk(Number(cycle.initialCapitalIsk || 0))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      <div
                        className={isProfitable ? "text-emerald-500" : "text-red-500"}
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
  );
}
