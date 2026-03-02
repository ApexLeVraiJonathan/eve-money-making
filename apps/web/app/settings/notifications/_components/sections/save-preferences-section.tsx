import { Button, Separator } from "@eve/ui";
import { Loader2 } from "lucide-react";

type Props = {
  hasChanges: boolean;
  lastSavedAt: number | null;
  isSaving: boolean;
  onSave: () => void;
};

export function SavePreferencesSection({
  hasChanges,
  lastSavedAt,
  isSaving,
  onSave,
}: Props) {
  return (
    <>
      <Separator />
      <div className="flex items-center justify-between gap-3">
        {hasChanges ? (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-600 dark:bg-amber-400" />
            <span className="font-medium">Unsaved changes</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            All changes saved
            {lastSavedAt ? (
              <span className="ml-2">
                (last saved {new Date(lastSavedAt).toLocaleTimeString()})
              </span>
            ) : null}
          </div>
        )}
        <Button
          type="button"
          size="sm"
          disabled={isSaving || !hasChanges}
          onClick={onSave}
          className="h-9"
        >
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save Preferences
        </Button>
      </div>
    </>
  );
}
