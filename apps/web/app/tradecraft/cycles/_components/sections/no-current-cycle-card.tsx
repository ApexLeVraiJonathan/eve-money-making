import { CircleHelp } from "lucide-react";
import {
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui";

export function NoCurrentCycleCard() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Empty className="min-h-48">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleHelp className="size-6" />
            </EmptyMedia>
            <EmptyTitle>No current cycle</EmptyTitle>
            <EmptyDescription>
              Please check back another time. A new cycle will appear here when it
              opens.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}
