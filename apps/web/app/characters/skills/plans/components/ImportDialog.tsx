"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@eve/ui";
import { Loader2 } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (text: string, replace: boolean) => Promise<void>;
  isLoading: boolean;
}

export function ImportDialog({
  open,
  onOpenChange,
  onImport,
  isLoading,
}: ImportDialogProps) {
  const [importText, setImportText] = useState("");

  const handlePreview = async () => {
    await onImport(importText, false);
    setImportText("");
    onOpenChange(false);
  };

  const handleReplace = async () => {
    await onImport(importText, true);
    setImportText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import from EVE Online</DialogTitle>
          <DialogDescription>
            Paste your skill plan text from EVE Online below. You can copy this
            from the in-game skill plan window.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste skill plan text from EVE here...&#10;&#10;Example:&#10;Spaceship Command I&#10;Spaceship Command II&#10;Caldari Frigate I"
            rows={12}
            className="font-mono text-xs"
          />
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={isLoading || !importText.trim()}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Preview
          </Button>
          <Button
            onClick={handleReplace}
            disabled={isLoading || !importText.trim()}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Replace Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
