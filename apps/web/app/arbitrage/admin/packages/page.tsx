"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@eve/ui";
import { Input } from "@eve/ui";
import { Label } from "@eve/ui";
import { Textarea } from "@eve/ui";
import { Badge } from "@eve/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import {
  AlertCircle,
  Package,
  PackageX,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import { useArbitrageCommits } from "../../api/market";
import { usePackages, useMarkPackageFailed } from "../../api";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import type { CommittedPackage } from "@eve/shared";

type PackageDetails = {
  id: string;
  packageIndex: number;
  destinationName: string | null;
  collateralIsk: string;
  status: string;
  items: Array<{
    id: string;
    typeId: number;
    typeName: string;
    units: number;
    unitCost: string;
    unitProfit: string;
  }>;
  linkedCycleLines: Array<{
    cycleLineId: string;
    typeId: number;
    unitsCommitted: number;
    unitsSold: number;
  }>;
  canMarkFailed: boolean;
  validationMessage: string | null;
};

export default function PackagesPage() {
  return (
    <React.Suspense fallback={<div className="p-6">Loading...</div>}>
      <PackagesContent />
    </React.Suspense>
  );
}

function PackagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCycleId = searchParams.get("cycleId");
  const client = useApiClient();

  // Use React Query hooks
  const { data: cycles = [], isLoading: cyclesLoading } = useArbitrageCommits({
    limit: 100,
  });

  const [selectedCycleId, setSelectedCycleId] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Fetch packages with filters
  const {
    data: packages = [],
    isLoading: packagesLoading,
    error: packagesError,
  } = usePackages({
    cycleId: selectedCycleId,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const isLoading = cyclesLoading || packagesLoading;
  const error = packagesError ? String(packagesError) : null;

  // Mark failed dialog state
  const [selectedPackage, setSelectedPackage] =
    React.useState<PackageDetails | null>(null);
  const [showFailedDialog, setShowFailedDialog] = React.useState(false);
  const [collateralRecovered, setCollateralRecovered] = React.useState("");
  const [collateralProfit, setCollateralProfit] = React.useState("");
  const [failureMemo, setFailureMemo] = React.useState("");

  const markFailedMutation = useMarkPackageFailed();
  const isSubmitting = markFailedMutation.isPending;

  // Group packages by destination
  const packagesByDestination = React.useMemo(() => {
    const grouped = new Map<string, CommittedPackage[]>();
    packages.forEach((pkg) => {
      const key = pkg.destinationName || `Station ${pkg.destinationStationId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(pkg);
    });
    // Sort destinations alphabetically and packages by index
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([destination, pkgs]) => ({
        destination,
        packages: pkgs.sort((a, b) => a.packageIndex - b.packageIndex),
      }));
  }, [packages]);

  // Calculate total item costs for the selected package
  const totalItemCosts = React.useMemo(() => {
    if (!selectedPackage) return 0;
    return selectedPackage.items.reduce(
      (sum, item) => sum + item.units * Number(item.unitCost),
      0,
    );
  }, [selectedPackage]);

  // Set initial cycle when cycles load
  React.useEffect(() => {
    if (cycles.length > 0 && !selectedCycleId) {
      if (initialCycleId) {
        setSelectedCycleId(initialCycleId);
      } else {
        const openCycle = cycles.find((c) => c.status === "OPEN");
        setSelectedCycleId(openCycle?.id || cycles[0].id);
      }
    }
  }, [cycles, initialCycleId, selectedCycleId]);

  const handleOpenFailedDialog = async (pkg: CommittedPackage) => {
    try {
      // Fetch package details
      const details = await client.get<PackageDetails>(`/packages/${pkg.id}`);

      setSelectedPackage(details);
      setCollateralRecovered(pkg.collateralIsk);
      setCollateralProfit(""); // Admin can optionally specify the margin
      setFailureMemo("");
      setShowFailedDialog(true);
    } catch (err) {
      console.error("Failed to load package details:", err);
      alert("Failed to load package details");
    }
  };

  const handleMarkFailed = async () => {
    if (!selectedPackage) return;

    try {
      await markFailedMutation.mutateAsync({
        packageId: selectedPackage.id,
        reason: failureMemo || undefined,
      });

      // Close dialog and reset
      setShowFailedDialog(false);
      setSelectedPackage(null);

      alert("Package marked as failed successfully");
    } catch (err: unknown) {
      console.error("Failed to mark package as failed:", err);
      alert(
        err instanceof Error ? err.message : "Failed to mark package as failed",
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "completed":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Package className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Package Manager
            </h1>
            <p className="text-sm text-muted-foreground">
              Track and manage committed courier packages
            </p>
          </div>
        </div>
      </div>

      {/* Cycle Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Cycle</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select a cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((cycle) => (
                <SelectItem key={cycle.id} value={cycle.id}>
                  {cycle.name || `Cycle ${cycle.id.slice(0, 8)}`}
                  {cycle.status === "OPEN" && " (Open)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Status Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : packages.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No packages found for this cycle
                  {statusFilter !== "all" && ` with status "${statusFilter}"`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {packagesByDestination.map(({ destination, packages: destPackages }) => (
                <div key={destination} className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {destination}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({destPackages.length} {destPackages.length === 1 ? 'package' : 'packages'})
                    </span>
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {destPackages.map((pkg) => (
                <Card key={pkg.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          Package #{pkg.packageIndex}
                        </CardTitle>
                      </div>
                      <Badge
                        variant="outline"
                        className={getStatusColor(pkg.status)}
                      >
                        {pkg.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Items:</span>
                        <span className="font-medium">
                          {pkg.itemCount} ({pkg.totalUnits.toLocaleString()}{" "}
                          units)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Volume:</span>
                        <span className="font-medium tabular-nums">
                          {Number(pkg.totalVolumeM3).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          m³
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Collateral:
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatIsk(Number(pkg.collateralIsk))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Est. Profit:
                        </span>
                        <span className="font-medium tabular-nums text-emerald-500">
                          {formatIsk(Number(pkg.estimatedProfitIsk))}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Committed:
                        </span>
                        <span>
                          {new Date(pkg.committedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {pkg.status === "failed" &&
                        pkg.collateralRecoveredIsk && (
                          <div className="flex justify-between pt-2 border-t">
                            <span className="text-muted-foreground">
                              Recovered:
                            </span>
                            <span className="font-medium tabular-nums text-emerald-500">
                              {formatIsk(Number(pkg.collateralRecoveredIsk))}
                            </span>
                          </div>
                        )}
                    </div>

                    {pkg.status === "active" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => handleOpenFailedDialog(pkg)}
                      >
                        <PackageX className="h-4 w-4" />
                        Mark as Failed
                      </Button>
                    )}
                  </CardContent>
                </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mark Failed Dialog */}
      <Dialog open={showFailedDialog} onOpenChange={setShowFailedDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mark Package as Failed</DialogTitle>
            <DialogDescription>
              Package #{selectedPackage?.packageIndex} to{" "}
              {selectedPackage?.destinationName}
            </DialogDescription>
          </DialogHeader>

          {selectedPackage && (
            <div className="space-y-4">
              {!selectedPackage.canMarkFailed && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {selectedPackage.validationMessage}
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will reduce quantities and costs for all linked cycle
                  lines. This action cannot be undone.
                </AlertDescription>
              </Alert>

              {/* Items List */}
              <div className="space-y-2">
                <Label>Items in Package</Label>
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  <div className="divide-y">
                    {selectedPackage.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center p-2 text-sm"
                      >
                        <span>{item.typeName}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {item.units.toLocaleString()} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Item Costs</Label>
                <div className="p-3 bg-muted/30 rounded-md border">
                  <p className="text-sm font-medium tabular-nums">
                    {formatIsk(totalItemCosts)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Capital automatically recovered by reducing cycle lines
                  </p>
                </div>
              </div>

              {/* Collateral Recovered */}
              <div className="space-y-2">
                <Label htmlFor="collateralRecovered">
                  Collateral Recovered (ISK)
                </Label>
                <Input
                  id="collateralRecovered"
                  type="text"
                  value={collateralRecovered}
                  onChange={(e) => setCollateralRecovered(e.target.value)}
                  placeholder="e.g. 1234567.89"
                />
                <p className="text-xs text-muted-foreground">
                  Original collateral:{" "}
                  {formatIsk(Number(selectedPackage.collateralIsk))}
                </p>
              </div>

              {/* Collateral Profit (Margin) */}
              <div className="space-y-2">
                <Label htmlFor="collateralProfit">
                  Collateral Profit / Margin (ISK)
                </Label>
                <Input
                  id="collateralProfit"
                  type="text"
                  value={collateralProfit}
                  onChange={(e) => setCollateralProfit(e.target.value)}
                  placeholder="Optional - leave blank to auto-calculate"
                />
                {!collateralProfit && collateralRecovered && (
                  <p className="text-xs text-muted-foreground">
                    Auto-calculated profit:{" "}
                    <span className="font-medium">
                      {formatIsk(
                        Math.max(
                          0,
                          Number(collateralRecovered) - totalItemCosts,
                        ),
                      )}
                    </span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Only the profit portion above item costs will be recorded as
                  income
                </p>
              </div>

              {/* Memo */}
              <div className="space-y-2">
                <Label htmlFor="failureMemo">Memo (Optional)</Label>
                <Textarea
                  id="failureMemo"
                  value={failureMemo}
                  onChange={(e) => setFailureMemo(e.target.value)}
                  placeholder="Notes about the failed contract..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFailedDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleMarkFailed}
              disabled={
                !selectedPackage?.canMarkFailed ||
                !collateralRecovered ||
                isSubmitting
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PackageX className="h-4 w-4 mr-2" />
                  Mark as Failed
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
