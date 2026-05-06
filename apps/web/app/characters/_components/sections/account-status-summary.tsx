"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from "@eve/ui";
import { Clock } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { EveAccountMct, EveAccountPlex } from "../../api";
import {
  useAccountMct,
  useAccountPlex,
  useCreateMct,
  useCreatePlexSubscription,
  useDeleteMct,
  useDeletePlexSubscription,
  useUpdateMct,
  useUpdatePlexSubscription,
} from "../../api";

type AccountStatusSummaryProps = {
  accountId: string;
  plex: {
    expiresAt: string;
    daysRemaining: number | null;
    status: "none" | "active" | "expired" | "upcoming";
  } | null;
};

export function AccountStatusSummary({ accountId, plex }: AccountStatusSummaryProps) {
  const { data: mctSlots = [] } = useAccountMct(accountId);
  const [plexDialogOpen, setPlexDialogOpen] = useState(false);
  const [mctDialogOpen, setMctDialogOpen] = useState(false);

  const now = Date.now();

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-4 text-sm sm:flex-nowrap sm:items-center sm:gap-8">
        <div className="flex items-center gap-3 flex-1 basis-full min-w-[220px] sm:basis-auto sm:min-w-[260px]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="text-xs px-2 py-1 shrink-0 font-semibold cursor-help">
                PLEX
              </Badge>
            </TooltipTrigger>
            <TooltipContent>EVE Online subscription time</TooltipContent>
          </Tooltip>
          {plex ? (
            <button
              onClick={() => setPlexDialogOpen(true)}
              className="flex flex-col text-left hover:underline"
            >
              <span
                className={cn(
                  "font-semibold text-sm",
                  plex.daysRemaining !== null &&
                    plex.daysRemaining <= 3 &&
                    "text-destructive",
                  plex.daysRemaining !== null &&
                    plex.daysRemaining > 3 &&
                    plex.daysRemaining <= 15 &&
                    "text-amber-500 dark:text-amber-400",
                )}
              >
                {new Date(plex.expiresAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}{" "}
                {new Date(plex.expiresAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                  hour12: false,
                })}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  plex.daysRemaining !== null && plex.daysRemaining <= 3
                    ? "text-destructive"
                    : plex.daysRemaining !== null && plex.daysRemaining <= 15
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-muted-foreground",
                )}
              >
                {typeof plex.daysRemaining === "number"
                  ? `${plex.daysRemaining}d remaining`
                  : "EVE Time"}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setPlexDialogOpen(true)}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline font-medium"
            >
              Add PLEX +
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-3 sm:flex-nowrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="text-xs px-2 py-1 shrink-0 font-semibold cursor-help"
              >
                MCT
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Multiple Character Training slots</TooltipContent>
          </Tooltip>
          {mctSlots.length > 0 ? (
            <button
              onClick={() => setMctDialogOpen(true)}
              className="flex flex-wrap gap-4 text-left hover:underline"
            >
              {mctSlots.map((slot) => {
                const diffMs = new Date(slot.expiresAt).getTime() - now;
                const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                const getColorClass = () => {
                  if (!Number.isFinite(daysRemaining)) return "";
                  if (daysRemaining <= 3) return "text-destructive";
                  if (daysRemaining <= 15)
                    return "text-amber-500 dark:text-amber-400";
                  return "";
                };

                return (
                  <div key={slot.id} className="flex flex-col">
                    <span className={cn("font-semibold text-sm", getColorClass())}>
                      {new Date(slot.expiresAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        getColorClass() || "text-muted-foreground",
                      )}
                    >
                      {Number.isFinite(daysRemaining)
                        ? `${daysRemaining}d remaining`
                        : "EVE Time"}
                    </span>
                  </div>
                );
              })}
            </button>
          ) : (
            <button
              onClick={() => setMctDialogOpen(true)}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline font-medium"
            >
              Add MCT +
            </button>
          )}
        </div>
      </div>

      <AccountPlexDialog
        accountId={accountId}
        open={plexDialogOpen}
        onOpenChange={setPlexDialogOpen}
      />
      <AccountMctDialog
        accountId={accountId}
        open={mctDialogOpen}
        onOpenChange={setMctDialogOpen}
      />
    </>
  );
}

function PlexExtendPopover({
  plex,
  accountId,
}: {
  plex: EveAccountPlex;
  accountId: string;
}) {
  const updatePlex = useUpdatePlexSubscription(accountId);
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState<string>("");

  const handleExtendPreset = async (days: number) => {
    const baseExpiry = new Date(plex.expiresAt);
    if (Number.isNaN(baseExpiry.getTime())) {
      toast.error("Invalid expiry date");
      return;
    }

    const extended = new Date(
      baseExpiry.getTime() + days * 24 * 60 * 60 * 1000,
    );

    try {
      await updatePlex.mutateAsync({
        subscriptionId: plex.id,
        expiresAt: extended.toISOString(),
      });
      toast.success(`PLEX extended by ${days} days`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExtendCustom = async () => {
    if (!customDate) {
      toast.error("Please pick a date");
      return;
    }

    try {
      await updatePlex.mutateAsync({
        subscriptionId: plex.id,
        expiresAt: new Date(customDate).toISOString(),
      });
      toast.success("PLEX period updated");
      setOpen(false);
      setCustomDate("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[11px]"
          disabled={updatePlex.isPending}
        >
          <Clock className="h-3 w-3 mr-1" />
          Extend
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold">Preset durations</p>
            <div className="grid gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="justify-start h-8 text-xs"
                onClick={() => void handleExtendPreset(30)}
                disabled={updatePlex.isPending}
              >
                1 month (+30d)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="justify-start h-8 text-xs"
                onClick={() => void handleExtendPreset(90)}
                disabled={updatePlex.isPending}
              >
                3 months (+90d)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="justify-start h-8 text-xs"
                onClick={() => void handleExtendPreset(180)}
                disabled={updatePlex.isPending}
              >
                6 months (+180d)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="justify-start h-8 text-xs"
                onClick={() => void handleExtendPreset(365)}
                disabled={updatePlex.isPending}
              >
                12 months (+365d)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="justify-start h-8 text-xs"
                onClick={() => void handleExtendPreset(730)}
                disabled={updatePlex.isPending}
              >
                24 months (+730d)
              </Button>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="custom-plex-date" className="text-xs">
              Custom date
            </Label>
            <Input
              id="custom-plex-date"
              type="datetime-local"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              className="w-full h-8"
              onClick={() => void handleExtendCustom()}
              disabled={updatePlex.isPending || !customDate}
            >
              Set custom date
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AccountPlexDialog({
  accountId,
  open,
  onOpenChange,
}: {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: plex = [] } = useAccountPlex(accountId);
  const createPlex = useCreatePlexSubscription(accountId);
  const deletePlex = useDeletePlexSubscription(accountId);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const handleCreate = async () => {
    if (!expiresAt) {
      toast.error("Please pick an expiry date");
      return;
    }
    try {
      await createPlex.mutateAsync({
        expiresAt,
        notes: notes || undefined,
      });
      setExpiresAt("");
      setNotes("");
      toast.success("PLEX period saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlex.mutateAsync(id);
      toast.success("PLEX period deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>PLEX periods</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          {plex.length === 0 ? (
            <p className="text-muted-foreground">
              No PLEX periods recorded for this account yet.
            </p>
          ) : (
            <div className="space-y-2">
              {plex.map((subscription) => (
                <div
                  key={subscription.id}
                  className="flex items-start justify-between gap-2 rounded border bg-background px-2 py-2"
                >
                  <div className="space-y-0.5 flex-1">
                    <div>
                      Expires:{" "}
                      {new Date(subscription.expiresAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </div>
                    {subscription.notes && (
                      <div className="text-[11px] text-muted-foreground">
                        {subscription.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <PlexExtendPopover plex={subscription} accountId={accountId} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => void handleDelete(subscription.id)}
                      disabled={deletePlex.isPending}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {plex.length < 1 && (
            <>
              <Separator />
              <div className="grid gap-2 md:grid-cols-[1.2fr,1.8fr,auto]">
                <div className="space-y-1">
                  <Label htmlFor={`expires-${accountId}`}>Expires at</Label>
                  <Input
                    id={`expires-${accountId}`}
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`notes-${accountId}`}>Notes</Label>
                  <Input
                    id={`notes-${accountId}`}
                    placeholder="Optional"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => void handleCreate()}
                    disabled={createPlex.isPending}
                  >
                    {createPlex.isPending ? "Saving…" : "Add"}
                  </Button>
                </div>
              </div>
            </>
          )}
          {plex.length >= 1 && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground text-center py-2">
                Maximum of 1 PLEX period per account. Delete the existing one to
                add a new period.
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MctExtendPopover({
  slot,
  accountId,
}: {
  slot: EveAccountMct;
  accountId: string;
}) {
  const updateMct = useUpdateMct(accountId);
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState<string>("");

  const handleExtendPreset = async (days: number) => {
    const currentExpiry = new Date(slot.expiresAt);
    if (Number.isNaN(currentExpiry.getTime())) {
      toast.error("Invalid expiry date");
      return;
    }

    const extended = new Date(
      currentExpiry.getTime() + days * 24 * 60 * 60 * 1000,
    );
    const extendedDateOnly = extended.toISOString().slice(0, 10);

    try {
      await updateMct.mutateAsync({
        slotId: slot.id,
        expiresAt: extendedDateOnly,
        notes: slot.notes,
      });
      toast.success(`MCT slot extended by ${days} days`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExtendCustom = async () => {
    if (!customDate) {
      toast.error("Please pick a date");
      return;
    }

    try {
      await updateMct.mutateAsync({
        slotId: slot.id,
        expiresAt: customDate,
        notes: slot.notes,
      });
      toast.success("MCT slot updated");
      setOpen(false);
      setCustomDate("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[11px]"
          disabled={updateMct.isPending}
        >
          <Clock className="h-3 w-3 mr-1" />
          Extend
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold">Preset durations</p>
            <div className="grid gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="justify-start h-8 text-xs"
                onClick={() => void handleExtendPreset(30)}
                disabled={updateMct.isPending}
              >
                1 month (+30d)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="justify-start h-8 text-xs"
                onClick={() => void handleExtendPreset(90)}
                disabled={updateMct.isPending}
              >
                3 months (+90d)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="justify-start h-8 text-xs"
                onClick={() => void handleExtendPreset(180)}
                disabled={updateMct.isPending}
              >
                6 months (+180d)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="justify-start h-8 text-xs"
                onClick={() => void handleExtendPreset(365)}
                disabled={updateMct.isPending}
              >
                12 months (+365d)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="justify-start h-8 text-xs"
                onClick={() => void handleExtendPreset(730)}
                disabled={updateMct.isPending}
              >
                24 months (+730d)
              </Button>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="custom-mct-date" className="text-xs">
              Custom date
            </Label>
            <Input
              id="custom-mct-date"
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              className="w-full h-8"
              onClick={() => void handleExtendCustom()}
              disabled={updateMct.isPending || !customDate}
            >
              Set custom date
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AccountMctDialog({
  accountId,
  open,
  onOpenChange,
}: {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: slots = [] } = useAccountMct(accountId);
  const createMct = useCreateMct(accountId);
  const deleteMct = useDeleteMct(accountId);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const handleCreate = async () => {
    if (!expiresAt) {
      toast.error("Please pick an expiry date");
      return;
    }
    try {
      await createMct.mutateAsync({
        expiresAt,
        notes: notes || undefined,
      });
      setExpiresAt("");
      setNotes("");
      toast.success("MCT slot saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMct.mutateAsync(id);
      toast.success("MCT slot deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>MCT slots</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          {slots.length === 0 ? (
            <p className="text-muted-foreground">
              No MCT slots recorded for this account yet.
            </p>
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1"
                >
                  <div className="space-y-0.5">
                    <div>
                      Expires on{" "}
                      {new Date(slot.expiresAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}{" "}
                      (EVE Time)
                    </div>
                    {slot.notes && (
                      <div className="text-[11px] text-muted-foreground">
                        {slot.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <MctExtendPopover slot={slot} accountId={accountId} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => void handleDelete(slot.id)}
                      disabled={deleteMct.isPending}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {slots.length < 2 && (
            <>
              <Separator />
              <div className="grid gap-2 md:grid-cols-[1.2fr,1.8fr,auto]">
                <div className="space-y-1">
                  <Label htmlFor={`mct-expires-${accountId}`}>Expires on</Label>
                  <Input
                    id={`mct-expires-${accountId}`}
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`mct-notes-${accountId}`}>Notes</Label>
                  <Input
                    id={`mct-notes-${accountId}`}
                    placeholder="Optional"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => void handleCreate()}
                    disabled={createMct.isPending}
                  >
                    {createMct.isPending ? "Saving…" : "Add"}
                  </Button>
                </div>
              </div>
            </>
          )}
          {slots.length >= 2 && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground text-center py-2">
                Maximum of 2 MCT slots per account. Delete an existing slot to add
                a new one.
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
