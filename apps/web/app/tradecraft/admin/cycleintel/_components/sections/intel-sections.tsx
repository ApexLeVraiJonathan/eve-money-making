import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@eve/ui";
import { ChevronDown } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import { sortByStationName } from "@/app/tradecraft/lib/station-sorting";
import { PotentialTable, ProfitTable, RedTable } from "../tables/intel-tables";
import type { DestinationIntel, IntelBlockData } from "../lib/types";

export function IntelBlock({
  title,
  description,
  profitableLabel,
  potentialLabel,
  redLabel,
  block,
  variant = "destination",
}: {
  title: string;
  description: string;
  profitableLabel: string;
  potentialLabel: string;
  redLabel: string;
  block: IntelBlockData;
  variant?: "global" | "destination";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold">{profitableLabel}</div>
          <ProfitTable rows={block.profitable.rows} totals={block.profitable.totals} />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">{potentialLabel}</div>
          <PotentialTable
            rows={block.potential.rows}
            totals={block.potential.totals}
            variant={variant}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">{redLabel}</div>
          <RedTable rows={block.red.rows} totals={block.red.totals} variant={variant} />
        </div>
      </CardContent>
    </Card>
  );
}

export function DestinationAccordion({
  destinations,
}: {
  destinations: DestinationIntel[];
}) {
  const ordered = React.useMemo(() => {
    return sortByStationName(
      destinations.map((d) => ({
        ...d,
        stationName: d.destinationStationName,
      })),
    );
  }, [destinations]);

  if (ordered.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No destinations yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ordered.map((d) => {
        const profit = Number(d.profitable.totals.profitIsk);
        const expected = Number(d.potential.totals.expectedProfitIsk ?? 0);
        const loss = Number(d.red.totals.lossIsk ?? 0);
        return (
          <Collapsible key={d.destinationStationId} defaultOpen={false}>
            <div className="rounded-lg border overflow-hidden">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="text-left">
                    <div className="font-medium">{d.destinationStationName}</div>
                    <div className="text-xs text-muted-foreground">
                      Station #{d.destinationStationId}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm tabular-nums">
                    <div>
                      <span className="text-muted-foreground">Profit </span>
                      <span className={profit >= 0 ? "text-emerald-500" : "text-red-400"}>
                        {formatIsk(profit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expected </span>
                      <span
                        className={expected >= 0 ? "text-emerald-500" : "text-red-400"}
                      >
                        {formatIsk(expected)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Loss </span>
                      <span className="text-red-400">{formatIsk(loss)}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="p-4">
                  <IntelBlock
                    title={d.destinationStationName}
                    description={`Station #${d.destinationStationId}`}
                    profitableLabel="Completed profitable items (sold out)"
                    potentialLabel="Potential profit (remaining listed above break-even)"
                    redLabel="Red items (negative margin at market)"
                    block={d}
                    variant="destination"
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
