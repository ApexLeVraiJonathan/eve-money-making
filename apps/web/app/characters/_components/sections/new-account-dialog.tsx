"use client";

import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, toast } from "@eve/ui";
import { useAssignCharacterToAccount, useCreateAccount } from "../../api";

type NewAccountDialogProps = {
  unassigned: { id: number; name: string }[];
};

export function NewAccountDialog({ unassigned }: NewAccountDialogProps) {
  const createAccount = useCreateAccount();
  const assign = useAssignCharacterToAccount();

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    const name = label.trim();
    if (!name) {
      toast.error("Please enter a name for the account");
      return;
    }
    try {
      const result = (await createAccount.mutateAsync({
        label: name,
        notes: notes || undefined,
      })) as { id: string };

      if (result?.id && selectedIds.length > 0) {
        await Promise.all(
          selectedIds.map((cid) =>
            assign.mutateAsync({ accountId: result.id, characterId: cid }),
          ),
        );
      }

      toast.success("Account created");
      setLabel("");
      setNotes("");
      setSelectedIds([]);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          New account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              placeholder="e.g. Skill Farm #1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="account-notes">Notes (optional)</Label>
            <Input
              id="account-notes"
              placeholder="Short description"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {unassigned.length > 0 && (
            <div className="space-y-2">
              <Label>Assign characters now (optional)</Label>
              <p className="text-xs text-muted-foreground">
                You can select up to 3 characters per account.
              </p>
              <div className="space-y-1">
                {unassigned.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleSelection(c.id)}
                      disabled={
                        !selectedIds.includes(c.id) && selectedIds.length >= 3
                      }
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen(false)}
            type="button"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleCreate()}
            disabled={createAccount.isPending || assign.isPending}
          >
            {createAccount.isPending ? "Creating…" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
