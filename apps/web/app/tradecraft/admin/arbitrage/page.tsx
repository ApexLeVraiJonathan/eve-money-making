"use client";
import { useState } from "react";
import { Button } from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import { Input } from "@eve/ui";
import { LabeledInput } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import {
  Search,
  Loader2,
  AlertCircle,
  TrendingUp,
  Package,
  Navigation,
  ArrowUp,
} from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { Checkbox } from "@eve/ui";
import { useArbitrageCheck } from "../../api/market";
import { useTrackedStations } from "../../api/market";
import type {
  ArbitrageCheckRequest,
  ArbitrageCheckResponse,
  Opportunity,
  DestinationGroup,
} from "@eve/shared/types";

export default function ArbitragePage() {
  const arbitrageCheckMutation = useArbitrageCheck();
  const { data: stations } = useTrackedStations();

  // Form state - Liquidity parameters
  const [liquidityWindowDays, setLiquidityWindowDays] = useState<number>(30);
  const [liquidityMinCoverageRatio, setLiquidityMinCoverageRatio] =
    useState<number>(0.7);
  const [
    liquidityMinLiquidityThresholdISK,
    setLiquidityMinLiquidityThresholdISK,
  ] = useState<number>(50000000);
  const [liquidityMinWindowTrades, setLiquidityMinWindowTrades] =
    useState<number>(5);

  // Form state - Arbitrage parameters
  const [sourceStationId, setSourceStationId] = useState<number | undefined>(
    undefined,
  );
  const [maxInventoryDays, setMaxInventoryDays] = useState<number>(3);
  const [minMarginPercent, setMinMarginPercent] = useState<number>(10);
  const [maxPriceDeviationMultiple, setMaxPriceDeviationMultiple] = useState<
    number | undefined
  >(undefined);
  const [minTotalProfitISK, setMinTotalProfitISK] = useState<number>(1000000);
  const [salesTaxPercent, setSalesTaxPercent] = useState<number | undefined>(
    undefined,
  );
  const [brokerFeePercent, setBrokerFeePercent] = useState<number | undefined>(
    undefined,
  );

  // Inventory control
  const [disableInventoryLimit, setDisableInventoryLimit] =
    useState<boolean>(false);
  const [allowInventoryTopOff, setAllowInventoryTopOff] =
    useState<boolean>(false);

  // Results
  const [checkResult, setCheckResult] = useState<ArbitrageCheckResponse | null>(
    null,
  );
  const [error, setError] = useState<string>("");

  const onRunCheck = async () => {
    setError("");
    setCheckResult(null);

    const payload: ArbitrageCheckRequest = {
      // Liquidity options
      liquidityWindowDays: liquidityWindowDays || undefined,
      liquidityMinCoverageRatio: liquidityMinCoverageRatio || undefined,
      liquidityMinLiquidityThresholdISK:
        liquidityMinLiquidityThresholdISK || undefined,
      liquidityMinWindowTrades: liquidityMinWindowTrades || undefined,
      // Arbitrage options
      sourceStationId: sourceStationId || undefined,
      maxInventoryDays: maxInventoryDays || undefined,
      minMarginPercent: minMarginPercent || undefined,
      maxPriceDeviationMultiple: maxPriceDeviationMultiple || undefined,
      minTotalProfitISK: minTotalProfitISK || undefined,
      salesTaxPercent: salesTaxPercent || undefined,
      brokerFeePercent: brokerFeePercent || undefined,
      disableInventoryLimit: disableInventoryLimit || undefined,
      allowInventoryTopOff: allowInventoryTopOff || undefined,
    };

    try {
      const res = await arbitrageCheckMutation.mutateAsync(payload);
      setCheckResult(res);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
    }
  };

  // Sort stations for dropdown
  const stationOrder = ["Dodixie", "Hek", "Rens", "Amarr"];
  const sortedStations = stations
    ? [...stations].sort((a, b) => {
        const aName = a.station?.name ?? "";
        const bName = b.station?.name ?? "";
        const aIndex = stationOrder.findIndex((station) =>
          aName.includes(station),
        );
        const bIndex = stationOrder.findIndex((station) =>
          bName.includes(station),
        );
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return aName.localeCompare(bName);
      })
    : [];

  const renderResults = () => {
    if (!checkResult) return null;

    // Sort destinations in specific order: Dodixie -> Hek -> Rens -> Amarr -> Others
    const stationOrder = ["Dodixie", "Hek", "Rens", "Amarr"];
    const destinations = Object.entries(checkResult)
      .map(([id, dest]) => ({ id, ...dest }))
      .sort((a, b) => {
        const aName = a.stationName ?? "";
        const bName = b.stationName ?? "";

        const aIndex = stationOrder.findIndex((station) =>
          aName.includes(station),
        );
        const bIndex = stationOrder.findIndex((station) =>
          bName.includes(station),
        );

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return aName.localeCompare(bName);
      });

    const totalOpportunities = destinations.reduce(
      (sum, dest) => sum + dest.items.length,
      0,
    );

    return (
      <div className="space-y-4">
        {/* Sticky navigation bar */}
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
                        const element = document.getElementById(
                          `station-${dest.id}`,
                        );
                        if (element) {
                          const navHeight = 80;
                          const elementPosition =
                            element.getBoundingClientRect().top +
                            window.scrollY;
                          const offsetPosition = elementPosition - navHeight;

                          window.scrollTo({
                            top: offsetPosition,
                            behavior: "smooth",
                          });
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
                onClick={() => {
                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }}
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
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Arbitrage Check</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Arbitrage Parameters
          </CardTitle>
          <CardDescription>
            Configure liquidity filters and arbitrage constraints to find
            profitable opportunities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Liquidity Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Liquidity Filters
            </h3>
            <div className="grid gap-4">
              <LabeledInput
                label="Time Window (days)"
                tooltip="Number of days to analyze for liquidity calculation. Longer windows provide more stable averages but may miss recent market changes."
              >
                <Input
                  type="number"
                  value={liquidityWindowDays}
                  onChange={(e) =>
                    setLiquidityWindowDays(Number(e.target.value))
                  }
                  min="1"
                  placeholder="e.g., 30"
                />
              </LabeledInput>

              <LabeledInput
                label="Minimum Coverage Ratio"
                tooltip="Fraction of days in the window that must have trades (0-1). Higher values ensure more consistent trading activity."
              >
                <Input
                  type="number"
                  value={liquidityMinCoverageRatio}
                  onChange={(e) =>
                    setLiquidityMinCoverageRatio(Number(e.target.value))
                  }
                  min="0"
                  max="1"
                  step="0.1"
                  placeholder="e.g., 0.7"
                />
              </LabeledInput>

              <LabeledInput
                label="Minimum Daily ISK Volume"
                tooltip="Minimum average daily ISK value traded. Filters out low-volume items that may be difficult to sell."
              >
                <Input
                  type="number"
                  value={liquidityMinLiquidityThresholdISK}
                  onChange={(e) =>
                    setLiquidityMinLiquidityThresholdISK(Number(e.target.value))
                  }
                  min="0"
                  placeholder="e.g., 50000000"
                />
              </LabeledInput>

              <LabeledInput
                label="Minimum Daily Trades"
                tooltip="Minimum average number of trades per day. Ensures items have active market participation."
              >
                <Input
                  type="number"
                  value={liquidityMinWindowTrades}
                  onChange={(e) =>
                    setLiquidityMinWindowTrades(Number(e.target.value))
                  }
                  min="0"
                  placeholder="e.g., 5"
                />
              </LabeledInput>
            </div>
          </div>

          {/* Arbitrage Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Arbitrage Constraints
            </h3>
            <div className="grid gap-4">
              <LabeledInput
                label="Source Station"
                tooltip="Station to buy items from. Defaults to the configured primary arbitrage station if not specified."
              >
                <Select
                  value={sourceStationId?.toString() ?? "default"}
                  onValueChange={(value) =>
                    setSourceStationId(
                      value === "default" ? undefined : Number(value),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Default station" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default station</SelectItem>
                    {sortedStations.map((s) => (
                      <SelectItem
                        key={s.stationId}
                        value={s.stationId.toString()}
                      >
                        {s.station?.name ?? s.stationId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledInput>

              <LabeledInput
                label="Max Inventory Days"
                tooltip="Maximum days of average daily volume to hold as inventory. Controls position sizing and inventory risk."
              >
                <Input
                  type="number"
                  value={maxInventoryDays}
                  onChange={(e) => setMaxInventoryDays(Number(e.target.value))}
                  min="0.1"
                  max="50"
                  step="0.1"
                  placeholder="e.g., 3"
                />
              </LabeledInput>

              <LabeledInput
                label="Minimum Margin %"
                tooltip="Minimum profit margin percentage after all fees. Higher values ensure more profitable but fewer opportunities."
              >
                <Input
                  type="number"
                  value={minMarginPercent}
                  onChange={(e) => setMinMarginPercent(Number(e.target.value))}
                  min="0"
                  max="1000"
                  step="1"
                  placeholder="e.g., 10"
                />
              </LabeledInput>

              <LabeledInput
                label="Max Price Deviation Multiple (optional)"
                tooltip="Reject opportunities where current price exceeds historical average by this multiple. Helps avoid buying overpriced items. Leave empty to disable."
              >
                <Input
                  type="number"
                  value={maxPriceDeviationMultiple ?? ""}
                  onChange={(e) =>
                    setMaxPriceDeviationMultiple(
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                  min="1"
                  step="0.1"
                  placeholder="e.g., 3"
                />
              </LabeledInput>

              <LabeledInput
                label="Minimum Total Profit (ISK)"
                tooltip="Minimum total profit per opportunity. Filters out small opportunities that may not be worth the effort."
              >
                <Input
                  type="number"
                  value={minTotalProfitISK}
                  onChange={(e) => setMinTotalProfitISK(Number(e.target.value))}
                  min="0"
                  placeholder="e.g., 1000000"
                />
              </LabeledInput>

              <LabeledInput
                label="Sales Tax % (optional)"
                tooltip="Override default sales tax percentage. Leave empty to use configured default."
              >
                <Input
                  type="number"
                  value={salesTaxPercent ?? ""}
                  onChange={(e) =>
                    setSalesTaxPercent(
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="Default"
                />
              </LabeledInput>

              <LabeledInput
                label="Broker Fee % (optional)"
                tooltip="Override default broker fee percentage. Leave empty to use configured default."
              >
                <Input
                  type="number"
                  value={brokerFeePercent ?? ""}
                  onChange={(e) =>
                    setBrokerFeePercent(
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="Default"
                />
              </LabeledInput>
            </div>
          </div>

          {/* Inventory Control Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Inventory Control
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="disableInventoryLimit"
                  checked={disableInventoryLimit}
                  onCheckedChange={(checked) =>
                    setDisableInventoryLimit(checked as boolean)
                  }
                />
                <div className="space-y-1">
                  <label
                    htmlFor="disableInventoryLimit"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Disable Inventory Limits
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Ignore current cycle inventory when calculating
                    opportunities. Useful for market analysis without being
                    constrained by existing positions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="allowInventoryTopOff"
                  checked={allowInventoryTopOff}
                  onCheckedChange={(checked) =>
                    setAllowInventoryTopOff(checked as boolean)
                  }
                  disabled={disableInventoryLimit}
                />
                <div className="space-y-1">
                  <label
                    htmlFor="allowInventoryTopOff"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Allow Inventory Top-Off
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Allow adding to existing inventory positions up to max
                    inventory days, instead of skipping items with any stock.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={onRunCheck}
            disabled={arbitrageCheckMutation.isPending}
            className="gap-2 w-full sm:w-auto"
          >
            {arbitrageCheckMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Run Arbitrage Check
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {renderResults()}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
