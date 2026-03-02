"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@eve/ui";
import {
  useCycleLines,
  useCreateCycleLine,
  useDeleteCycleLine,
  useAddBrokerFee,
  useAddRelistFee,
} from "../../../../api";
import type { CycleLine } from "@eve/shared/tradecraft-cycles";
import { CycleLinesHeader } from "./sections/cycle-lines-header";
import { CycleLinesTableSection } from "./sections/cycle-lines-table-section";
import { FeeDialogSection } from "./sections/fee-dialog-section";
import { DeleteLineAlertDialog } from "./sections/delete-line-alert-dialog";

type CycleLinesPageClientProps = {
  cycleId: string;
};

export default function CycleLinesPageClient({
  cycleId,
}: CycleLinesPageClientProps) {
  const router = useRouter();
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
  const [typeId, setTypeId] = React.useState("");
  const [destinationStationId, setDestinationStationId] = React.useState("");
  const [plannedUnits, setPlannedUnits] = React.useState("");
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
      <CycleLinesHeader
        cycleId={cycleId}
        showCreateDialog={showCreateDialog}
        typeId={typeId}
        destinationStationId={destinationStationId}
        plannedUnits={plannedUnits}
        onBack={() => router.push("/tradecraft/cycles")}
        onCreateDialogOpenChange={setShowCreateDialog}
        onTypeIdChange={setTypeId}
        onDestinationStationIdChange={setDestinationStationId}
        onPlannedUnitsChange={setPlannedUnits}
        onCreateLine={handleCreateLine}
      />

      <CycleLinesTableSection
        isLoading={isLoading}
        lines={lines}
        onOpenBrokerDialog={openBrokerDialog}
        onOpenRelistDialog={openRelistDialog}
        onDeleteLine={setDeleteLineId}
      />

      <FeeDialogSection
        open={showFeeDialog}
        selectedLine={selectedLine}
        feeType={feeType}
        feeAmount={feeAmount}
        onOpenChange={setShowFeeDialog}
        onFeeAmountChange={setFeeAmount}
        onAddFee={handleAddFee}
      />

      <DeleteLineAlertDialog
        deleteLineId={deleteLineId}
        onOpenChange={(open) => !open && setDeleteLineId(null)}
        onConfirmDelete={handleDeleteLine}
      />
    </div>
  );
}
