"use client";

import { formatIsk } from "@/lib/utils";
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import type { CycleLine } from "@eve/shared/tradecraft-cycles";
import { DollarSign } from "lucide-react";
import { getProfitToneClass } from "../lib/cycle-lines-helpers";

type CycleLinesTableSectionProps = {
  isLoading: boolean;
  lines: CycleLine[];
  onOpenBrokerDialog: (line: CycleLine) => void;
  onOpenRelistDialog: (line: CycleLine) => void;
  onDeleteLine: (lineId: string) => void;
};

export function CycleLinesTableSection({
  isLoading,
  lines,
  onOpenBrokerDialog,
  onOpenRelistDialog,
  onDeleteLine,
}: CycleLinesTableSectionProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border p-4 surface-1">
        <Skeleton className="h-8 w-full mb-2" />
        <Skeleton className="h-8 w-full mb-2" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center surface-1">
        <p className="text-muted-foreground">
          No cycle lines yet. Create one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border surface-1 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead className="text-right">Planned</TableHead>
            <TableHead className="text-right">Bought</TableHead>
            <TableHead className="text-right">Sold</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead className="text-right">Buy Cost</TableHead>
            <TableHead className="text-right">Sales Net</TableHead>
            <TableHead className="text-right">Broker Fees</TableHead>
            <TableHead className="text-right">Relist Fees</TableHead>
            <TableHead className="text-right">Line Profit</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const profit = Number(line.lineProfitExclTransport);

            return (
              <TableRow key={line.id}>
                <TableCell className="font-medium">
                  <div>
                    <div className="text-sm">{line.typeName}</div>
                    <div className="text-xs text-muted-foreground">
                      ID: {line.typeId}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{line.destinationStationName}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.plannedUnits.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.unitsBought.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.unitsSold.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {(line.unitsRemaining ?? 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatIsk(Number(line.buyCostIsk))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatIsk(Number(line.salesNetIsk))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatIsk(Number(line.brokerFeesIsk))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatIsk(Number(line.relistFeesIsk))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={getProfitToneClass(profit)}>
                    {formatIsk(profit)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenBrokerDialog(line)}
                    >
                      <DollarSign className="h-3 w-3 mr-1" />
                      Broker
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenRelistDialog(line)}
                    >
                      <DollarSign className="h-3 w-3 mr-1" />
                      Relist
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDeleteLine(line.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
