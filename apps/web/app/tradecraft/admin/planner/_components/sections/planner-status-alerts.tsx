import Link from "next/link";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, Button } from "@eve/ui";
import type { PlannerCommitSuccess } from "../lib/planner-types";

type PlannerStatusAlertsProps = {
  error: string | null;
  commitSuccess: PlannerCommitSuccess | null;
};

export function PlannerStatusAlerts({
  error,
  commitSuccess,
}: PlannerStatusAlertsProps) {
  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {commitSuccess && (
        <Alert className="border-emerald-500/20 bg-emerald-500/10">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Plan committed successfully! {commitSuccess.packageCount} packages created
              for cycle {commitSuccess.cycleId.slice(0, 8)}...
            </span>
            <Link href={`/tradecraft/admin/packages?cycleId=${commitSuccess.cycleId}`}>
              <Button variant="outline" size="sm" className="ml-4">
                View Packages →
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
