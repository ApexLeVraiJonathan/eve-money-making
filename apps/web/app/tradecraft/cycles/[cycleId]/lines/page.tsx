"use client";

// Mark as dynamic since we use useParams
export const dynamic = "force-dynamic";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Plus, ArrowLeft, DollarSign } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import {
  useCycleLines,
  useCreateCycleLine,
  useDeleteCycleLine,
  useAddBrokerFee,
  useAddRelistFee,
} from "@/app/tradecraft/api";
import type { CycleLine } from "@eve/shared";
import { toast } from "sonner";
import { Badge } from "@eve/ui";
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

export default function CycleLinesPage() {
  const params = useParams();
  const router = useRouter();
  const cycleId = params.cycleId as string;

  // Use new API hooks
  const { data: lines = [], isLoading } = useCycleLines(cycleId);
  const createLineMutation = useCreateCycleLine();
  const deleteLineMutation = useDeleteCycleLine();
  const addBrokerFeeMutation = useAddBrokerFee();
  const addRelistFeeMutation = useAddRelistFee();

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

  const handleCreateLine = async () => {
    try {
      await createLineMutation.mutateAsync({
        cycleId,
        data: {
          typeId: Number(typeId),
          destinationStationId: Number(destinationStationId),
          plannedUnits: Number(plannedUnits),
        },
      });
      setShowCreateDialog(false);
      setTypeId("");
      setDestinationStationId("");
      setPlannedUnits("");
      toast.success("Line created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create line");
    }
  };

  const handleDeleteLine = async () => {
    if (!deleteLineId) return;
    try {
      await deleteLineMutation.mutateAsync(deleteLineId);
      setDeleteLineId(null);
      toast.success("Line deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete line");
    }
  };

  const handleAddFee = async () => {
    if (!selectedLine) return;
    try {
      const mutation =
        feeType === "broker" ? addBrokerFeeMutation : addRelistFeeMutation;
      await mutation.mutateAsync({
        lineId: selectedLine.id,
        amountIsk: feeAmount,
      });
      setShowFeeDialog(false);
      setSelectedLine(null);
      setFeeAmount("");
      toast.success("Fee added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add fee");
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
            onClick={() => router.push("/tradecraft/cycles")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cycle Lines
            </h1>
            <p className="text-sm text-muted-foreground">
              Buy commits for cycle {cycleId.slice(0, 8)}...
            </p>
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
                        {line.destinationStationName}
                      </div>
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
                      {(line.unitsRemaining ?? 0).toLocaleString()}
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
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openBrokerDialog(line)}
                        >
                          <DollarSign className="h-3 w-3 mr-1" />
                          Broker
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRelistDialog(line)}
                        >
                          <DollarSign className="h-3 w-3 mr-1" />
                          Relist
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteLineId(line.id)}
                        >
                          Delete
                        </Button>
                      </div>
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
