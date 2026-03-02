import { Activity } from "lucide-react";
import { Badge } from "@eve/ui";
import type { CycleDetailsCycle } from "../lib/types";

type Props = {
  cycle: CycleDetailsCycle;
};

export function CycleDetailsHeader({ cycle }: Props) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Activity className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {cycle.name ?? cycle.id}
          </h1>
          <p className="text-sm text-muted-foreground">
            Started {new Date(cycle.startedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <Badge variant="outline" className="text-base px-3 py-1">
        {cycle.status}
      </Badge>
    </div>
  );
}
