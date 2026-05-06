import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import { DollarSign } from "lucide-react";
import type { MyJingleYieldStatus } from "../lib/types";

type JingleYieldPromotionCardProps = {
  status: MyJingleYieldStatus;
};

export function JingleYieldPromotionCard({ status }: JingleYieldPromotionCardProps) {
  return (
    <Card className="border-emerald-500/40 bg-emerald-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          JingleYield Promotion Active
        </CardTitle>
        <CardDescription className="text-xs">
          You are currently participating in the JingleYield program with a locked
          2B ISK principal provided by Tradecraft. You can withdraw profits above
          2B while the base remains invested.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        <div className="space-y-1">
          <div className="text-muted-foreground">Locked principal (admin-funded)</div>
          <div className="font-semibold">
            {formatIsk(Number(status.lockedPrincipalIsk))}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">Interest earned so far</div>
          <div className="font-semibold">
            {formatIsk(Number(status.cumulativeInterestIsk))} /{" "}
            {formatIsk(Number(status.targetInterestIsk))}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">Cycles completed</div>
          <div className="font-semibold">
            {status.cyclesCompleted} / {status.minCycles}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
