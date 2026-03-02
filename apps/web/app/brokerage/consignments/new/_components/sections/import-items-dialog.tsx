import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@eve/ui";
import {
  parseImportedItemsFromText,
  type ImportedItem,
} from "../lib/consignment-form-utils";

type ImportItemsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importText: string;
  onImportTextChange: (value: string) => void;
  strategyCode: string;
  onItemsImported: (items: ImportedItem[]) => void;
};

export function ImportItemsDialog({
  open,
  onOpenChange,
  importText,
  onImportTextChange,
  strategyCode,
  onItemsImported,
}: ImportItemsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import items from EVE inventory</DialogTitle>
          <DialogDescription>
            Paste either of the two formats. We&apos;ll extract Name and Quantity.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          className="mt-3 h-48"
          placeholder={
            "Caldari Navy Ballistic Control System\t4\nPithum A-Type Medium Shield Booster\t1\n\nCompact Electronics\t31\tNamed Components\t\t\t0.03 m3\t126,852.93 ISK"
          }
          value={importText}
          onChange={(e) => onImportTextChange(e.target.value)}
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const parsed = parseImportedItemsFromText(importText, strategyCode);
              if (parsed.length > 0) {
                onItemsImported(parsed);
              }
            }}
          >
            Add to table
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
