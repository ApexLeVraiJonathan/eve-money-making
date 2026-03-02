import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@eve/ui";
import type { AutoRolloverSettings } from "@eve/shared/tradecraft-participations";
import type { CycleOverview } from "@eve/shared/tradecraft-cycles";
import { AutoRolloverDialog } from "../../auto-rollover-dialog";
import { getAutoRolloverLabel } from "../lib/get-auto-rollover-label";
import NextCycleSection from "../../next-cycle-section";

type NextCycleCardProps = {
  isLoading: boolean;
  next: CycleOverview["next"] | undefined;
  autoSettings: AutoRolloverSettings | null | undefined;
  settingsQueryEnabled: boolean;
};

export function NextCycleCard({
  isLoading,
  next,
  autoSettings,
  settingsQueryEnabled,
}: NextCycleCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Next Cycle</CardTitle>
            <CardDescription>
              Opt-in to participate in upcoming trading opportunities
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Auto rollover: {getAutoRolloverLabel(autoSettings)}
            </Badge>
            <AutoRolloverDialog
              queryEnabled={settingsQueryEnabled}
              trigger={
                <Button variant="outline" size="sm">
                  Automatic rollover
                </Button>
              }
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <NextCycleSection next={next ?? null} />
        )}
      </CardContent>
    </Card>
  );
}
