import { Alert, AlertDescription } from "@eve/ui";
import { Badge } from "@eve/ui";
import { Button } from "@eve/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eve/ui";
import { AlertCircle, Loader2, Package, PackageX } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import type { CommittedPackage } from "@eve/shared/tradecraft-market";
import type { PackagesByDestinationGroup } from "../lib/types";

function getStatusColor(status: string) {
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
}

export function PackagesListSection({
  statusFilter,
  setStatusFilter,
  error,
  isLoading,
  packages,
  packagesByDestination,
  onMarkFailed,
}: {
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  error: string | null;
  isLoading: boolean;
  packages: CommittedPackage[];
  packagesByDestination: PackagesByDestinationGroup[];
  onMarkFailed: (pkg: CommittedPackage) => void;
}) {
  return (
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
                    ({destPackages.length} {destPackages.length === 1 ? "package" : "packages"})
                  </span>
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {destPackages.map((pkg) => (
                    <Card key={pkg.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">Package #{pkg.packageIndex}</CardTitle>
                          </div>
                          <Badge variant="outline" className={getStatusColor(pkg.status)}>
                            {pkg.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Items:</span>
                            <span className="font-medium">
                              {pkg.itemCount} ({pkg.totalUnits.toLocaleString()} units)
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
                            <span className="text-muted-foreground">Collateral:</span>
                            <span className="font-medium tabular-nums">
                              {formatIsk(Number(pkg.collateralIsk))}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Est. Profit:</span>
                            <span className="font-medium tabular-nums text-emerald-500">
                              {formatIsk(Number(pkg.estimatedProfitIsk))}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Committed:</span>
                            <span>{new Date(pkg.committedAt).toLocaleDateString()}</span>
                          </div>
                          {pkg.status === "failed" && pkg.collateralRecoveredIsk && (
                            <div className="flex justify-between pt-2 border-t">
                              <span className="text-muted-foreground">Recovered:</span>
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
                            onClick={() => onMarkFailed(pkg)}
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
  );
}
