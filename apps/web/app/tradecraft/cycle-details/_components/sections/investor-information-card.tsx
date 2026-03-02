import { Users, Wallet } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import type { CycleDetailsCycle } from "../lib/types";

type Props = {
  cycle: CycleDetailsCycle;
};

export function InvestorInformationCard({ cycle }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Investor Information</CardTitle>
        <CardDescription>Participation summary (anonymized)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Total Investors</p>
              <p className="text-3xl font-semibold tabular-nums mt-1">
                {cycle.participantCount}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Pooled Capital</p>
              <p className="text-3xl font-semibold tabular-nums mt-1">
                {formatIsk(cycle.totalInvestorCapital)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">
              Individual investor amounts are kept private. Only aggregate totals
              are shown.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
