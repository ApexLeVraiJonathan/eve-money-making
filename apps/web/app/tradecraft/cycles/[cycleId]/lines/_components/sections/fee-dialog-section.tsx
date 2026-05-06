"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@eve/ui";
import type { CycleLine } from "@eve/shared/tradecraft-cycles";

type FeeDialogSectionProps = {
  open: boolean;
  selectedLine: CycleLine | null;
  feeType: "broker" | "relist";
  feeAmount: string;
  onOpenChange: (open: boolean) => void;
  onFeeAmountChange: (value: string) => void;
  onAddFee: () => void;
};

export function FeeDialogSection({
  open,
  selectedLine,
  feeType,
  feeAmount,
  onOpenChange,
  onFeeAmountChange,
  onAddFee,
}: FeeDialogSectionProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onChange={(e) => onFeeAmountChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAddFee}>Add Fee</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
