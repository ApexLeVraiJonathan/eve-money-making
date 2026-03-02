import { Card, CardContent, CardHeader } from "@eve/ui";
import { Percent, Users } from "lucide-react";
import { formatIsk } from "@/lib/utils";

type Program = {
  status: string;
  lockedPrincipalIsk: string;
  cumulativeInterestIsk: string;
};

export function JingleYieldStatsCards({ programs }: { programs: Program[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            Active Programs
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {programs.filter((p) => p.status === "ACTIVE").length}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Currently running JingleYield participants.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <Percent className="h-4 w-4 text-emerald-600" />
            Total Locked Principal
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums text-emerald-600">
            {formatIsk(
              programs
                .filter((p) => p.status === "ACTIVE")
                .reduce((sum, p) => sum + parseFloat(p.lockedPrincipalIsk), 0),
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">ISK locked.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <Percent className="h-4 w-4 text-blue-600" />
            Total Interest Earned
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums text-blue-600">
            {formatIsk(
              programs.reduce((sum, p) => sum + parseFloat(p.cumulativeInterestIsk), 0),
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Across all programs.</p>
        </CardContent>
      </Card>
    </div>
  );
}
