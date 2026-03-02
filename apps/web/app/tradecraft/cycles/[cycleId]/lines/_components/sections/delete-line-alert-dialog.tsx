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
} from "@eve/ui";

type DeleteLineAlertDialogProps = {
  deleteLineId: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
};

export function DeleteLineAlertDialog({
  deleteLineId,
  onOpenChange,
  onConfirmDelete,
}: DeleteLineAlertDialogProps) {
  return (
    <AlertDialog open={deleteLineId !== null} onOpenChange={onOpenChange}>
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
          <AlertDialogAction onClick={onConfirmDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
