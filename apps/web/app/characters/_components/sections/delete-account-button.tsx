"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  toast,
} from "@eve/ui";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeleteAccount } from "../../api";

type DeleteAccountButtonProps = {
  accountId: string;
};

export function DeleteAccountButton({ accountId }: DeleteAccountButtonProps) {
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteAccount.mutateAsync(accountId);
      toast.success("Account deleted");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete account");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          disabled={deleteAccount.isPending}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete account</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this account?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the account group, unassigns any characters, and
            deletes tracked PLEX/MCT entries. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteAccount.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => void handleDelete()}
            disabled={deleteAccount.isPending}
          >
            {deleteAccount.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
