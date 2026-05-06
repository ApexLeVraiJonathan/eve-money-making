import { Activity, CircleHelp } from "lucide-react";
import {
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui";

export function NoActiveCycleState() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Activity className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Cycle Details</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleHelp className="size-6" />
              </EmptyMedia>
              <EmptyTitle>No active cycle</EmptyTitle>
              <EmptyDescription>
                There is currently no active cycle. Check back when a new cycle
                starts.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </div>
  );
}
