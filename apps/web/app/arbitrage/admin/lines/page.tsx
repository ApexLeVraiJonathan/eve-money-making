"use client";

// Mark as dynamic since we use useSearchParams
export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@eve/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@eve/ui";
import { Input } from "@eve/ui";
import { Label } from "@eve/ui";
import {
  Plus,
  ArrowLeft,
  DollarSign,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import { Skeleton } from "@eve/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eve/ui";

type CycleLine = {
  id: string;
  cycleId: string;
  typeId: number;
  typeName: string;
  destinationStationId: number;
  destinationStationName: string;
  plannedUnits: number;
  unitsBought: number;
  buyCostIsk: string;
  unitsSold: number;
  salesGrossIsk: string;
  salesTaxIsk: string;
  salesNetIsk: string;
  brokerFeesIsk: string;
  relistFeesIsk: string;
  unitsRemaining: number;
  wacUnitCost: string;
  lineProfitExclTransport: string;
  createdAt: string;
  updatedAt: string;
  packages: Array<{
    id: string;
    index: number;
    destinationName: string | null;
  }>;
};

export default function CycleLinesPage() {
  return (
    <React.Suspense fallback={<div className="p-6">Loading...</div>}>
      <CycleLinesContent />
    </React.Suspense>
  );
}

function CycleLinesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParamCycleId = searchParams.get("cycleId");

  const [cycleId, setCycleId] = React.useState<string>("");
  const [lines, setLines] = React.useState<CycleLine[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [showFeeDialog, setShowFeeDialog] = React.useState(false);
  const [selectedLine, setSelectedLine] = React.useState<CycleLine | null>(
    null,
  );
  const [feeType, setFeeType] = React.useState<"broker" | "relist">("broker");
  const [deleteLineId, setDeleteLineId] = React.useState<string | null>(null);

  // Form state for creating lines
  const [typeId, setTypeId] = React.useState("");
  const [destinationStationId, setDestinationStationId] = React.useState("");
  const [plannedUnits, setPlannedUnits] = React.useState("");

  // Fee form state
  const [feeAmount, setFeeAmount] = React.useState("");

  // Fetch latest open cycle if no cycleId provided
  React.useEffect(() => {
    const fetchLatestCycle = async () => {
      if (queryParamCycleId) {
        setCycleId(queryParamCycleId);
        return;
      }

      try {
        const resp = await fetch("/api/arbitrage/commits?limit=1");
        if (!resp.ok) return;
        const rows: Array<{
          id: string;
          createdAt: string;
          name?: string | null;
          closedAt?: Date | null;
        }> = await resp.json();
        // Get the first open cycle (not closed)
        const openCycle = rows.find((r) => !r.closedAt);
        if (openCycle) {
          setCycleId(openCycle.id);
        } else if (rows.length > 0) {
          // Fallback to most recent cycle if no open one
          setCycleId(rows[0].id);
        }
      } catch {
        // ignore
      }
    };
    fetchLatestCycle();
  }, [queryParamCycleId]);

  const loadLines = React.useCallback(async () => {
    if (!cycleId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ledger/cycles/${cycleId}/lines`);
      if (!res.ok) throw new Error("Failed to load cycle lines");
      const data = await res.json();
      setLines(data);
    } catch (err) {
      console.error("Failed to load cycle lines:", err);
    } finally {
      setIsLoading(false);
    }
  }, [cycleId]);

  React.useEffect(() => {
    loadLines();
  }, [loadLines]);

  const handleCreateLine = async () => {
    if (!cycleId) return;
    try {
      const res = await fetch(`/api/ledger/cycles/${cycleId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeId: Number(typeId),
          destinationStationId: Number(destinationStationId),
          plannedUnits: Number(plannedUnits),
        }),
      });
      if (!res.ok) throw new Error("Failed to create line");
      setShowCreateDialog(false);
      setTypeId("");
      setDestinationStationId("");
      setPlannedUnits("");
      loadLines();
    } catch (err) {
      console.error("Failed to create line:", err);
    }
  };

  const handleDeleteLine = async () => {
    if (!deleteLineId) return;
    try {
      const res = await fetch(`/api/ledger/lines/${deleteLineId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete line");
      setDeleteLineId(null);
      loadLines();
    } catch (err) {
      console.error("Failed to delete line:", err);
    }
  };

  const handleAddFee = async () => {
    if (!selectedLine) return;
    try {
      const endpoint =
        feeType === "broker"
          ? `/api/ledger/lines/${selectedLine.id}/broker-fee`
          : `/api/ledger/lines/${selectedLine.id}/relist-fee`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountIsk: feeAmount }),
      });
      if (!res.ok) throw new Error("Failed to add fee");
      setShowFeeDialog(false);
      setSelectedLine(null);
      setFeeAmount("");
      loadLines();
    } catch (err) {
      console.error("Failed to add fee:", err);
    }
  };

  const openBrokerDialog = (line: CycleLine) => {
    setSelectedLine(line);
    setFeeType("broker");
    setShowFeeDialog(true);
  };

  const openRelistDialog = (line: CycleLine) => {
    setSelectedLine(line);
    setFeeType("relist");
    setShowFeeDialog(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/arbitrage/cycles")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cycle Lines
            </h1>
            {cycleId ? (
              <p className="text-sm text-muted-foreground">
                Using cycle {cycleId.slice(0, 8)}...
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Loading latest open cycle...
              </p>
            )}
          </div>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Cycle Line</DialogTitle>
              <DialogDescription>
                Add a buy commitment line for a specific item and destination.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="typeId">Type ID</Label>
                <Input
                  id="typeId"
                  type="number"
                  placeholder="e.g. 34"
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destinationStationId">
                  Destination Station ID
                </Label>
                <Input
                  id="destinationStationId"
                  type="number"
                  placeholder="e.g. 60011866"
                  value={destinationStationId}
                  onChange={(e) => setDestinationStationId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plannedUnits">Planned Units</Label>
                <Input
                  id="plannedUnits"
                  type="number"
                  placeholder="e.g. 100"
                  value={plannedUnits}
                  onChange={(e) => setPlannedUnits(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateLine}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-4 surface-1">
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : lines.length === 0 ? (
        <div className="rounded-lg border p-8 text-center surface-1">
          <p className="text-muted-foreground">
            No cycle lines yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border surface-1 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Packages</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Bought</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Buy Cost</TableHead>
                <TableHead className="text-right">Sales Net</TableHead>
                <TableHead className="text-right">Broker Fees</TableHead>
                <TableHead className="text-right">Relist Fees</TableHead>
                <TableHead className="text-right">Line Profit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const profit = Number(line.lineProfitExclTransport);
                const isNegative = profit < 0;

                return (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="text-sm">{line.typeName}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {line.typeId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {line.destinationStationName.split(" ")[0]}
                      </div>
                    </TableCell>
                    <TableCell>
                      {line.packages.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {line.packages.map((pkg) => (
                            <a
                              key={pkg.id}
                              href={`/arbitrage/admin/packages?cycleId=${line.cycleId}`}
                              className="inline-flex items-center text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              title={`Package #${pkg.index}`}
                            >
                              #{pkg.index}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.plannedUnits.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.unitsBought.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.unitsSold.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.unitsRemaining.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatIsk(Number(line.buyCostIsk))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatIsk(Number(line.salesNetIsk))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatIsk(Number(line.brokerFeesIsk))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatIsk(Number(line.relistFeesIsk))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          isNegative ? "text-red-400" : "text-emerald-500"
                        }
                      >
                        {formatIsk(profit)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openBrokerDialog(line)}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Add Broker Fee
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openRelistDialog(line)}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Add Relist Fee
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteLineId(line.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Line
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Fee Dialog */}
      <Dialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {feeType === "broker" ? "Broker" : "Relist"} Fee
            </DialogTitle>
            <DialogDescription>
              {selectedLine && (
                <>
                  Adding {feeType} fee for {selectedLine.typeName} at{" "}
                  {selectedLine.destinationStationName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feeAmount">Amount (ISK)</Label>
              <Input
                id="feeAmount"
                type="text"
                placeholder="e.g. 1234567.89"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFee}>Add Fee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteLineId !== null}
        onOpenChange={(open) => !open && setDeleteLineId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this cycle line and all associated
              allocations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLine}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
