import * as React from "react";
import { Check, ChevronDown, Copy, DollarSign, Ship, TrendingUp, Wallet } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@eve/ui";
import type { PackagePlan, PlanResult } from "@eve/shared/tradecraft-arbitrage";
import { formatISK } from "../lib/planner-utils";

type PlannerResultsSectionProps = {
  data: PlanResult;
  groupedByDest: Record<string, PackagePlan[]>;
  copyTextByPackage: Record<string, string>;
  copiedDest: string | null;
  onCopyList: (destId: string, text: string) => void;
};

export function PlannerResultsSection({
  data,
  groupedByDest,
  copyTextByPackage,
  copiedDest,
  onCopyList,
}: PlannerResultsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Wallet className="h-4 w-4" />
              Total Spend
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatISK(data.totalSpendISK)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.packages.length} packages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Gross Profit
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-emerald-600">
              {formatISK(data.totalGrossProfitISK)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Before shipping</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Ship className="h-4 w-4" />
              Shipping Cost
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatISK(data.totalShippingISK)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Total transport fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Net Profit
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-emerald-600">
              {formatISK(data.totalNetProfitISK)}
            </div>
            <p className="mt-1 text-xs font-medium text-emerald-600">
              {((data.totalNetProfitISK / data.totalSpendISK) * 100).toFixed(1)}% ROI
            </p>
          </CardContent>
        </Card>
      </div>

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

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Packages by Destination</h2>
        {Object.values(groupedByDest).map((pkgs, idx) => {
          const destId = pkgs[0].destinationStationId;
          const destName = pkgs[0].destinationName || `Station ${destId}`;
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
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">Total Spend</div>
                    <div className="text-lg font-semibold tabular-nums">
                      {formatISK(totalSpend)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">Net Profit</div>
                    <div className="text-lg font-semibold tabular-nums text-emerald-600">
                      {formatISK(totalProfit)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">ROI</div>
                    <div className="text-lg font-semibold tabular-nums">
                      {((totalProfit / totalSpend) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="mb-3 text-sm font-semibold">Packages ({pkgs.length})</div>
                  {pkgs.map((pkg) => {
                    const packageKey = `${destId}-${pkg.packageIndex}`;
                    const packageCopyText = copyTextByPackage[packageKey] || "";

                    return (
                      <Collapsible key={pkg.packageIndex}>
                        <div className="rounded-lg border">
                          <div className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                            <CollapsibleTrigger className="flex flex-1 items-center gap-3 text-left">
                              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                              <div>
                                <div className="font-medium">
                                  Package #{pkg.packageIndex}
                                  {pkg.courierContractLabel || pkg.courierContractId ? (
                                    <span className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                                      {(
                                        pkg.courierContractLabel ?? pkg.courierContractId
                                      )?.toString()}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {pkg.items.length} items • {formatISK(pkg.spendISK)}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onCopyList(packageKey, packageCopyText)}
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
                            <div className="border-t bg-muted/20 p-4">
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Spend:</span>
                                    <span className="font-medium tabular-nums">
                                      {formatISK(pkg.spendISK)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Gross Profit:</span>
                                    <span className="font-medium tabular-nums text-emerald-600">
                                      {formatISK(pkg.grossProfitISK)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Shipping:</span>
                                    <span className="font-medium tabular-nums">
                                      {formatISK(pkg.shippingISK)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Net Profit:</span>
                                    <span className="font-medium tabular-nums text-emerald-600">
                                      {formatISK(pkg.netProfitISK)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Capacity Used:
                                    </span>
                                    <span className="font-medium tabular-nums">
                                      {pkg.usedCapacityM3.toLocaleString()} m³
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-t pt-2">
                                    <span className="text-muted-foreground">Efficiency:</span>
                                    <span className="font-semibold">
                                      {(pkg.efficiency * 100).toFixed(1)}% ROI
                                    </span>
                                  </div>
                                </div>

                                <div className="max-h-60 overflow-y-auto rounded-md border bg-background">
                                  <div className="divide-y">
                                    {pkg.items
                                      .sort((a, b) => a.name.localeCompare(b.name))
                                      .map((it, i) => (
                                        <div
                                          key={`${it.typeId}-${i}`}
                                          className="flex justify-between gap-4 p-2 text-xs hover:bg-muted/50"
                                        >
                                          <span className="truncate" title={it.name}>
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
  );
}
