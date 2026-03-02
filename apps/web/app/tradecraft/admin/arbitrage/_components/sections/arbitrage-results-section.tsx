import { Button } from "@eve/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@eve/ui";
import { Navigation, ArrowUp } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import type {
  ArbitrageCheckResponse,
  Opportunity,
} from "@eve/shared/tradecraft-arbitrage";
import { sortDestinationRows } from "../../../../lib/station-sorting";

type DestinationRow = {
  id: string;
  destinationStationId: number;
  stationName?: string | null;
  totalCostISK: number;
  totalProfitISK: number;
  items: Opportunity[];
};

export function ArbitrageResultsSection({
  checkResult,
}: {
  checkResult: ArbitrageCheckResponse | null;
}) {
  if (!checkResult) return null;

  const destinations = sortDestinationRows(
    Object.entries(checkResult).map(([id, dest]) => ({ id, ...dest })),
  ) as DestinationRow[];

  const totalOpportunities = destinations.reduce(
    (sum, dest) => sum + dest.items.length,
    0,
  );

  return (
    <div className="space-y-4">
      {destinations.length > 1 && (
        <div className="sticky top-0 z-50 bg-card border rounded-lg shadow-md p-3 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Navigation className="h-4 w-4" />
                <span>Jump to:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {destinations.map((dest) => (
                  <Button
                    key={dest.id}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const element = document.getElementById(`station-${dest.id}`);
                      if (element) {
                        const navHeight = 80;
                        const elementPosition =
                          element.getBoundingClientRect().top + window.scrollY;
                        const offsetPosition = elementPosition - navHeight;
                        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                      }
                    }}
                  >
                    {dest.stationName?.split(" ")[0] ??
                      `Station ${dest.destinationStationId}`}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="shrink-0"
            >
              <ArrowUp className="h-4 w-4 mr-1" />
              Parameters
            </Button>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold">
        Results: {totalOpportunities} opportunit
        {totalOpportunities !== 1 ? "ies" : "y"} across {destinations.length}{" "}
        destination
        {destinations.length !== 1 ? "s" : ""}
      </h2>

      {destinations.map((dest) => (
        <Card key={dest.id} id={`station-${dest.id}`}>
          <CardHeader>
            <CardTitle>
              {dest.stationName ?? `Station ${dest.destinationStationId}`}
            </CardTitle>
            <CardDescription>
              <div className="space-y-1">
                <div>
                  {dest.items.length} opportunit
                  {dest.items.length !== 1 ? "ies" : "y"}
                </div>
                <div>Total Buy Price: {formatIsk(dest.totalCostISK)}</div>
                <div>Total Profit: {formatIsk(dest.totalProfitISK)}</div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-3 text-left">Item</th>
                    <th className="py-2 px-3 text-right">Quantity</th>
                    <th className="py-2 px-3 text-right">Buy Price</th>
                    <th className="py-2 px-3 text-right">Sell Price</th>
                    <th className="py-2 px-3 text-right">Margin %</th>
                    <th className="py-2 px-3 text-right">Total Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {dest.items.map((opp: Opportunity, idx: number) => (
                    <tr
                      key={idx}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-2 px-3">{opp.name ?? opp.typeId}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {opp.arbitrageQuantity.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {formatIsk(opp.sourcePrice ?? 0)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {formatIsk(opp.destinationPrice ?? 0)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {opp.margin.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {formatIsk(opp.totalProfitISK)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
