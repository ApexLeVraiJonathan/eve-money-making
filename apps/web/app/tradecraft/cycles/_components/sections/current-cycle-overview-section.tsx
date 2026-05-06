import { TrendingUp } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import type { CycleOverview } from "@eve/shared/tradecraft-cycles";
import { formatIsk } from "@/lib/utils";
import { formatTimeLeft } from "../lib/format-time-left";

type CurrentCycleOverviewSectionProps = {
  current: NonNullable<CycleOverview["current"]>;
  onViewDetails: () => void;
};

export function CurrentCycleOverviewSection({
  current,
  onViewDetails,
}: CurrentCycleOverviewSectionProps) {
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-xl">{current.name ?? current.id}</CardTitle>
                <CardDescription className="mt-1.5">
                  Started {new Date(current.startedAt).toLocaleDateString()}
                  {current.endsAt && (
                    <span> • Ends {new Date(current.endsAt).toLocaleDateString()}</span>
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                {current.endsAt && (
                  <Badge className="px-3 py-1.5 text-sm tabular-nums">
                    {formatTimeLeft(current.endsAt)}
                  </Badge>
                )}
                <Badge variant="outline" className="px-3 py-1.5 text-sm">
                  {current.status}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between border-l pl-6">
              <div>
                <p className="text-sm font-medium">Want more details?</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  View charts, capital over time, and in-depth analytics
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onViewDetails}
                className="ml-3"
              >
                View Details
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Starting Capital</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatIsk(current.initialCapitalIsk)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Initial investment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Portfolio Value
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-blue-600">
              {formatIsk(current.capital.total)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Current total value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Current Profit</div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold tabular-nums ${
                current.profit.current < 0 ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {formatIsk(current.profit.current)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Realized from sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Estimated Profit</div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold tabular-nums ${
                current.profit.estimated < 0 ? "text-red-500" : "text-amber-600"
              }`}
            >
              {formatIsk(current.profit.estimated)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              If all sells at current
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
