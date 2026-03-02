import { Badge } from "@eve/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { DollarSign, Package, Truck } from "lucide-react";
import { formatIsk, type SkillFarmDerived, type SkillFarmStatement } from "../lib/math";

type CalculatedResultsCardProps = {
  derived: SkillFarmDerived;
  statement: SkillFarmStatement;
  soldViaContracts: boolean;
};

export function CalculatedResultsCard({
  derived,
  statement,
  soldViaContracts,
}: CalculatedResultsCardProps) {
  return (
    <Card className="bg-gradient-to-b from-background to-muted/5 lg:sticky lg:top-4">
      <CardHeader className="gap-2">
        <CardTitle className="text-base">Calculated results</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statement.netProfit >= 0 ? "secondary" : "outline"}>
            {statement.netProfit >= 0 ? "Profitable" : "Not profitable"}
          </Badge>
          <div className="text-sm text-foreground/80">
            Farm totals / per injector window ({statement.units.toLocaleString()} injector
            {statement.units === 1 ? "" : "s"})
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-md border bg-background/40 p-3">
          <div className="text-xs text-foreground/80">Net profit</div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {formatIsk(statement.netProfit)}
          </div>
          <div className="mt-1 text-xs text-foreground/70">
            Net sales {formatIsk(statement.netSales)} − total costs{" "}
            {formatIsk(statement.cogs + statement.totalExpenses)}
          </div>
          <div className="mt-2 text-xs text-foreground/70">
            Derived:{" "}
            {statement.derivedPer30d !== null
              ? `${formatIsk(statement.derivedPer30d)} / 30d (farm)`
              : "set SP/min to compute / 30d"}
          </div>
        </div>

        <div className="rounded-md border bg-background/40 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
            <DollarSign className="h-4 w-4" />
            Income Statement (farm totals)
          </div>

          <div className="mt-4 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/80">
                <DollarSign className="h-4 w-4" />
                Revenue
              </div>
              <div className="ml-6 space-y-1">
                <div className="flex justify-between gap-8 text-sm">
                  <span>
                    Gross Sales ({statement.units.toLocaleString()} injector
                    {statement.units === 1 ? "" : "s"})
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatIsk(statement.grossSales)}
                  </span>
                </div>
                <div className="flex justify-between gap-8 text-sm">
                  <span>Sales Tax ({(derived.salesTaxPct * 100).toFixed(2)}%)</span>
                  <span
                    className={`tabular-nums font-medium ${soldViaContracts ? "text-foreground/50" : "text-red-400"}`}
                  >
                    -{formatIsk(statement.salesTax)}
                  </span>
                </div>
                <div className="flex justify-between gap-8 text-sm">
                  <span>Broker Fee ({(derived.brokerPct * 100).toFixed(2)}%)</span>
                  <span
                    className={`tabular-nums font-medium ${soldViaContracts ? "text-foreground/50" : "text-red-400"}`}
                  >
                    -{formatIsk(statement.brokerFee)}
                  </span>
                </div>
                <div className="flex justify-between gap-8 border-t pt-2">
                  <span className="font-semibold">Net Sales Revenue</span>
                  <span className="tabular-nums font-bold">
                    {formatIsk(statement.netSales)}
                  </span>
                </div>
                {soldViaContracts && (
                  <p className="pt-1 text-xs text-foreground/60">
                    Sold via contracts: market fees skipped.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/80">
                <Package className="h-4 w-4" />
                Cost of Goods Sold
              </div>
              <div className="ml-6 space-y-1">
                <div className="flex justify-between gap-8 text-sm">
                  <span>
                    {statement.units.toLocaleString()} extractor
                    {statement.units === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs opacity-70">
                    Avg: {formatIsk(derived.extractorPrice)}/unit
                  </span>
                </div>
                <div className="flex justify-between gap-8 border-t pt-2">
                  <span className="font-semibold">Total COGS</span>
                  <span className="tabular-nums font-bold text-red-400">
                    -{formatIsk(statement.cogs)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/80">
                <Truck className="h-4 w-4" />
                Operating Expenses
              </div>
              <div className="ml-6 space-y-1">
                <div className="flex justify-between gap-8 text-sm">
                  <span>Boosters (180 PLEX / 26.4d, prorated)</span>
                  <span className="tabular-nums font-medium text-red-400">
                    -{formatIsk(statement.boosters)}
                  </span>
                </div>
                <div className="flex justify-between gap-8 text-sm">
                  <span>Subscription (Omega + MCT, prorated)</span>
                  <span className="tabular-nums font-medium text-red-400">
                    -{formatIsk(statement.subscription)}
                  </span>
                </div>
                <div className="flex justify-between gap-8 border-t pt-2">
                  <span className="font-semibold">Total Expenses</span>
                  <span className="tabular-nums font-bold text-red-400">
                    -{formatIsk(statement.totalExpenses)}
                  </span>
                </div>
              </div>
            </div>

            <div className="-mx-3 rounded-md border-t-2 bg-primary/10 px-3 py-3">
              <div className="flex items-center justify-between gap-8">
                <div>
                  <span className="font-bold">Net Profit</span>
                  <p className="mt-1 text-xs text-foreground/70">
                    = Net Sales − COGS − Operating Expenses
                  </p>
                </div>
                <span
                  className={`tabular-nums text-lg font-bold ${
                    statement.netProfit >= 0 ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {formatIsk(statement.netProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-background/40 p-3">
          <div className="text-sm font-medium text-foreground">Farm totals (profitability)</div>
          <div className="mt-2 grid gap-1 text-foreground/80">
            <div className="flex items-center justify-between gap-3">
              <span>Profit / hour</span>
              <span className="font-medium text-foreground">
                {derived.daysPerInjector > 0
                  ? `${Math.round(statement.netProfit / (derived.daysPerInjector * 24)).toLocaleString()} ISK/h`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Profit / 30 days</span>
              <span className="font-medium text-foreground">
                {statement.derivedPer30d !== null ? formatIsk(statement.derivedPer30d) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Profit / year</span>
              <span className="font-medium text-foreground">
                {statement.derivedPer30d !== null ? formatIsk(statement.derivedPer30d * 12) : "—"}
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-foreground/70">
            Based on the Income Statement totals (farm-wide) and your time per injector.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
