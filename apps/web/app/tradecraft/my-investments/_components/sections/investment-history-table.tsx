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
import { formatIsk } from "@/lib/utils";
import { toInvestmentHistoryRow } from "../lib/investment-history";
import type { MyInvestmentParticipation } from "../lib/types";

type InvestmentHistoryTableProps = {
  participations: MyInvestmentParticipation[];
};

export function InvestmentHistoryTable({
  participations,
}: InvestmentHistoryTableProps) {
  return (
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
                <TableHead className="text-right text-foreground">Principal</TableHead>
                <TableHead className="text-right text-foreground">
                  Investment
                </TableHead>
                <TableHead className="text-right text-foreground">Payout</TableHead>
                <TableHead className="text-right text-foreground">Profit</TableHead>
                <TableHead className="text-right text-foreground">ROI %</TableHead>
                <TableHead className="text-foreground">Status</TableHead>
                <TableHead className="text-foreground">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participations.map((participation) => {
                const row = toInvestmentHistoryRow(participation);

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.cycleLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatIsk(row.principal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatIsk(row.invested)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.totalPayout > 0 ? (
                        <div>
                          <div className="font-semibold">
                            {row.rolloverDeducted > 0 ? (
                              <span className="text-amber-600">0.00 ISK</span>
                            ) : (
                              formatIsk(row.totalPayout)
                            )}
                          </div>
                          {row.rolloverDeducted > 0 && (
                            <div className="text-xs text-emerald-600">
                              Rolled Over
                            </div>
                          )}
                          {!row.isPaid && row.rolloverDeducted === 0 && (
                            <div className="text-xs text-amber-600">
                              Awaiting Payment
                            </div>
                          )}
                          {row.isPaid && row.rolloverDeducted === 0 && (
                            <div className="text-xs text-emerald-600">Paid</div>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        row.profitShare < 0
                          ? "text-red-500"
                          : row.profitShare > 0
                            ? "text-emerald-600"
                            : ""
                      }`}
                    >
                      {row.profitShare > 0 ? formatIsk(row.profitShare) : "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        row.roi < 0
                          ? "text-red-500"
                          : row.roi > 0
                            ? "text-emerald-600"
                            : ""
                      }`}
                    >
                      {row.profitShare > 0 ? `${row.roi.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.statusLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.createdDateLabel}
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
