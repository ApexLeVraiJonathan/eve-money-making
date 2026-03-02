import {
  Button,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui";
import { History, TrendingUp, UserRound } from "lucide-react";

type NoInvestmentsSectionProps = {
  onViewCycles: () => void;
  onViewHistory: () => void;
};

export function NoInvestmentsSection({
  onViewCycles,
  onViewHistory,
}: NoInvestmentsSectionProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Empty className="min-h-64">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound className="size-6" />
            </EmptyMedia>
            <EmptyTitle>Start Your Investment Journey</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t participated in any tradecraft cycles yet. Join the
              next cycle to start earning passive income through our EVE Online
              trading program. Check out our historical performance to see what
              returns you can expect!
            </EmptyDescription>
            <div className="mt-4 flex gap-3">
              <Button onClick={onViewCycles} className="gap-2">
                <TrendingUp className="h-4 w-4" />
                View Available Cycles
              </Button>
              <Button variant="outline" onClick={onViewHistory} className="gap-2">
                <History className="h-4 w-4" />
                View Performance History
              </Button>
            </div>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}
