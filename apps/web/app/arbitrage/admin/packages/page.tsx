"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Package,
  PackageX,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatIsk } from "@/lib/utils";

type CommittedPackage = {
  id: string;
  cycleId: string;
  packageIndex: number;
  destinationStationId: number;
  destinationName: string | null;
  collateralIsk: string;
  shippingCostIsk: string;
  estimatedProfitIsk: string;
  status: string;
  committedAt: string;
  failedAt: string | null;
  collateralRecoveredIsk: string | null;
  failureMemo: string | null;
  itemCount: number;
  totalUnits: number;
};

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

  const [cycles, setCycles] = React.useState<
    Array<{ id: string; name: string | null; closedAt: Date | null }>
  >([]);
  const [selectedCycleId, setSelectedCycleId] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [packages, setPackages] = React.useState<CommittedPackage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Mark failed dialog state
  const [selectedPackage, setSelectedPackage] =
    React.useState<PackageDetails | null>(null);
  const [showFailedDialog, setShowFailedDialog] = React.useState(false);
  const [collateralRecovered, setCollateralRecovered] = React.useState("");
  const [collateralProfit, setCollateralProfit] = React.useState("");
  const [failureMemo, setFailureMemo] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Calculate total item costs for the selected package
  const totalItemCosts = React.useMemo(() => {
    if (!selectedPackage) return 0;
    return selectedPackage.items.reduce(
      (sum, item) => sum + item.units * Number(item.unitCost),
      0,
    );
  }, [selectedPackage]);

  // Fetch cycles on mount
  React.useEffect(() => {
    const loadCycles = async () => {
      try {
        const res = await fetch("/api/arbitrage/commits?limit=100");
        if (!res.ok) throw new Error("Failed to load cycles");
        const data = await res.json();
        setCycles(data);

        // Set initial cycle
        if (initialCycleId) {
          setSelectedCycleId(initialCycleId);
        } else if (data.length > 0) {
          // Default to first open cycle or most recent
          const openCycle = data.find((c: any) => !c.closedAt);
          setSelectedCycleId(openCycle?.id || data[0].id);
        }
      } catch (err) {
        console.error("Failed to load cycles:", err);
      }
    };
    loadCycles();
  }, [initialCycleId]);

  // Fetch packages when cycle or filter changes
  React.useEffect(() => {
    if (!selectedCycleId) return;

    const loadPackages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ cycleId: selectedCycleId });
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        const res = await fetch(`/api/packages?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load packages");
        const data = await res.json();
        setPackages(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Failed to load packages:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPackages();
  }, [selectedCycleId, statusFilter]);

  const handleOpenFailedDialog = async (pkg: CommittedPackage) => {
    try {
      // Fetch package details
      const res = await fetch(`/api/packages/${pkg.id}`);
      if (!res.ok) throw new Error("Failed to load package details");
      const details: PackageDetails = await res.json();

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

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/packages/${selectedPackage.id}/mark-failed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collateralRecoveredIsk: collateralRecovered,
            collateralProfitIsk: collateralProfit || undefined,
            memo: failureMemo || undefined,
          }),
        },
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to mark package as failed");
      }

      // Reload packages
      setShowFailedDialog(false);
      setSelectedPackage(null);
      // Refresh the list
      const params = new URLSearchParams({ cycleId: selectedCycleId });
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const refreshRes = await fetch(`/api/packages?${params.toString()}`);
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setPackages(data);
      }

      alert("Package marked as failed successfully");
    } catch (err: any) {
      console.error("Failed to mark package as failed:", err);
      alert(err.message || "Failed to mark package as failed");
    } finally {
      setIsSubmitting(false);
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
                  {!cycle.closedAt && " (Open)"}
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <Card key={pkg.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          Package #{pkg.packageIndex}
                        </CardTitle>
                        <CardDescription>
                          {pkg.destinationName ||
                            `Station ${pkg.destinationStationId}`}
                        </CardDescription>
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
