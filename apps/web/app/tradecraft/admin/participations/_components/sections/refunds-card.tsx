import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@eve/ui";
import { Ban } from "lucide-react";
import { formatIsk } from "../lib/formatting";
import type { ParticipationWithCycle } from "../lib/types";

export function RefundsCard({
  needsRefund,
  onRefund,
}: {
  needsRefund: ParticipationWithCycle[];
  onRefund: (p: ParticipationWithCycle) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-red-600" />
          Refunds Needed
        </CardTitle>
        <CardDescription>
          Participations that have been cancelled and need refunds ({needsRefund.length}{" "}
          pending)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {needsRefund.length === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <Ban className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-sm font-medium mb-1">No refunds needed</h3>
            <p className="text-sm text-muted-foreground">
              All cancelled participations have been refunded
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Character</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Cycle</th>
                    <th className="text-left p-3 font-medium">Cancelled</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {needsRefund.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">{p.characterName}</td>
                      <td className="p-3 text-right font-mono text-xs text-red-600 font-semibold">
                        {formatIsk(p.amountIsk)} ISK
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {p.cycleId.substring(0, 8)}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(p.updatedAt).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => onRefund(p)}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Mark Refund Sent
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
