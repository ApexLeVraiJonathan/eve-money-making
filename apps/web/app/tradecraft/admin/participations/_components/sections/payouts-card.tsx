import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@eve/ui";
import { Check, Copy, DollarSign } from "lucide-react";
import { formatIsk } from "../lib/formatting";
import type { ParticipationWithCycle } from "../lib/types";

export function PayoutsCard({
  needsPayout,
  copiedText,
  onCopy,
  onMarkPayoutSent,
}: {
  needsPayout: ParticipationWithCycle[];
  copiedText: string | null;
  onCopy: (text: string, label: string) => void;
  onMarkPayoutSent: (p: ParticipationWithCycle) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-600" />
          Payouts Needed
        </CardTitle>
        <CardDescription>
          Completed cycle participations awaiting payout ({needsPayout.length} pending)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {needsPayout.length === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-sm font-medium mb-1">No payouts pending</h3>
            <p className="text-sm text-muted-foreground">
              All cycle payouts have been processed
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Character</th>
                    <th className="text-right p-3 font-medium">Investment</th>
                    <th className="text-right p-3 font-medium">Return</th>
                    <th className="text-right p-3 font-medium">Total Result</th>
                    <th className="text-right p-3 font-medium">Payout</th>
                    <th className="text-left p-3 font-medium">Cycle</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {needsPayout.map((p) => {
                    const investment = parseFloat(p.amountIsk);
                    const paidOutNow = parseFloat(p.payoutAmountIsk ?? "0");
                    const rolledOver = parseFloat(p.rolloverDeductedIsk ?? "0");
                    const totalResult = paidOutNow + rolledOver;
                    const profitShare = totalResult - investment;
                    const returnPct = investment > 0 ? (profitShare / investment) * 100 : 0;
                    const returnAmountStr = profitShare.toFixed(2);
                    const payoutAmountStr = paidOutNow.toFixed(2);
                    const returnLabel =
                      `${profitShare >= 0 ? "+" : ""}${formatIsk(returnAmountStr)} ISK` +
                      ` (${profitShare >= 0 ? "+" : ""}${returnPct.toFixed(1)}%)`;

                    return (
                      <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.characterName}</span>
                            <button
                              onClick={() => onCopy(p.characterName, "character name")}
                              className="text-blue-600 hover:text-blue-700 transition-colors"
                              title="Copy character name"
                            >
                              {copiedText === "character name" ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono text-xs">
                          {formatIsk(p.amountIsk)} ISK
                        </td>
                        <td className="p-3 text-right">
                          <div
                            className={`font-mono text-xs font-semibold ${
                              profitShare >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {returnLabel}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono text-xs">
                          {formatIsk(totalResult.toString())} ISK
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="font-mono text-xs font-semibold text-emerald-600">
                              {formatIsk(payoutAmountStr)} ISK
                            </div>
                            <button
                              onClick={() => onCopy(payoutAmountStr, "payout amount")}
                              className="text-emerald-600 hover:text-emerald-700 transition-colors"
                              title="Copy payout amount"
                            >
                              {copiedText === "payout amount" ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {p.cycleId.substring(0, 8)}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => onMarkPayoutSent(p)}
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                            Mark Payout Sent
                          </Button>
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
  );
}
