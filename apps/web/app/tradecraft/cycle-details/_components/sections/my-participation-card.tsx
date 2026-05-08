import { formatIsk } from "@/lib/utils";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import { getCurrentParticipationPayout } from "../lib/cycle-details-data";
import type { CycleDetailsCycle } from "../lib/types";

type Props = {
  cycle: CycleDetailsCycle;
};

export function MyParticipationCard({ cycle }: Props) {
  if (!cycle.myParticipation) return null;

  const investment = Number(cycle.myParticipation.amountIsk);
  const currentPayout = getCurrentParticipationPayout(cycle);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your Participation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Your Investment</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatIsk(Number(cycle.myParticipation.amountIsk))}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Payout</p>
            <p className="text-xl font-semibold tabular-nums">
              {currentPayout !== null
                ? formatIsk(currentPayout)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Return</p>
            <p className="text-xl font-semibold tabular-nums text-emerald-600">
              {currentPayout !== null && investment > 0
                ? `${((currentPayout / investment) * 100).toFixed(2)}%`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className="mt-1" variant="outline">
              {cycle.myParticipation.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
