import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
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
  TabsContent,
  Textarea,
} from "@eve/ui";
import { useClearTradeStrategies, useCreateTradeStrategy, useDeactivateTradeStrategies } from "../../../../api";
import { StrategyParamsDialog } from "./strategy-params-dialog";
import type { ShippingRow } from "../lib/types";

export type StrategiesTabContentProps = {
  createStrategy: ReturnType<typeof useCreateTradeStrategy>;
  deactivateStrategies: ReturnType<typeof useDeactivateTradeStrategies>;
  clearStrategies: ReturnType<typeof useClearTradeStrategies>;
  strategies: ReturnType<typeof import("../../../../api").useTradeStrategies>["data"];

  nameContains: string;
  setNameContains: (value: string) => void;
  setError: (value: string | null) => void;

  createMode: "form" | "json";
  setCreateMode: (value: "form" | "json") => void;
  newName: string;
  setNewName: (value: string) => void;
  newDescription: string;
  setNewDescription: (value: string) => void;
  paramsJson: string;
  setParamsJson: (value: string) => void;
  buildParamsFromForm: () => unknown;

  packageCapacityM3: string;
  setPackageCapacityM3: (value: string) => void;
  investmentISK: string;
  setInvestmentISK: (value: string) => void;
  maxPackagesHint: string;
  setMaxPackagesHint: (value: string) => void;
  perItemBudgetSharePct: string;
  setPerItemBudgetSharePct: (value: string) => void;
  maxPackageCollateralISK: string;
  setMaxPackageCollateralISK: (value: string) => void;
  allocationMode: "best" | "targetWeighted" | "roundRobin";
  setAllocationMode: (value: "best" | "targetWeighted" | "roundRobin") => void;
  spreadBias: string;
  setSpreadBias: (value: string) => void;
  allocationTargetsJson: string;
  setAllocationTargetsJson: (value: string) => void;

  shippingRows: ShippingRow[];
  setShippingRows: (value: ShippingRow[]) => void;
  showAdvancedCreate: boolean;
  setShowAdvancedCreate: (value: boolean) => void;

  liquidityWindowDays: string;
  setLiquidityWindowDays: (value: string) => void;
  liquidityMinCoverageRatio: string;
  setLiquidityMinCoverageRatio: (value: string) => void;
  liquidityMinLiquidityThresholdISK: string;
  setLiquidityMinLiquidityThresholdISK: (value: string) => void;
  liquidityMinWindowTrades: string;
  setLiquidityMinWindowTrades: (value: string) => void;

  arbMaxInventoryDays: string;
  setArbMaxInventoryDays: (value: string) => void;
  arbMinMarginPercent: string;
  setArbMinMarginPercent: (value: string) => void;
  arbMaxPriceDeviationMultiple: string;
  setArbMaxPriceDeviationMultiple: (value: string) => void;
  arbMinTotalProfitISK: string;
  setArbMinTotalProfitISK: (value: string) => void;
  arbDisableInventoryLimit: boolean;
  setArbDisableInventoryLimit: (value: boolean) => void;
  arbAllowInventoryTopOff: boolean;
  setArbAllowInventoryTopOff: (value: boolean) => void;

  minPackageNetProfitISK: string;
  setMinPackageNetProfitISK: (value: string) => void;
  minPackageROIPercent: string;
  setMinPackageROIPercent: (value: string) => void;
  shippingMarginMultiplier: string;
  setShippingMarginMultiplier: (value: string) => void;
  densityWeight: string;
  setDensityWeight: (value: string) => void;
};

export function StrategiesTabContent({
  createStrategy,
  deactivateStrategies,
  clearStrategies,
  strategies = [],
  nameContains,
  setNameContains,
  setError,
  createMode,
  setCreateMode,
  newName,
  setNewName,
  newDescription,
  setNewDescription,
  paramsJson,
  setParamsJson,
  buildParamsFromForm,
  packageCapacityM3,
  setPackageCapacityM3,
  investmentISK,
  setInvestmentISK,
  maxPackagesHint,
  setMaxPackagesHint,
  perItemBudgetSharePct,
  setPerItemBudgetSharePct,
  maxPackageCollateralISK,
  setMaxPackageCollateralISK,
  allocationMode,
  setAllocationMode,
  spreadBias,
  setSpreadBias,
  allocationTargetsJson,
  setAllocationTargetsJson,
  shippingRows,
  setShippingRows,
  showAdvancedCreate,
  setShowAdvancedCreate,
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
  minPackageNetProfitISK,
  setMinPackageNetProfitISK,
  minPackageROIPercent,
  setMinPackageROIPercent,
  shippingMarginMultiplier,
  setShippingMarginMultiplier,
  densityWeight,
  setDensityWeight,
}: StrategiesTabContentProps) {
  return (
    <TabsContent value="strategies" className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create Strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={createMode === "form" ? "default" : "outline"}
              onClick={() => setCreateMode("form")}
            >
              Form (Planner template)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={createMode === "json" ? "default" : "outline"}
              onClick={() => setCreateMode("json")}
            >
              Raw JSON
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My strategy"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {createMode === "form" ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4 space-y-4">
                <div className="text-sm font-medium">Planner</div>
                <div className="grid gap-4 md:grid-cols-2">
                  <LabeledInput
                    label="Package Capacity (m³)"
                    tooltip="Maximum volume per package."
                  >
                    <Input
                      value={packageCapacityM3}
                      onChange={(e) => setPackageCapacityM3(e.target.value)}
                      placeholder="13000"
                    />
                  </LabeledInput>
                  <LabeledInput label="Total Investment (ISK)" tooltip="Total budget available.">
                    <Input
                      value={investmentISK}
                      onChange={(e) => setInvestmentISK(e.target.value)}
                      placeholder="50000000000"
                    />
                  </LabeledInput>
                  <LabeledInput label="Max Packages" tooltip="Maximum number of packages.">
                    <Input
                      value={maxPackagesHint}
                      onChange={(e) => setMaxPackagesHint(e.target.value)}
                      placeholder="100"
                    />
                  </LabeledInput>
                  <LabeledInput
                    label="Per-Item Budget Share (%)"
                    tooltip="Max budget % per item per destination."
                  >
                    <Input
                      value={perItemBudgetSharePct}
                      onChange={(e) => setPerItemBudgetSharePct(e.target.value)}
                      placeholder="15"
                    />
                  </LabeledInput>
                  <LabeledInput
                    label="Max Package Collateral (ISK)"
                    tooltip="Max total value per package (collateral cap)."
                  >
                    <Input
                      value={maxPackageCollateralISK}
                      onChange={(e) => setMaxPackageCollateralISK(e.target.value)}
                      placeholder="4000000000"
                    />
                  </LabeledInput>
                  <LabeledInput
                    label="Allocation Mode"
                    tooltip="Strategy for distributing opportunities across packages."
                  >
                    <Select
                      value={allocationMode}
                      onValueChange={(v) =>
                        setAllocationMode(v as "best" | "targetWeighted" | "roundRobin")
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
                    tooltip="For targetWeighted mode: how strongly to bias selection toward under-target destinations."
                  >
                    <Input
                      value={spreadBias}
                      onChange={(e) => setSpreadBias(e.target.value)}
                      placeholder="Default"
                      disabled={allocationMode !== "targetWeighted"}
                    />
                  </LabeledInput>
                </div>

                {allocationMode === "targetWeighted" && (
                  <div className="space-y-2">
                    <Label>Allocation targets (JSON)</Label>
                    <Textarea
                      value={allocationTargetsJson}
                      onChange={(e) => setAllocationTargetsJson(e.target.value)}
                      className="font-mono text-xs min-h-24"
                      placeholder='{"60008494":0.5,"60005686":0.5}'
                    />
                  </div>
                )}
              </div>

              <div className="rounded-md border p-4 space-y-3">
                <div className="text-sm font-medium">Shipping Cost (by Station ID)</div>
                <div className="space-y-2">
                  {shippingRows.map((r, idx) => (
                    <div key={idx} className="grid gap-2 md:grid-cols-3">
                      <div className="md:col-span-1">
                        <Input
                          value={r.stationId}
                          onChange={(e) => {
                            const next = [...shippingRows];
                            next[idx] = { ...next[idx]!, stationId: e.target.value };
                            setShippingRows(next);
                          }}
                          placeholder="Station ID (e.g. 60008494)"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Input
                          value={r.costIsk}
                          onChange={(e) => {
                            const next = [...shippingRows];
                            next[idx] = { ...next[idx]!, costIsk: e.target.value };
                            setShippingRows(next);
                          }}
                          placeholder="Shipping cost (ISK)"
                        />
                      </div>
                      <div className="md:col-span-1 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const next = shippingRows.filter((_, i) => i !== idx);
                            setShippingRows(
                              next.length ? next : [{ stationId: "", costIsk: "" }],
                            );
                          }}
                          disabled={shippingRows.length <= 1}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setShippingRows([...shippingRows, { stationId: "", costIsk: "" }])
                    }
                  >
                    Add station
                  </Button>
                </div>
              </div>

              <Collapsible open={showAdvancedCreate} onOpenChange={setShowAdvancedCreate}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" type="button">
                    {showAdvancedCreate ? "Hide" : "Show"} advanced{" "}
                    {"(Liquidity + Arbitrage + Package Quality)"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-4">
                  <div className="rounded-md border p-4 space-y-4">
                    <div className="text-sm font-medium">Liquidity Filters</div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Time Window (days)"
                        tooltip="Override the liquidity window for deeper analysis."
                      >
                        <Input
                          value={liquidityWindowDays}
                          onChange={(e) => setLiquidityWindowDays(e.target.value)}
                          placeholder="14"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Min Coverage Ratio"
                        tooltip="Minimum fraction of days with trades (0-1)."
                      >
                        <Input
                          value={liquidityMinCoverageRatio}
                          onChange={(e) => setLiquidityMinCoverageRatio(e.target.value)}
                          placeholder="Default"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Min Daily ISK Volume"
                        tooltip="Minimum average daily ISK value traded."
                      >
                        <Input
                          value={liquidityMinLiquidityThresholdISK}
                          onChange={(e) => setLiquidityMinLiquidityThresholdISK(e.target.value)}
                          placeholder="Default"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Min Daily Trades"
                        tooltip="Minimum average number of trades per day."
                      >
                        <Input
                          value={liquidityMinWindowTrades}
                          onChange={(e) => setLiquidityMinWindowTrades(e.target.value)}
                          placeholder="Default"
                        />
                      </LabeledInput>
                    </div>
                  </div>

                  <div className="rounded-md border p-4 space-y-4">
                    <div className="text-sm font-medium">Arbitrage Constraints</div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Max Inventory Days"
                        tooltip="Maximum days of average daily volume to hold as inventory."
                      >
                        <Input
                          value={arbMaxInventoryDays}
                          onChange={(e) => setArbMaxInventoryDays(e.target.value)}
                          placeholder="Default (3)"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Min Margin %"
                        tooltip="Minimum profit margin percentage after fees."
                      >
                        <Input
                          value={arbMinMarginPercent}
                          onChange={(e) => setArbMinMarginPercent(e.target.value)}
                          placeholder="Default (10)"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Max Price Deviation Multiple"
                        tooltip="Reject opportunities where current price > historical average by this multiple."
                      >
                        <Input
                          value={arbMaxPriceDeviationMultiple}
                          onChange={(e) => setArbMaxPriceDeviationMultiple(e.target.value)}
                          placeholder="No limit"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Min Total Profit (ISK)"
                        tooltip="Minimum total profit per opportunity."
                      >
                        <Input
                          value={arbMinTotalProfitISK}
                          onChange={(e) => setArbMinTotalProfitISK(e.target.value)}
                          placeholder="Default"
                        />
                      </LabeledInput>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="sl-create-disableInv"
                          checked={arbDisableInventoryLimit}
                          onCheckedChange={(v) => setArbDisableInventoryLimit(Boolean(v))}
                        />
                        <div className="space-y-1">
                          <label
                            htmlFor="sl-create-disableInv"
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            Disable Inventory Limits
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Ignore inventory constraints
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="sl-create-topoff"
                          checked={arbAllowInventoryTopOff}
                          onCheckedChange={(v) => setArbAllowInventoryTopOff(Boolean(v))}
                          disabled={arbDisableInventoryLimit}
                        />
                        <div className="space-y-1">
                          <label
                            htmlFor="sl-create-topoff"
                            className="text-sm font-medium leading-none cursor-pointer"
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

                  <div className="rounded-md border p-4 space-y-4">
                    <div className="text-sm font-medium">Package Quality Filters</div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Min Package Net Profit (ISK)"
                        tooltip="Reject packages with net profit below this threshold."
                      >
                        <Input
                          value={minPackageNetProfitISK}
                          onChange={(e) => setMinPackageNetProfitISK(e.target.value)}
                          placeholder="No minimum"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Min Package ROI %"
                        tooltip="Reject packages with ROI (netProfit/spend * 100) below this threshold."
                      >
                        <Input
                          value={minPackageROIPercent}
                          onChange={(e) => setMinPackageROIPercent(e.target.value)}
                          placeholder="No minimum"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Shipping Margin Multiplier"
                        tooltip="Require box gross profit ≥ shipping cost × this multiplier."
                      >
                        <Input
                          value={shippingMarginMultiplier}
                          onChange={(e) => setShippingMarginMultiplier(e.target.value)}
                          placeholder="Default (1.0)"
                        />
                      </LabeledInput>
                      <LabeledInput
                        label="Density Weight"
                        tooltip="Item prioritization blend: 1.0 = density (profit/m³), 0.0 = ROI (profit/cost)."
                      >
                        <Input
                          value={densityWeight}
                          onChange={(e) => setDensityWeight(e.target.value)}
                          placeholder="Default (1.0)"
                        />
                      </LabeledInput>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Params (JSON)</Label>
              <Textarea
                className="min-h-72 font-mono text-xs"
                value={paramsJson}
                onChange={(e) => setParamsJson(e.target.value)}
              />
            </div>
          )}

          <Button
            disabled={createStrategy.isPending}
            onClick={async () => {
              try {
                setError(null);
                if (!newName.trim()) throw new Error("Name is required");
                const params =
                  createMode === "form" ? buildParamsFromForm() : JSON.parse(paramsJson);
                await createStrategy.mutateAsync({
                  name: newName.trim(),
                  description: newDescription.trim() || undefined,
                  params,
                  isActive: true,
                });
                setNewName("");
                setNewDescription("");
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            {createStrategy.isPending ? "Creating..." : "Create"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Strategies</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={deactivateStrategies.isPending}
                onClick={async () => {
                  setError(null);
                  const ok = confirm(
                    "Deactivate ALL strategies? (Sets isActive=false; you can recreate fresh strategies after.)",
                  );
                  if (!ok) return;
                  try {
                    await deactivateStrategies.mutateAsync({});
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Request failed");
                  }
                }}
              >
                {deactivateStrategies.isPending ? "Deactivating..." : "Deactivate all"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={deactivateStrategies.isPending}
                onClick={async () => {
                  const filter = nameContains.trim();
                  if (!filter) {
                    setError("Set 'Strategy name contains' first.");
                    return;
                  }
                  setError(null);
                  const ok = confirm(
                    `Deactivate strategies whose name contains "${filter}"?`,
                  );
                  if (!ok) return;
                  try {
                    await deactivateStrategies.mutateAsync({ nameContains: filter });
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Request failed");
                  }
                }}
              >
                Deactivate matching filter
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={clearStrategies.isPending}
                onClick={async () => {
                  setError(null);
                  const ok = confirm(
                    "DELETE ALL strategies? This will permanently delete Strategy Lab strategies (and cascade-delete their runs). This cannot be undone.",
                  );
                  if (!ok) return;
                  try {
                    await clearStrategies.mutateAsync({});
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Request failed");
                  }
                }}
              >
                {clearStrategies.isPending ? "Deleting..." : "Delete all"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={clearStrategies.isPending}
                onClick={async () => {
                  const filter = nameContains.trim();
                  if (!filter) {
                    setError("Set 'Strategy name contains' first.");
                    return;
                  }
                  setError(null);
                  const ok = confirm(
                    `DELETE strategies whose name contains "${filter}"? This cannot be undone.`,
                  );
                  if (!ok) return;
                  try {
                    await clearStrategies.mutateAsync({ nameContains: filter });
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Request failed");
                  }
                }}
              >
                Delete matching filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {strategies.length === 0 ? (
            <div className="text-sm text-muted-foreground">No strategies yet.</div>
          ) : (
            <div className="divide-y rounded-md border">
              {strategies.map((s) => (
                <div key={s.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.description ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">
                      {s.isActive ? "Active" : "Inactive"}
                    </div>
                    <StrategyParamsDialog
                      strategyName={s.name}
                      params={(s as unknown as { params?: unknown }).params}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </TabsContent>
  );
}
