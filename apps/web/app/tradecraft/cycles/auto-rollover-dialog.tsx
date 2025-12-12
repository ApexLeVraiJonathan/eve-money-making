"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  RadioGroup,
  RadioGroupItem,
} from "@eve/ui";
import {
  type AutoRolloverSettings,
  useAutoRolloverSettings,
  useUpdateAutoRolloverSettings,
} from "../api";

function coerceRolloverType(
  v: unknown,
): AutoRolloverSettings["defaultRolloverType"] {
  return v === "FULL_PAYOUT" ? "FULL_PAYOUT" : "INITIAL_ONLY";
}

export function AutoRolloverDialog({
  trigger,
  queryEnabled,
}: {
  trigger: React.ReactNode;
  queryEnabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  const { data, isLoading } = useAutoRolloverSettings(queryEnabled && open);
  const update = useUpdateAutoRolloverSettings();

  const [enabled, setEnabled] = React.useState(false);
  const [type, setType] =
    React.useState<AutoRolloverSettings["defaultRolloverType"]>("INITIAL_ONLY");

  React.useEffect(() => {
    if (!open) return;
    if (!data) return;
    setEnabled(data.enabled);
    setType(coerceRolloverType(data.defaultRolloverType));
  }, [open, data]);

  const onSave = async () => {
    try {
      await update.mutateAsync({ enabled, defaultRolloverType: type });
      toast.success("Automatic rollover settings saved");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Automatic rollover</DialogTitle>
          <DialogDescription>
            When a new cycle is planned, we will automatically create a rollover
            participation for you using this setting. You can still override the
            rollover option for a specific planned cycle (including Custom
            Amount) while planning is open.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-rollover-enabled"
                checked={enabled}
                onCheckedChange={(v) => setEnabled(!!v)}
              />
              <Label htmlFor="auto-rollover-enabled" className="cursor-pointer">
                Enable automatic rollover
              </Label>
            </div>

            <div className={enabled ? "" : "opacity-60"}>
              <div className="text-sm font-medium mb-2">Default option</div>
              <RadioGroup
                value={type}
                onValueChange={(v) =>
                  setType(v as AutoRolloverSettings["defaultRolloverType"])
                }
                disabled={!enabled}
                className="space-y-3"
              >
                <div className="flex gap-3">
                  <RadioGroupItem
                    value="FULL_PAYOUT"
                    id="ar-full"
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor="ar-full"
                      className="cursor-pointer font-medium text-sm block"
                    >
                      Full payout (initial + profit)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Roll over your entire payout, capped at 20B ISK.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <RadioGroupItem
                    value="INITIAL_ONLY"
                    id="ar-initial"
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor="ar-initial"
                      className="cursor-pointer font-medium text-sm block"
                    >
                      Initial investment only
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Roll over only your initial investment; profit will be
                      paid out.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={update.isPending || isLoading}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
