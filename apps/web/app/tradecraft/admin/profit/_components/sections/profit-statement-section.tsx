import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import {
  DollarSign,
  Package,
  Percent,
  TrendingUp,
  Truck,
} from "lucide-react";
import { formatIsk } from "@/lib/utils";
import type { CycleProfitBreakdown } from "@eve/shared/tradecraft-cycles";

export function ProfitStatementSection({
  breakdown,
  cycleId,
}: {
  breakdown: CycleProfitBreakdown;
  cycleId: string;
}) {
  const netProfitNum = Number(breakdown.netProfit);
  const isProfit = netProfitNum >= 0;

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Profit & Loss Statement
          </h1>
          <p className="text-sm text-muted-foreground">
            Detailed breakdown for cycle {cycleId.slice(0, 8)}...
          </p>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wide">
            Net Profit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline justify-between gap-8 max-w-2xl">
            <div
              className={`text-4xl font-bold ${isProfit ? "text-emerald-500" : "text-red-500"}`}
            >
              {formatIsk(netProfitNum)}
            </div>
            <div className="text-right whitespace-nowrap">
              <div
                className={`text-2xl font-semibold ${isProfit ? "text-emerald-500" : "text-red-500"}`}
              >
                {breakdown.roi.percentage}%
              </div>
              <div className="text-xs opacity-70">ROI</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Income Statement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <DollarSign className="h-4 w-4" />
              Revenue
            </div>
            <div className="ml-6 space-y-1 max-w-2xl">
              <div className="flex justify-between gap-8 text-sm">
                <span>Gross Sales</span>
                <span className="tabular-nums font-medium">
                  {formatIsk(Number(breakdown.revenue.grossSales))}
                </span>
              </div>
              <div className="flex justify-between gap-8 text-sm">
                <span>Sales Tax (3.37%)</span>
                <span className="tabular-nums font-medium text-red-400">
                  -{formatIsk(Number(breakdown.revenue.salesTax))}
                </span>
              </div>
              <div className="flex justify-between gap-8 pt-2 border-t">
                <span className="font-semibold">Net Sales Revenue</span>
                <span className="tabular-nums font-bold">
                  {formatIsk(Number(breakdown.revenue.netSales))}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <Package className="h-4 w-4" />
              Cost of Goods Sold
            </div>
            <div className="ml-6 space-y-1 max-w-2xl">
              <div className="flex justify-between gap-8 text-sm">
                <span>{breakdown.cogs.unitsSold.toLocaleString()} units sold</span>
                <span className="text-xs opacity-70">
                  Avg: {formatIsk(Number(breakdown.cogs.avgCostPerUnit))}/unit
                </span>
              </div>
              <div className="flex justify-between gap-8 pt-2 border-t">
                <span className="font-semibold">Total COGS</span>
                <span className="tabular-nums font-bold text-red-400">
                  -{formatIsk(Number(breakdown.cogs.totalCogs))}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 -mx-6 px-6 py-3">
            <div className="flex justify-between gap-8 items-center max-w-2xl">
              <span className="font-semibold text-lg">Gross Profit</span>
              <span
                className={`tabular-nums font-bold text-xl ${
                  Number(breakdown.grossProfit) >= 0 ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {formatIsk(Number(breakdown.grossProfit))}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              = Net Sales - Cost of Goods Sold
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <Truck className="h-4 w-4" />
              Operating Expenses
            </div>
            <div className="ml-6 space-y-1 max-w-2xl">
              <div className="flex justify-between gap-8 text-sm">
                <span>Transport Fees</span>
                <span className="tabular-nums font-medium text-red-400">
                  -{formatIsk(Number(breakdown.expenses.transportFees))}
                </span>
              </div>
              <div className="flex justify-between gap-8 text-sm">
                <span>Broker Fees (1.5%)</span>
                <span className="tabular-nums font-medium text-red-400">
                  -{formatIsk(Number(breakdown.expenses.brokerFees))}
                </span>
              </div>
              <div className="flex justify-between gap-8 text-sm">
                <span>Relist Fees (0.3%)</span>
                <span className="tabular-nums font-medium text-red-400">
                  -{formatIsk(Number(breakdown.expenses.relistFees))}
                </span>
              </div>
              {Number(breakdown.expenses.collateralRecovery) < 0 && (
                <div className="flex justify-between gap-8 text-sm">
                  <span>Collateral Recovery</span>
                  <span className="tabular-nums font-medium text-emerald-500">
                    +{formatIsk(Math.abs(Number(breakdown.expenses.collateralRecovery)))}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-8 pt-2 border-t">
                <span className="font-semibold">Total Expenses</span>
                <span className="tabular-nums font-bold text-red-400">
                  -{formatIsk(Number(breakdown.expenses.totalExpenses))}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-primary/10 -mx-6 px-6 py-4 border-t-2">
            <div className="flex justify-between gap-8 items-center max-w-2xl">
              <div>
                <span className="font-bold text-xl">Net Profit</span>
                <p className="text-xs text-muted-foreground mt-1">
                  = Gross Profit - Operating Expenses
                </p>
              </div>
              <span
                className={`tabular-nums font-bold text-3xl ${isProfit ? "text-emerald-500" : "text-red-500"}`}
              >
                {formatIsk(netProfitNum)}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <Percent className="h-4 w-4" />
              Return on Investment
            </div>
            <div className="ml-6 space-y-1 max-w-2xl">
              <div className="flex justify-between gap-8 text-sm">
                <span>Initial Capital</span>
                <span className="tabular-nums font-medium">
                  {formatIsk(Number(breakdown.roi.initialCapital))}
                </span>
              </div>
              <div className="flex justify-between gap-8 text-sm">
                <span>Net Profit</span>
                <span
                  className={`tabular-nums font-medium ${isProfit ? "text-emerald-500" : "text-red-500"}`}
                >
                  {formatIsk(netProfitNum)}
                </span>
              </div>
              <div className="flex justify-between gap-8 pt-2 border-t">
                <span className="font-semibold">ROI Percentage</span>
                <span
                  className={`tabular-nums font-bold text-lg ${isProfit ? "text-emerald-500" : "text-red-500"}`}
                >
                  {breakdown.roi.percentage}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-sm opacity-80">
            <strong className="opacity-100">How to read this P&L:</strong> Start
            with Gross Sales Revenue, subtract Sales Tax to get Net Sales. Then
            subtract the Cost of Goods Sold (what you paid for items that were sold)
            to get Gross Profit. Finally, subtract all Operating Expenses (transport,
            broker, relist fees) to arrive at your Net Profit. The ROI shows your
            return as a percentage of your initial investment.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
