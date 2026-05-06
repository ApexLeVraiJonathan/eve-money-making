import { Card, CardContent, CardHeader } from "@eve/ui";
import { Ban, DollarSign, Link as LinkIcon, Users } from "lucide-react";

export function ParticipationSummaryStats({
  total,
  awaitingPayment,
  needsRefund,
  needsPayout,
}: {
  total: number;
  awaitingPayment: number;
  needsRefund: number;
  needsPayout: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            Total Participants
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">{total}</div>
          <p className="text-xs text-muted-foreground mt-1">Across all cycles</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <LinkIcon className="h-4 w-4 text-amber-600" />
            Awaiting Payment
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums text-amber-600">
            {awaitingPayment}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Need to be matched</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <Ban className="h-4 w-4 text-red-600" />
            Refunds Needed
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums text-red-600">
            {needsRefund}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cancelled participations
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Payouts Pending
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums text-emerald-600">
            {needsPayout}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Ready to pay out</p>
        </CardContent>
      </Card>
    </div>
  );
}
