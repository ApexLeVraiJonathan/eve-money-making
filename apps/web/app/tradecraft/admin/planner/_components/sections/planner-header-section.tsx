import { AlertCircle, Settings } from "lucide-react";
import { Alert, AlertDescription, Button } from "@eve/ui";
import type { PlannerRestoredDraft } from "../lib/planner-types";

type PlannerHeaderSectionProps = {
  restoredFromDraft: PlannerRestoredDraft | null;
  onClearPlan: () => void;
};

export function PlannerHeaderSection({
  restoredFromDraft,
  onClearPlan,
}: PlannerHeaderSectionProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Settings className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Package Planner</h1>
          <p className="text-sm text-muted-foreground">
            Configure and generate optimized arbitrage packages
          </p>
        </div>
      </div>

      {restoredFromDraft && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Restored your last uncommitted plan
              {restoredFromDraft.restoredAt
                ? ` (saved at ${restoredFromDraft.restoredAt})`
                : ""}
              .
            </span>
            <Button variant="outline" size="sm" onClick={onClearPlan}>
              Clear plan
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
