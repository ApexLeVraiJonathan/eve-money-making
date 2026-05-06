import { ClipboardCopy } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eve/ui";
import { mapHubToRecipient, type Hub } from "../lib/consignment-form-utils";

type ContractSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hub: Hub;
  submitCode: string | null;
  onCopyAvailability: () => Promise<void>;
  onCopyDescription: () => Promise<void>;
  onConfirm: () => void;
  confirmDisabled: boolean;
  confirmPending: boolean;
};

export function ContractSettingsDialog({
  open,
  onOpenChange,
  hub,
  submitCode,
  onCopyAvailability,
  onCopyDescription,
  onConfirm,
  confirmDisabled,
  confirmPending,
}: ContractSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contract Settings</DialogTitle>
          <DialogDescription>
            Create an Item Exchange contract with the following fields.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border p-3 surface-2">
            <div className="text-xs text-muted-foreground">Contract type:</div>
            <div className="mt-1">Item Exchange</div>
          </div>
          <div className="rounded-md border p-3 surface-2">
            <div className="text-xs text-muted-foreground">Availability:</div>
            <div className="mt-1 flex items-center gap-2">
              <span>{mapHubToRecipient(hub)}</span>
              <Button
                aria-label="Copy availability"
                variant="ghost"
                size="icon"
                onClick={onCopyAvailability}
              >
                <ClipboardCopy />
              </Button>
            </div>
          </div>
          <div className="rounded-md border p-3 surface-2">
            <div className="text-xs text-muted-foreground">Expiration:</div>
            <div className="mt-1">2 Weeks</div>
          </div>
          <div className="rounded-md border p-3 surface-2">
            <div className="text-xs text-muted-foreground">Description:</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-sm">{submitCode}</code>
              <Button
                aria-label="Copy description"
                variant="ghost"
                size="icon"
                onClick={onCopyDescription}
              >
                <ClipboardCopy />
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onConfirm} disabled={confirmDisabled}>
              {confirmPending ? "Creating…" : "Confirm"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
