import { Button, Card, CardContent, CardHeader, CardTitle } from "@eve/ui";

type CapitalData = {
  cycleId: string;
  asOf: string;
  initialInvestment: string | null;
  capital: {
    total: string;
    cash: string;
    inventory: string;
    percentSplit: { cash: number; inventory: number };
  };
  inventoryBreakdown: Array<{ stationId: number; stationName: string; value: string }>;
};

export function CapitalCard({
  capital,
  onRecompute,
}: {
  capital: CapitalData | null | undefined;
  onRecompute: (cycleId: string) => void;
}) {
  if (!capital) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capital</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>Total: {Number(capital.capital.total).toLocaleString()} ISK</div>
          <div>Cash: {Number(capital.capital.cash).toLocaleString()} ISK</div>
          <div>Inventory: {Number(capital.capital.inventory).toLocaleString()} ISK</div>
          <Button
            variant="secondary"
            onClick={() => onRecompute(capital.cycleId)}
            className="sm:ml-auto"
          >
            Recompute
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          As of {new Date(capital.asOf).toLocaleString()} • Split: Cash{" "}
          {capital.capital.percentSplit.cash}% / Inventory{" "}
          {capital.capital.percentSplit.inventory}% • Initial Investment:{" "}
          {capital.initialInvestment ?? "—"}
        </div>
        <div className="mt-2">
          <div className="font-medium">Inventory by station</div>
          <div className="grid grid-cols-1 gap-1">
            {capital.inventoryBreakdown.map((b) => (
              <div key={b.stationId} className="flex justify-between">
                <span>
                  {b.stationName} (#{b.stationId})
                </span>
                <span>{Number(b.value).toLocaleString()} ISK</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
