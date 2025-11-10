"use client";

import * as React from "react";
import Link from "next/link";
import {
  Package,
  Settings,
  TrendingUp,
  Wallet,
  Ship,
  DollarSign,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@eve/ui";
import { Input } from "@eve/ui";
import { Textarea } from "@eve/ui";
import { Label } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Alert, AlertDescription } from "@eve/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eve/ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@eve/ui";
import { ChevronDown } from "lucide-react";
import { usePlanPackages, useCommitArbitrage } from "../../api";

type PlanItem = {
  typeId: number;
  name: string;
  units: number;
  unitCost: number;
  unitProfit: number;
  unitVolume: number;
  spendISK: number;
  profitISK: number;
  volumeM3: number;
};

type PackagePlan = {
  packageIndex: number;
  destinationStationId: number;
  destinationName?: string;
  items: PlanItem[];
  spendISK: number;
  grossProfitISK: number;
  shippingISK: number;
  netProfitISK: number;
  usedCapacityM3: number;
  efficiency: number;
};

type PlanResult = {
  packages: PackagePlan[];
  totalSpendISK: number;
  totalGrossProfitISK: number;
  totalShippingISK: number;
  totalNetProfitISK: number;
  itemExposureByDest: Record<
    number,
    Record<number, { spendISK: number; units: number }>
  >;
  destSpend: Record<number, number>;
  notes: string[];
};

const defaultPayload = {
  shippingCostByStation: {
    60008494: 45000000,
    60005686: 19000000,
    60011866: 15000000,
    60004588: 25000000,
  },
  packageCapacityM3: 60000,
  investmentISK: 10_000_000_000,
  perDestinationMaxBudgetSharePerItem: 0.2,
  maxPackagesHint: 20,
  maxPackageCollateralISK: 5_000_000_000, // 5B ISK default
  liquidityWindowDays: 15, // Days of market data to analyze (adjust based on available data)
  allocation: { mode: "best" as const },
};

function formatISK(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ISK",
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace("ISK", "ISK");
}

export default function PlannerPage() {
  const [json, setJson] = React.useState(
    JSON.stringify(defaultPayload, null, 2),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<PlanResult | null>(null);
  const [memo, setMemo] = React.useState("");
  const [copiedDest, setCopiedDest] = React.useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = React.useState<{
    cycleId: string;
    packageCount: number;
  } | null>(null);

  // React Query mutations
  const planPackagesMutation = usePlanPackages();
  const commitArbitrageMutation = useCommitArbitrage();

  const loading = planPackagesMutation.isPending;

  // Display values for form inputs (formatted)
  const [capacityDisplay, setCapacityDisplay] = React.useState(
    defaultPayload.packageCapacityM3.toLocaleString(),
  );
  const [investmentDisplay, setInvestmentDisplay] = React.useState(
    defaultPayload.investmentISK.toLocaleString(),
  );
  const [maxPackagesDisplay, setMaxPackagesDisplay] = React.useState(
    defaultPayload.maxPackagesHint.toString(),
  );
  const [shareDisplay, setShareDisplay] = React.useState(
    (defaultPayload.perDestinationMaxBudgetSharePerItem * 100).toString(),
  );
  const [collateralDisplay, setCollateralDisplay] = React.useState(
    defaultPayload.maxPackageCollateralISK.toLocaleString(),
  );
  const [windowDaysDisplay, setWindowDaysDisplay] = React.useState(
    defaultPayload.liquidityWindowDays.toString(),
  );

  // Helper to parse formatted number string to number
  const parseFormattedNumber = (value: string): number => {
    return Number(value.replace(/,/g, ""));
  };

  // Helper to format number with commas
  const formatNumber = (value: number): string => {
    return value.toLocaleString();
  };

  // Update handlers for each field
  const handleCapacityChange = (value: string) => {
    setCapacityDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = parseFormattedNumber(value);
      if (!isNaN(numValue)) {
        j.packageCapacityM3 = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleInvestmentChange = (value: string) => {
    setInvestmentDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = parseFormattedNumber(value);
      if (!isNaN(numValue)) {
        j.investmentISK = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleMaxPackagesChange = (value: string) => {
    setMaxPackagesDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        j.maxPackagesHint = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleShareChange = (value: string) => {
    setShareDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = Number(value) / 100; // Convert percentage to decimal
      if (!isNaN(numValue)) {
        j.perDestinationMaxBudgetSharePerItem = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleCollateralChange = (value: string) => {
    setCollateralDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = parseFormattedNumber(value);
      if (!isNaN(numValue)) {
        j.maxPackageCollateralISK = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleWindowDaysChange = (value: string) => {
    setWindowDaysDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        j.liquidityWindowDays = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  // Format on blur to add commas
  const handleCapacityBlur = () => {
    const numValue = parseFormattedNumber(capacityDisplay);
    if (!isNaN(numValue)) {
      setCapacityDisplay(formatNumber(numValue));
    }
  };

  const handleInvestmentBlur = () => {
    const numValue = parseFormattedNumber(investmentDisplay);
    if (!isNaN(numValue)) {
      setInvestmentDisplay(formatNumber(numValue));
    }
  };

  const handleCollateralBlur = () => {
    const numValue = parseFormattedNumber(collateralDisplay);
    if (!isNaN(numValue)) {
      setCollateralDisplay(formatNumber(numValue));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setData(null);
    try {
      const payload = JSON.parse(json);
      const result = await planPackagesMutation.mutateAsync(payload);
      setData(result as PlanResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Group packages by destination
  const groupedByDest = React.useMemo(() => {
    if (!data) return {} as Record<string, PackagePlan[]>;
    return data.packages.reduce<Record<string, PackagePlan[]>>((acc, pkg) => {
      const key = String(pkg.destinationStationId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(pkg);
      return acc;
    }, {});
  }, [data]);

  // Aggregate items per destination (sum units of identical items)
  const aggregatedItemsByDest = React.useMemo(() => {
    const out: Record<
      string,
      Array<{ typeId: number; name: string; units: number }>
    > = {};
    for (const [dest, pkgs] of Object.entries(groupedByDest)) {
      const map = new Map<
        string,
        { typeId: number; name: string; units: number }
      >();
      for (const p of pkgs) {
        for (const it of p.items) {
          const key = `${it.typeId}|${it.name}`;
          const existing = map.get(key);
          if (existing) existing.units += it.units;
          else
            map.set(key, { typeId: it.typeId, name: it.name, units: it.units });
        }
      }
      out[dest] = Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [groupedByDest]);

  // Build copy lists by destination from aggregated items
  const copyTextByDest = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const [dest, items] of Object.entries(aggregatedItemsByDest)) {
      map[dest] = items.map((it) => `${it.name}\t${it.units}`).join("\n");
    }
    return map;
  }, [aggregatedItemsByDest]);

  // Build copy lists per package
  const copyTextByPackage = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (!data) return map;
    for (const pkg of data.packages) {
      const key = `${pkg.destinationStationId}-${pkg.packageIndex}`;
      map[key] = pkg.items
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((it) => `${it.name}\t${it.units}`)
        .join("\n");
    }
    return map;
  }, [data]);

  const handleCopyList = async (destId: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedDest(destId);
    setTimeout(() => setCopiedDest(null), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Settings className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Package Planner
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure and generate optimized arbitrage packages
          </p>
        </div>
      </div>

      {/* Configuration Section */}
      <Tabs defaultValue="simple" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="simple">Simple</TabsTrigger>
          <TabsTrigger value="advanced">Advanced (JSON)</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Planning Parameters
              </CardTitle>
              <CardDescription>
                Configure the constraints and limits for package generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Package Capacity (m³)</Label>
                  <Input
                    id="capacity"
                    type="text"
                    value={capacityDisplay}
                    onChange={(e) => handleCapacityChange(e.target.value)}
                    onBlur={handleCapacityBlur}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum volume per package
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="investment">Total Investment (ISK)</Label>
                  <Input
                    id="investment"
                    type="text"
                    value={investmentDisplay}
                    onChange={(e) => handleInvestmentChange(e.target.value)}
                    onBlur={handleInvestmentBlur}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total budget available
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxPackages">Max Packages</Label>
                  <Input
                    id="maxPackages"
                    type="text"
                    value={maxPackagesDisplay}
                    onChange={(e) => handleMaxPackagesChange(e.target.value)}
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
                    onChange={(e) => handleShareChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max budget % per item per destination
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxCollateral">
                    Max Package Collateral (ISK)
                  </Label>
                  <Input
                    id="maxCollateral"
                    type="text"
                    value={collateralDisplay}
                    onChange={(e) => handleCollateralChange(e.target.value)}
                    onBlur={handleCollateralBlur}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max total value per package
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="windowDays">Liquidity Window (Days)</Label>
                  <Input
                    id="windowDays"
                    type="text"
                    value={windowDaysDisplay}
                    onChange={(e) => handleWindowDaysChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Days of market data to analyze (1-90)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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
                onChange={(e) => setJson(e.target.value)}
                className="font-mono text-xs min-h-96 mt-2"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="gap-2 flex-1 sm:flex-initial"
          size="lg"
        >
          {loading ? (
            "Planning..."
          ) : (
            <>
              <Package className="h-4 w-4" />
              Generate Plan
            </>
          )}
        </Button>

        {data && (
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Commit memo (optional)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!data || commitArbitrageMutation.isPending}
              onClick={async () => {
                if (!data) return;
                try {
                  setError(null);
                  const payload = JSON.parse(json);
                  const body = await commitArbitrageMutation.mutateAsync({
                    request: payload,
                    result: data,
                    memo: memo || undefined,
                  });
                  setCommitSuccess({
                    cycleId: body.id,
                    packageCount: data.packages.length,
                  });
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
              className="gap-2"
            >
              {commitArbitrageMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Commit Plan
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {commitSuccess && (
        <Alert className="border-emerald-500/20 bg-emerald-500/10">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Plan committed successfully! {commitSuccess.packageCount} packages
              created for cycle {commitSuccess.cycleId.slice(0, 8)}...
            </span>
            <Link
              href={`/arbitrage/admin/packages?cycleId=${commitSuccess.cycleId}`}
            >
              <Button variant="outline" size="sm" className="ml-4">
                View Packages →
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Results Section */}
      {data && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  Total Spend
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatISK(data.totalSpendISK)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.packages.length} packages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Gross Profit
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums text-emerald-600">
                  {formatISK(data.totalGrossProfitISK)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Before shipping
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Ship className="h-4 w-4" />
                  Shipping Cost
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatISK(data.totalShippingISK)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total transport fees
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" />
                  Net Profit
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums text-emerald-600">
                  {formatISK(data.totalNetProfitISK)}
                </div>
                <p className="text-xs text-emerald-600 mt-1 font-medium">
                  {(
                    (data.totalNetProfitISK / data.totalSpendISK) *
                    100
                  ).toFixed(1)}
                  % ROI
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Planning Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Planning Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {data.notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Packages by Destination */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Packages by Destination</h2>
            {Object.values(groupedByDest).map((pkgs, idx) => {
              const destId = pkgs[0].destinationStationId;
              const destName = pkgs[0].destinationName || `Station ${destId}`;
              const copyText = copyTextByDest[String(destId)] || "";
              const aggItems = aggregatedItemsByDest[String(destId)] || [];
              const totalSpend = pkgs.reduce((s, p) => s + p.spendISK, 0);
              const totalProfit = pkgs.reduce((s, p) => s + p.netProfitISK, 0);

              return (
                <Card key={idx}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{destName}</CardTitle>
                        <CardDescription>Station ID: {destId}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {pkgs.length} package{pkgs.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Destination Summary */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-xs text-muted-foreground">
                          Total Spend
                        </div>
                        <div className="text-lg font-semibold tabular-nums">
                          {formatISK(totalSpend)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-xs text-muted-foreground">
                          Net Profit
                        </div>
                        <div className="text-lg font-semibold tabular-nums text-emerald-600">
                          {formatISK(totalProfit)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-xs text-muted-foreground">ROI</div>
                        <div className="text-lg font-semibold tabular-nums">
                          {((totalProfit / totalSpend) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Packages List */}
                    <div className="space-y-2">
                      <div className="text-sm font-semibold mb-3">
                        Packages ({pkgs.length})
                      </div>
                      {pkgs.map((pkg) => {
                        const packageKey = `${destId}-${pkg.packageIndex}`;
                        const packageCopyText =
                          copyTextByPackage[packageKey] || "";

                        return (
                          <Collapsible key={pkg.packageIndex}>
                            <div className="border rounded-lg">
                              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                                  <div>
                                    <div className="font-medium">
                                      Package #{pkg.packageIndex}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {pkg.items.length} items •{" "}
                                      {formatISK(pkg.spendISK)}
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleCopyList(packageKey, packageCopyText)
                                  }
                                  className="gap-2"
                                >
                                  {copiedDest === packageKey ? (
                                    <>
                                      <Check className="h-4 w-4" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4" />
                                      Copy
                                    </>
                                  )}
                                </Button>
                              </div>
                              <CollapsibleContent>
                                <div className="border-t p-4 bg-muted/20">
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    {/* Package Details */}
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Spend:
                                        </span>
                                        <span className="font-medium tabular-nums">
                                          {formatISK(pkg.spendISK)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Gross Profit:
                                        </span>
                                        <span className="font-medium tabular-nums text-emerald-600">
                                          {formatISK(pkg.grossProfitISK)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Shipping:
                                        </span>
                                        <span className="font-medium tabular-nums">
                                          {formatISK(pkg.shippingISK)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Net Profit:
                                        </span>
                                        <span className="font-medium tabular-nums text-emerald-600">
                                          {formatISK(pkg.netProfitISK)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Capacity Used:
                                        </span>
                                        <span className="font-medium tabular-nums">
                                          {pkg.usedCapacityM3.toLocaleString()}{" "}
                                          m³
                                        </span>
                                      </div>
                                      <div className="flex justify-between pt-2 border-t">
                                        <span className="text-muted-foreground">
                                          Efficiency:
                                        </span>
                                        <span className="font-semibold">
                                          {(pkg.efficiency * 100).toFixed(1)}%
                                          ROI
                                        </span>
                                      </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="max-h-60 overflow-y-auto border rounded-md bg-background">
                                      <div className="divide-y">
                                        {pkg.items
                                          .sort((a, b) =>
                                            a.name.localeCompare(b.name),
                                          )
                                          .map((it, i) => (
                                            <div
                                              key={`${it.typeId}-${i}`}
                                              className="flex justify-between gap-4 p-2 text-xs hover:bg-muted/50"
                                            >
                                              <span
                                                className="truncate"
                                                title={it.name}
                                              >
                                                {it.name}
                                              </span>
                                              <span className="tabular-nums font-medium">
                                                {it.units}
                                              </span>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
