import { Check, Loader2 } from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@eve/ui";
import { formatISK } from "../lib/planner-utils";

type CommitPlanDialogProps = {
  open: boolean;
  setOpen: (value: boolean) => void;
  recordShipping: boolean;
  setRecordShipping: (value: boolean) => void;
  shippingAmount: string;
  setShippingAmount: (value: string) => void;
  shippingMemo: string;
  setShippingMemo: (value: string) => void;
  suggestedShipping: number | null;
  hasData: boolean;
  commitPending: boolean;
  addTransportPending: boolean;
  onCommitOnly: () => void;
  onCommitWithOptions: () => void;
};

export function CommitPlanDialog({
  open,
  setOpen,
  recordShipping,
  setRecordShipping,
  shippingAmount,
  setShippingAmount,
  shippingMemo,
  setShippingMemo,
  suggestedShipping,
  hasData,
  commitPending,
  addTransportPending,
  onCommitOnly,
  onCommitWithOptions,
}: CommitPlanDialogProps) {
  const pending = commitPending || addTransportPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commit plan</DialogTitle>
          <DialogDescription>
            Optionally record shipping/transport cost on the new cycle so it is
            included in profit automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="recordShipping"
              checked={recordShipping}
              onCheckedChange={(v) => setRecordShipping(Boolean(v))}
              disabled={pending}
            />
            <div className="space-y-1">
              <Label
                htmlFor="recordShipping"
                className="cursor-pointer text-sm font-medium leading-none"
              >
                Record shipping cost as a transport fee
              </Label>
              <p className="text-xs text-muted-foreground">
                Suggested from this plan:{" "}
                <span className="font-medium">
                  {suggestedShipping !== null ? formatISK(suggestedShipping) : "—"}
                </span>
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shippingAmount">Amount (ISK)</Label>
              <Input
                id="shippingAmount"
                type="number"
                placeholder="0.00"
                value={shippingAmount}
                onChange={(e) => setShippingAmount(e.target.value)}
                disabled={!recordShipping || pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingMemo">Memo (optional)</Label>
              <Input
                id="shippingMemo"
                type="text"
                placeholder="e.g., Jita -> Amarr"
                value={shippingMemo}
                onChange={(e) => setShippingMemo(e.target.value)}
                disabled={!recordShipping || pending}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCommitOnly}
            disabled={!hasData || pending}
          >
            Commit only
          </Button>
          <Button
            type="button"
            onClick={onCommitWithOptions}
            disabled={!hasData || pending}
            className="gap-2"
          >
            {addTransportPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {recordShipping ? "Commit + record shipping" : "Commit plan"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
