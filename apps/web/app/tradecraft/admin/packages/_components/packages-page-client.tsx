"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { Package } from "lucide-react";
import { useArbitrageCommits } from "../../../api/market";
import { usePackages, useMarkPackageFailed } from "../../../api";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { sortByStationName } from "@/app/tradecraft/lib/station-sorting";
import type { CommittedPackage } from "@eve/shared/tradecraft-market";
import type { PackageDetails, PackagesByDestinationGroup } from "./lib/types";
import { PackagesListSection } from "./sections/packages-list-section";
import { MarkFailedDialog } from "./sections/mark-failed-dialog";

export default function PackagesPageClient() {
  const searchParams = useSearchParams();
  const initialCycleId = searchParams.get("cycleId");
  const client = useApiClient();

  const { data: cycles = [], isLoading: cyclesLoading } = useArbitrageCommits({
    limit: 100,
  });

  const [selectedCycleId, setSelectedCycleId] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

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

  const [selectedPackage, setSelectedPackage] = React.useState<PackageDetails | null>(
    null,
  );
  const [showFailedDialog, setShowFailedDialog] = React.useState(false);
  const [collateralRecovered, setCollateralRecovered] = React.useState("");
  const [collateralProfit, setCollateralProfit] = React.useState("");
  const [failureMemo, setFailureMemo] = React.useState("");

  const markFailedMutation = useMarkPackageFailed();
  const isSubmitting = markFailedMutation.isPending;

  const packagesByDestination = React.useMemo<PackagesByDestinationGroup[]>(() => {
    const grouped = new Map<string, CommittedPackage[]>();
    packages.forEach((pkg) => {
      const key = pkg.destinationName || `Station ${pkg.destinationStationId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(pkg);
    });

    return sortByStationName(
      Array.from(grouped.entries()).map(([destination, pkgs]) => ({
        destination,
        stationName: destination,
        packages: pkgs
          .slice()
          .sort(
            (a, b) =>
              new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime(),
          ),
      })),
    ).map(({ destination, packages: destinationPackages }) => ({
      destination,
      packages: destinationPackages,
    }));
  }, [packages]);

  const totalItemCosts = React.useMemo(() => {
    if (!selectedPackage) return 0;
    return selectedPackage.items.reduce(
      (sum, item) => sum + item.units * Number(item.unitCost),
      0,
    );
  }, [selectedPackage]);

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
      const details = await client.get<PackageDetails>(`/packages/${pkg.id}`);
      setSelectedPackage(details);
      setCollateralRecovered(pkg.collateralIsk);
      setCollateralProfit("");
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
        collateralRecoveredIsk: collateralRecovered,
        collateralProfitIsk: collateralProfit || undefined,
        memo: failureMemo || undefined,
      });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Package className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Package Manager</h1>
            <p className="text-sm text-muted-foreground">
              Track and manage committed courier packages
            </p>
          </div>
        </div>
      </div>

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

      <PackagesListSection
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        error={error}
        isLoading={isLoading}
        packages={packages}
        packagesByDestination={packagesByDestination}
        onMarkFailed={handleOpenFailedDialog}
      />

      <MarkFailedDialog
        selectedPackage={selectedPackage}
        showFailedDialog={showFailedDialog}
        setShowFailedDialog={setShowFailedDialog}
        collateralRecovered={collateralRecovered}
        setCollateralRecovered={setCollateralRecovered}
        collateralProfit={collateralProfit}
        setCollateralProfit={setCollateralProfit}
        failureMemo={failureMemo}
        setFailureMemo={setFailureMemo}
        totalItemCosts={totalItemCosts}
        isSubmitting={isSubmitting}
        onSubmit={handleMarkFailed}
      />
    </div>
  );
}
