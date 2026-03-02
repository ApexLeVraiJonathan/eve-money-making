import * as React from "react";
import { Button } from "@eve/ui";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@eve/ui";
import {
  DEFAULT_STRATEGY_PARAMS,
  deepMerge,
  formatIskMaybe,
  formatNumberLike,
  formatPercentFromShare,
  isPlainObject,
  type AnyRecord,
} from "../lib/strategy-params";

export function StrategyParamsDialog(props: {
  strategyName: string;
  params: unknown;
}) {
  const effective = React.useMemo(() => {
    const raw = isPlainObject(props.params) ? props.params : {};
    return deepMerge(DEFAULT_STRATEGY_PARAMS, raw) as AnyRecord;
  }, [props.params]);

  const liquidity = (effective.liquidityOptions as AnyRecord) ?? {};
  const arbitrage = (effective.arbitrageOptions as AnyRecord) ?? {};
  const allocation = (effective.allocation as AnyRecord) ?? {};
  const shippingCostByStation =
    (effective.shippingCostByStation as Record<string, unknown>) ?? {};

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(effective, null, 2) + "\n",
      );
    } catch {
      // Ignore clipboard permission failures in unsupported environments.
    }
  };

  const Row = (row: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-6 py-1">
      <div className="text-sm text-muted-foreground">{row.label}</div>
      <div className="text-sm tabular-nums text-right">{row.value}</div>
    </div>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          View params
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{props.strategyName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Planner (Packaging & Allocation)
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <Row
                label="Package Capacity (m³)"
                value={formatNumberLike(effective.packageCapacityM3)}
              />
              <Row
                label="Total Investment (ISK)"
                value={formatIskMaybe(effective.investmentISK)}
              />
              <Row
                label="Max Packages"
                value={formatNumberLike(effective.maxPackagesHint)}
              />
              <Row
                label="Per-Item Budget Share (%)"
                value={formatPercentFromShare(
                  effective.perDestinationMaxBudgetSharePerItem,
                )}
              />
              <Row
                label="Max Package Collateral (ISK)"
                value={formatIskMaybe(effective.maxPackageCollateralISK)}
              />
              <Row label="Allocation Mode" value={formatNumberLike(allocation.mode)} />
              <Row
                label="Spread Bias"
                value={formatNumberLike(allocation.spreadBias)}
              />
              <Row
                label="Min Package Net Profit (ISK)"
                value={formatIskMaybe(effective.minPackageNetProfitISK)}
              />
              <Row
                label="Min Package ROI %"
                value={formatNumberLike(effective.minPackageROIPercent)}
              />
              <Row
                label="Shipping Margin Multiplier"
                value={formatNumberLike(effective.shippingMarginMultiplier)}
              />
              <Row
                label="Density Weight"
                value={formatNumberLike(effective.densityWeight)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Liquidity Filters
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <Row
                label="Time Window (days)"
                value={formatNumberLike(liquidity.windowDays)}
              />
              <Row
                label="Min Coverage Ratio"
                value={formatNumberLike(liquidity.minCoverageRatio)}
              />
              <Row
                label="Min Daily ISK Volume"
                value={formatIskMaybe(liquidity.minLiquidityThresholdISK)}
              />
              <Row
                label="Min Daily Trades"
                value={formatNumberLike(liquidity.minWindowTrades)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Arbitrage Constraints
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <Row
                label="Max Inventory Days"
                value={formatNumberLike(arbitrage.maxInventoryDays)}
              />
              <Row
                label="Min Margin %"
                value={formatNumberLike(arbitrage.minMarginPercent)}
              />
              <Row
                label="Max Price Deviation Multiple"
                value={formatNumberLike(arbitrage.maxPriceDeviationMultiple)}
              />
              <Row
                label="Min Total Profit (ISK)"
                value={formatIskMaybe(arbitrage.minTotalProfitISK)}
              />
              <Row
                label="Disable Inventory Limits"
                value={formatNumberLike(arbitrage.disableInventoryLimit)}
              />
              <Row
                label="Allow Inventory Top-Off"
                value={formatNumberLike(arbitrage.allowInventoryTopOff)}
              />
              <Row
                label="Destination Station IDs"
                value={formatNumberLike(arbitrage.destinationStationIds)}
              />
              <Row
                label="Exclude Destination Station IDs"
                value={formatNumberLike(arbitrage.excludeDestinationStationIds)}
              />
              <Row
                label="Sales Tax %"
                value={formatNumberLike(arbitrage.salesTaxPercent)}
              />
              <Row
                label="Broker Fee %"
                value={formatNumberLike(arbitrage.brokerFeePercent)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Shipping Cost (by Station ID)
            </div>
            <div className="rounded-md border p-3">
              {Object.keys(shippingCostByStation).length ? (
                <div className="space-y-1">
                  {Object.entries(shippingCostByStation)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([stationId, cost]) => (
                      <div
                        key={stationId}
                        className="flex items-start justify-between gap-6 py-1"
                      >
                        <div className="text-sm text-muted-foreground">
                          {stationId}
                        </div>
                        <div className="text-sm tabular-nums text-right">
                          {formatIskMaybe(cost)}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={copyJson}>
            Copy JSON
          </Button>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
