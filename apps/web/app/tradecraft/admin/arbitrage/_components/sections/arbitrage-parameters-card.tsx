import { Button } from "@eve/ui";
import { Input } from "@eve/ui";
import { LabeledInput } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Search, Loader2, Package } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { Checkbox } from "@eve/ui";
import { ParameterProfileManager } from "../../../../components/ParameterProfileManager";

type StationOption = {
  stationId: number;
  station?: { name?: string | null } | null;
};

type ParamsProps = {
  liquidityWindowDays: number;
  setLiquidityWindowDays: (v: number) => void;
  liquidityMinCoverageRatio: number;
  setLiquidityMinCoverageRatio: (v: number) => void;
  liquidityMinLiquidityThresholdISK: number;
  setLiquidityMinLiquidityThresholdISK: (v: number) => void;
  liquidityMinWindowTrades: number;
  setLiquidityMinWindowTrades: (v: number) => void;
  sourceStationId: number | undefined;
  setSourceStationId: (v: number | undefined) => void;
  maxInventoryDays: number;
  setMaxInventoryDays: (v: number) => void;
  minMarginPercent: number;
  setMinMarginPercent: (v: number) => void;
  maxPriceDeviationMultiple: number | undefined;
  setMaxPriceDeviationMultiple: (v: number | undefined) => void;
  minTotalProfitISK: number;
  setMinTotalProfitISK: (v: number) => void;
  salesTaxPercent: number | undefined;
  setSalesTaxPercent: (v: number | undefined) => void;
  brokerFeePercent: number | undefined;
  setBrokerFeePercent: (v: number | undefined) => void;
  disableInventoryLimit: boolean;
  setDisableInventoryLimit: (v: boolean) => void;
  allowInventoryTopOff: boolean;
  setAllowInventoryTopOff: (v: boolean) => void;
  sortedStations: StationOption[];
  onRunCheck: () => void;
  isPending: boolean;
  getCurrentParams: () => Record<string, unknown>;
  handleLoadProfile: (params: Record<string, unknown>) => void;
};

export function ArbitrageParametersCard(props: ParamsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Arbitrage Parameters
            </CardTitle>
            <CardDescription>
              Configure liquidity filters and arbitrage constraints to find
              profitable opportunities
            </CardDescription>
          </div>
          <ParameterProfileManager
            scope="ARBITRAGE"
            currentParams={props.getCurrentParams()}
            onLoadProfile={props.handleLoadProfile}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
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
                value={props.liquidityWindowDays}
                onChange={(e) => props.setLiquidityWindowDays(Number(e.target.value))}
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
                value={props.liquidityMinCoverageRatio}
                onChange={(e) =>
                  props.setLiquidityMinCoverageRatio(Number(e.target.value))
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
                value={props.liquidityMinLiquidityThresholdISK}
                onChange={(e) =>
                  props.setLiquidityMinLiquidityThresholdISK(Number(e.target.value))
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
                value={props.liquidityMinWindowTrades}
                onChange={(e) => props.setLiquidityMinWindowTrades(Number(e.target.value))}
                min="0"
                placeholder="e.g., 5"
              />
            </LabeledInput>
          </div>
        </div>

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
                value={props.sourceStationId?.toString() ?? "default"}
                onValueChange={(value) =>
                  props.setSourceStationId(
                    value === "default" ? undefined : Number(value),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default station" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default station</SelectItem>
                  {props.sortedStations.map((s) => (
                    <SelectItem key={s.stationId} value={s.stationId.toString()}>
                      {s.station?.name ?? s.stationId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledInput>

            <LabeledInput label="Max Inventory Days" tooltip="Maximum days of average daily volume to hold as inventory. Controls position sizing and inventory risk.">
              <Input
                type="number"
                value={props.maxInventoryDays}
                onChange={(e) => props.setMaxInventoryDays(Number(e.target.value))}
                min="0.1"
                max="50"
                step="0.1"
                placeholder="e.g., 3"
              />
            </LabeledInput>

            <LabeledInput label="Minimum Margin %" tooltip="Minimum profit margin percentage after all fees. Higher values ensure more profitable but fewer opportunities.">
              <Input
                type="number"
                value={props.minMarginPercent}
                onChange={(e) => props.setMinMarginPercent(Number(e.target.value))}
                min="0"
                max="1000"
                step="1"
                placeholder="e.g., 10"
              />
            </LabeledInput>

            <LabeledInput label="Max Price Deviation Multiple (optional)" tooltip="Reject opportunities where current price exceeds historical average by this multiple. Helps avoid buying overpriced items. Leave empty to disable.">
              <Input
                type="number"
                value={props.maxPriceDeviationMultiple ?? ""}
                onChange={(e) =>
                  props.setMaxPriceDeviationMultiple(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                min="1"
                step="0.1"
                placeholder="e.g., 3"
              />
            </LabeledInput>

            <LabeledInput label="Minimum Total Profit (ISK)" tooltip="Minimum total profit per opportunity. Filters out small opportunities that may not be worth the effort.">
              <Input
                type="number"
                value={props.minTotalProfitISK}
                onChange={(e) => props.setMinTotalProfitISK(Number(e.target.value))}
                min="0"
                placeholder="e.g., 1000000"
              />
            </LabeledInput>

            <LabeledInput label="Sales Tax % (optional)" tooltip="Override default sales tax percentage. Leave empty to use configured default.">
              <Input
                type="number"
                value={props.salesTaxPercent ?? ""}
                onChange={(e) =>
                  props.setSalesTaxPercent(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                min="0"
                max="100"
                step="0.1"
                placeholder="Default"
              />
            </LabeledInput>

            <LabeledInput label="Broker Fee % (optional)" tooltip="Override default broker fee percentage. Leave empty to use configured default.">
              <Input
                type="number"
                value={props.brokerFeePercent ?? ""}
                onChange={(e) =>
                  props.setBrokerFeePercent(
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

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Inventory Control
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="disableInventoryLimit"
                checked={props.disableInventoryLimit}
                onCheckedChange={(checked) =>
                  props.setDisableInventoryLimit(checked as boolean)
                }
              />
              <div className="space-y-1">
                <label htmlFor="disableInventoryLimit" className="text-sm font-medium leading-none">
                  Disable Inventory Limits
                </label>
                <p className="text-sm text-muted-foreground">
                  Ignore current cycle inventory when calculating opportunities.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="allowInventoryTopOff"
                checked={props.allowInventoryTopOff}
                onCheckedChange={(checked) =>
                  props.setAllowInventoryTopOff(checked as boolean)
                }
                disabled={props.disableInventoryLimit}
              />
              <div className="space-y-1">
                <label htmlFor="allowInventoryTopOff" className="text-sm font-medium leading-none">
                  Allow Inventory Top-Off
                </label>
                <p className="text-sm text-muted-foreground">
                  Allow adding to existing inventory positions up to max inventory days.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={props.onRunCheck}
          disabled={props.isPending}
          className="gap-2 w-full sm:w-auto"
        >
          {props.isPending ? (
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
  );
}
