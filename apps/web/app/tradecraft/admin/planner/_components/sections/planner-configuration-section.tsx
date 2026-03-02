import { ChevronDown, Package, Settings } from "lucide-react";
import { Checkbox } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  LabeledInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@eve/ui";
import { ParameterProfileManager } from "../../../../components/ParameterProfileManager";
import type { AllocationMode, CourierMode } from "../lib/planner-types";

type PlannerConfigurationSectionProps = {
  json: string;
  onJsonChange: (value: string) => void;
  getCurrentParams: () => Record<string, unknown>;
  onLoadProfile: (params: Record<string, unknown>) => void;
  courierMode: CourierMode;
  setCourierMode: (value: CourierMode) => void;
  capacityDisplay: string;
  onCapacityChange: (value: string) => void;
  onCapacityBlur: () => void;
  investmentDisplay: string;
  onInvestmentChange: (value: string) => void;
  onInvestmentBlur: () => void;
  maxPackagesDisplay: string;
  onMaxPackagesChange: (value: string) => void;
  shareDisplay: string;
  onShareChange: (value: string) => void;
  collateralDisplay: string;
  onCollateralChange: (value: string) => void;
  onCollateralBlur: () => void;
  autoBlockadeMaxVolumeM3: number;
  setAutoBlockadeMaxVolumeM3: (value: number) => void;
  autoBlockadeMaxCollateralISK: number;
  setAutoBlockadeMaxCollateralISK: (value: number) => void;
  autoDstMaxVolumeM3: number;
  setAutoDstMaxVolumeM3: (value: number) => void;
  autoDstMaxCollateralISK: number;
  setAutoDstMaxCollateralISK: (value: number) => void;
  showAdvancedOptions: boolean;
  setShowAdvancedOptions: (value: boolean) => void;
  liquidityWindowDays: number | undefined;
  setLiquidityWindowDays: (value: number | undefined) => void;
  liquidityMinCoverageRatio: number | undefined;
  setLiquidityMinCoverageRatio: (value: number | undefined) => void;
  liquidityMinLiquidityThresholdISK: number | undefined;
  setLiquidityMinLiquidityThresholdISK: (value: number | undefined) => void;
  liquidityMinWindowTrades: number | undefined;
  setLiquidityMinWindowTrades: (value: number | undefined) => void;
  arbMaxInventoryDays: number | undefined;
  setArbMaxInventoryDays: (value: number | undefined) => void;
  arbMinMarginPercent: number | undefined;
  setArbMinMarginPercent: (value: number | undefined) => void;
  arbMaxPriceDeviationMultiple: number | undefined;
  setArbMaxPriceDeviationMultiple: (value: number | undefined) => void;
  arbMinTotalProfitISK: number | undefined;
  setArbMinTotalProfitISK: (value: number | undefined) => void;
  arbDisableInventoryLimit: boolean;
  setArbDisableInventoryLimit: (value: boolean) => void;
  arbAllowInventoryTopOff: boolean;
  setArbAllowInventoryTopOff: (value: boolean) => void;
  allocationMode: AllocationMode;
  setAllocationMode: (value: AllocationMode) => void;
  spreadBias: number | undefined;
  setSpreadBias: (value: number | undefined) => void;
  minPackageNetProfitISK: number | undefined;
  setMinPackageNetProfitISK: (value: number | undefined) => void;
  minPackageROIPercent: number | undefined;
  setMinPackageROIPercent: (value: number | undefined) => void;
  shippingMarginMultiplier: number | undefined;
  setShippingMarginMultiplier: (value: number | undefined) => void;
  densityWeight: number | undefined;
  setDensityWeight: (value: number | undefined) => void;
};

export function PlannerConfigurationSection({
  json,
  onJsonChange,
  getCurrentParams,
  onLoadProfile,
  courierMode,
  setCourierMode,
  capacityDisplay,
  onCapacityChange,
  onCapacityBlur,
  investmentDisplay,
  onInvestmentChange,
  onInvestmentBlur,
  maxPackagesDisplay,
  onMaxPackagesChange,
  shareDisplay,
  onShareChange,
  collateralDisplay,
  onCollateralChange,
  onCollateralBlur,
  autoBlockadeMaxVolumeM3,
  setAutoBlockadeMaxVolumeM3,
  autoBlockadeMaxCollateralISK,
  setAutoBlockadeMaxCollateralISK,
  autoDstMaxVolumeM3,
  setAutoDstMaxVolumeM3,
  autoDstMaxCollateralISK,
  setAutoDstMaxCollateralISK,
  showAdvancedOptions,
  setShowAdvancedOptions,
  liquidityWindowDays,
  setLiquidityWindowDays,
  liquidityMinCoverageRatio,
  setLiquidityMinCoverageRatio,
  liquidityMinLiquidityThresholdISK,
  setLiquidityMinLiquidityThresholdISK,
  liquidityMinWindowTrades,
  setLiquidityMinWindowTrades,
  arbMaxInventoryDays,
  setArbMaxInventoryDays,
  arbMinMarginPercent,
  setArbMinMarginPercent,
  arbMaxPriceDeviationMultiple,
  setArbMaxPriceDeviationMultiple,
  arbMinTotalProfitISK,
  setArbMinTotalProfitISK,
  arbDisableInventoryLimit,
  setArbDisableInventoryLimit,
  arbAllowInventoryTopOff,
  setArbAllowInventoryTopOff,
  allocationMode,
  setAllocationMode,
  spreadBias,
  setSpreadBias,
  minPackageNetProfitISK,
  setMinPackageNetProfitISK,
  minPackageROIPercent,
  setMinPackageROIPercent,
  shippingMarginMultiplier,
  setShippingMarginMultiplier,
  densityWeight,
  setDensityWeight,
}: PlannerConfigurationSectionProps) {
  return (
    <Tabs defaultValue="simple" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="simple">Simple</TabsTrigger>
        <TabsTrigger value="advanced">Advanced (JSON)</TabsTrigger>
      </TabsList>

      <TabsContent value="simple" className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Planning Parameters
                </CardTitle>
                <CardDescription>
                  Configure the constraints and limits for package generation
                </CardDescription>
              </div>
              <ParameterProfileManager
                scope="PLANNER"
                currentParams={getCurrentParams()}
                onLoadProfile={onLoadProfile}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Courier Contract</Label>
                <Select
                  value={courierMode}
                  onValueChange={(value) => setCourierMode(value as CourierMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blockade">
                      Blockade Runner (13,000 m³ / 4B collateral)
                    </SelectItem>
                    <SelectItem value="dst">DST (60,000 m³ / 2B collateral)</SelectItem>
                    <SelectItem value="auto">
                      Auto (mix Blockade + DST per package)
                    </SelectItem>
                    <SelectItem value="custom">Custom (manual)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Auto mode lets the planner choose the best courier preset per
                  package based on volume and collateral constraints.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Package Capacity (m³)</Label>
                <Input
                  id="capacity"
                  type="text"
                  value={capacityDisplay}
                  onChange={(e) => onCapacityChange(e.target.value)}
                  onBlur={onCapacityBlur}
                  disabled={courierMode !== "custom"}
                />
                <p className="text-xs text-muted-foreground">
                  {courierMode === "auto"
                    ? "Auto mode uses per-package presets; this field shows the max envelope."
                    : courierMode === "custom"
                      ? "Maximum volume per package"
                      : "Derived from selected courier preset"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="investment">Total Investment (ISK)</Label>
                <Input
                  id="investment"
                  type="text"
                  value={investmentDisplay}
                  onChange={(e) => onInvestmentChange(e.target.value)}
                  onBlur={onInvestmentBlur}
                />
                <p className="text-xs text-muted-foreground">Total budget available</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPackages">Max Packages</Label>
                <Input
                  id="maxPackages"
                  type="text"
                  value={maxPackagesDisplay}
                  onChange={(e) => onMaxPackagesChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of packages
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="share">Per-Item Budget Share (%)</Label>
                <Input
                  id="share"
                  type="text"
                  value={shareDisplay}
                  onChange={(e) => onShareChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Max budget % per item per destination
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxCollateral">Max Package Collateral (ISK)</Label>
                <Input
                  id="maxCollateral"
                  type="text"
                  value={collateralDisplay}
                  onChange={(e) => onCollateralChange(e.target.value)}
                  onBlur={onCollateralBlur}
                  disabled={courierMode !== "custom"}
                />
                <p className="text-xs text-muted-foreground">
                  {courierMode === "auto"
                    ? "Auto mode uses per-package presets; this field shows the max envelope."
                    : courierMode === "custom"
                      ? "Max total value per package"
                      : "Derived from selected courier preset"}
                </p>
              </div>
            </div>

            {courierMode === "auto" && (
              <div className="mt-6 space-y-3">
                <div className="text-sm font-semibold">Auto Courier Presets</div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="text-sm font-medium">Blockade Runner</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Max Volume (m³)</Label>
                        <Input
                          type="number"
                          value={autoBlockadeMaxVolumeM3}
                          onChange={(e) =>
                            setAutoBlockadeMaxVolumeM3(Number(e.target.value || 0))
                          }
                          min="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Collateral (ISK)</Label>
                        <Input
                          type="number"
                          value={autoBlockadeMaxCollateralISK}
                          onChange={(e) =>
                            setAutoBlockadeMaxCollateralISK(Number(e.target.value || 0))
                          }
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="text-sm font-medium">DST</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Max Volume (m³)</Label>
                        <Input
                          type="number"
                          value={autoDstMaxVolumeM3}
                          onChange={(e) => setAutoDstMaxVolumeM3(Number(e.target.value || 0))}
                          min="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Collateral (ISK)</Label>
                        <Input
                          type="number"
                          value={autoDstMaxCollateralISK}
                          onChange={(e) =>
                            setAutoDstMaxCollateralISK(Number(e.target.value || 0))
                          }
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Collapsible open={showAdvancedOptions} onOpenChange={setShowAdvancedOptions}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer transition-colors hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Advanced Pipeline Options
                    </CardTitle>
                    <CardDescription>
                      Fine-tune liquidity and arbitrage parameters
                    </CardDescription>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${showAdvancedOptions ? "rotate-180" : ""}`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6 pt-0">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Liquidity Filters
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <LabeledInput
                      label="Time Window (days)"
                      tooltip="Override the liquidity window for deeper analysis. Leave empty to use default."
                    >
                      <Input
                        type="number"
                        value={liquidityWindowDays ?? ""}
                        onChange={(e) =>
                          setLiquidityWindowDays(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="1"
                        placeholder="Default"
                      />
                    </LabeledInput>

                    <LabeledInput
                      label="Min Coverage Ratio"
                      tooltip="Minimum fraction of days with trades (0-1). Higher values ensure more consistent trading."
                    >
                      <Input
                        type="number"
                        value={liquidityMinCoverageRatio ?? ""}
                        onChange={(e) =>
                          setLiquidityMinCoverageRatio(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="0"
                        max="1"
                        step="0.1"
                        placeholder="Default"
                      />
                    </LabeledInput>

                    <LabeledInput
                      label="Min Daily ISK Volume"
                      tooltip="Minimum average daily ISK value traded. Filters out low-volume items."
                    >
                      <Input
                        type="number"
                        value={liquidityMinLiquidityThresholdISK ?? ""}
                        onChange={(e) =>
                          setLiquidityMinLiquidityThresholdISK(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="0"
                        placeholder="Default"
                      />
                    </LabeledInput>

                    <LabeledInput
                      label="Min Daily Trades"
                      tooltip="Minimum average number of trades per day. Ensures active market participation."
                    >
                      <Input
                        type="number"
                        value={liquidityMinWindowTrades ?? ""}
                        onChange={(e) =>
                          setLiquidityMinWindowTrades(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="0"
                        placeholder="Default"
                      />
                    </LabeledInput>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Arbitrage Constraints
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <LabeledInput
                      label="Max Inventory Days"
                      tooltip="Maximum days of average daily volume to hold as inventory. Controls position sizing."
                    >
                      <Input
                        type="number"
                        value={arbMaxInventoryDays ?? ""}
                        onChange={(e) =>
                          setArbMaxInventoryDays(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="0.1"
                        step="0.1"
                        placeholder="Default (3)"
                      />
                    </LabeledInput>

                    <LabeledInput
                      label="Min Margin %"
                      tooltip="Minimum profit margin percentage after fees. Higher values = fewer but more profitable opportunities."
                    >
                      <Input
                        type="number"
                        value={arbMinMarginPercent ?? ""}
                        onChange={(e) =>
                          setArbMinMarginPercent(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="0"
                        step="1"
                        placeholder="Default (10)"
                      />
                    </LabeledInput>

                    <LabeledInput
                      label="Max Price Deviation Multiple"
                      tooltip="Reject opportunities where current price > historical average by this multiple. Helps avoid overpriced items."
                    >
                      <Input
                        type="number"
                        value={arbMaxPriceDeviationMultiple ?? ""}
                        onChange={(e) =>
                          setArbMaxPriceDeviationMultiple(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="1"
                        step="0.1"
                        placeholder="No limit"
                      />
                    </LabeledInput>

                    <LabeledInput
                      label="Min Total Profit (ISK)"
                      tooltip="Minimum total profit per opportunity. Filters out small opportunities."
                    >
                      <Input
                        type="number"
                        value={arbMinTotalProfitISK ?? ""}
                        onChange={(e) =>
                          setArbMinTotalProfitISK(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="0"
                        placeholder="Default"
                      />
                    </LabeledInput>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="planner-disableInventory"
                        checked={arbDisableInventoryLimit}
                        onCheckedChange={(checked) =>
                          setArbDisableInventoryLimit(checked as boolean)
                        }
                      />
                      <div className="space-y-1">
                        <label
                          htmlFor="planner-disableInventory"
                          className="cursor-pointer text-sm font-medium leading-none"
                        >
                          Disable Inventory Limits
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Ignore current cycle inventory constraints
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="planner-allowTopOff"
                        checked={arbAllowInventoryTopOff}
                        onCheckedChange={(checked) =>
                          setArbAllowInventoryTopOff(checked as boolean)
                        }
                        disabled={arbDisableInventoryLimit}
                      />
                      <div className="space-y-1">
                        <label
                          htmlFor="planner-allowTopOff"
                          className="cursor-pointer text-sm font-medium leading-none"
                        >
                          Allow Inventory Top-Off
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Add to existing positions up to max inventory days
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Packaging & Allocation
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <LabeledInput
                      label="Allocation Mode"
                      tooltip="Strategy for distributing opportunities across packages: 'best' prioritizes highest efficiency, 'roundRobin' distributes evenly, 'targetWeighted' uses custom targets."
                    >
                      <Select
                        value={allocationMode}
                        onValueChange={(value) =>
                          setAllocationMode(value as AllocationMode)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="best">Best (Efficiency First)</SelectItem>
                          <SelectItem value="roundRobin">
                            Round Robin (Even Distribution)
                          </SelectItem>
                          <SelectItem value="targetWeighted">
                            Target Weighted (Custom)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </LabeledInput>

                    <LabeledInput
                      label="Spread Bias"
                      tooltip="For targetWeighted mode: controls how strongly to bias selection toward under-target destinations. Higher values = stronger correction toward targets."
                    >
                      <Input
                        type="number"
                        value={spreadBias ?? ""}
                        onChange={(e) =>
                          setSpreadBias(e.target.value ? Number(e.target.value) : undefined)
                        }
                        min="0"
                        step="0.1"
                        placeholder="Default"
                        disabled={allocationMode !== "targetWeighted"}
                      />
                    </LabeledInput>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Package Quality Filters
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <LabeledInput
                      label="Min Package Net Profit (ISK)"
                      tooltip="Reject packages with net profit below this threshold. Prevents wasting effort on low-value contracts."
                    >
                      <Input
                        type="number"
                        value={minPackageNetProfitISK ?? ""}
                        onChange={(e) =>
                          setMinPackageNetProfitISK(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="0"
                        placeholder="No minimum"
                      />
                    </LabeledInput>

                    <LabeledInput
                      label="Min Package ROI %"
                      tooltip="Reject packages with ROI (netProfit/spend * 100) below this threshold. Ensures minimum efficiency for each contract."
                    >
                      <Input
                        type="number"
                        value={minPackageROIPercent ?? ""}
                        onChange={(e) =>
                          setMinPackageROIPercent(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="0"
                        step="0.1"
                        placeholder="No minimum"
                      />
                    </LabeledInput>

                    <LabeledInput
                      label="Shipping Margin Multiplier"
                      tooltip="Require box gross profit >= shipping cost × this multiplier. Default 1.0 = break-even; 1.5 = require 50% more profit than shipping. Prevents barely-profitable packages."
                    >
                      <Input
                        type="number"
                        value={shippingMarginMultiplier ?? ""}
                        onChange={(e) =>
                          setShippingMarginMultiplier(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        min="1"
                        step="0.1"
                        placeholder="Default (1.0)"
                      />
                    </LabeledInput>

                    <LabeledInput
                      label="Density Weight"
                      tooltip="Item prioritization blend: 1.0 = pure density (profit/m³, space-limited), 0.0 = pure ROI (profit/cost, capital-limited), 0.5 = equal blend. Adjust based on whether you're constrained by cargo space or budget."
                    >
                      <Input
                        type="number"
                        value={densityWeight ?? ""}
                        onChange={(e) =>
                          setDensityWeight(e.target.value ? Number(e.target.value) : undefined)
                        }
                        min="0"
                        max="1"
                        step="0.1"
                        placeholder="Default (1.0)"
                      />
                    </LabeledInput>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </TabsContent>

      <TabsContent value="advanced" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Advanced Configuration</CardTitle>
            <CardDescription>
              Direct JSON editing for fine-grained control
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="payload">Request JSON</Label>
            <Textarea
              id="payload"
              value={json}
              onChange={(e) => onJsonChange(e.target.value)}
              className="mt-2 min-h-96 font-mono text-xs"
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
