import { TrendingUp } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@eve/ui";
import type { CycleDetailsCycle } from "../lib/types";

type Props = {
  cycle: CycleDetailsCycle;
};

export function CycleMetricsGrid({ cycle }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium">Starting Capital</div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {formatIsk(cycle.initialCapitalIsk)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Initial investment</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Portfolio Value
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums text-blue-600">
            {formatIsk(cycle.capital.total)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Current total value</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium">Current Profit</div>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-semibold tabular-nums ${
              cycle.profit.current < 0 ? "text-red-500" : "text-emerald-600"
            }`}
          >
            {formatIsk(cycle.profit.current)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {cycle.initialCapitalIsk > 0
              ? `${((cycle.profit.current / cycle.initialCapitalIsk) * 100).toFixed(1)}% ROI`
              : "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium">Estimated Profit</div>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-semibold tabular-nums ${
              cycle.profit.estimated < 0 ? "text-red-500" : "text-amber-600"
            }`}
          >
            {formatIsk(cycle.profit.estimated)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            If all sells at current
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
