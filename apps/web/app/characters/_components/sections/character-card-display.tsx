"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Separator,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from "@eve/ui";
import { Clock, Minus, Pause, Play, Star } from "lucide-react";
import { useState } from "react";
import type { CharacterOverview } from "../../api";
import {
  useCharacterBoosters,
  useCharacterSkills,
  useCharacterTrainingQueue,
  useCreateBooster,
  useDeleteBooster,
  useUnassignCharacterFromAccount,
  useUpdateBooster,
} from "../../api";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatWholeNumber,
  getCharacterInitials,
  getExpiryColorClass,
  getTimeRemaining,
  getTrainingProgressPercent,
} from "../lib/character-utils";

type CharacterCardDisplayProps = {
  char: { id: number; name: string; tokenStatus: string };
  isPrimary: boolean;
  accountId: string;
  overviewCharacters: CharacterOverview[];
  onSetPrimary: (id: number) => void | Promise<void>;
  onUnlink: (id: number) => void | Promise<void>;
  setPrimaryPending: boolean;
  unlinkPending: boolean;
};

export function CharacterCardDisplay({
  char,
  isPrimary,
  accountId,
  overviewCharacters,
  onSetPrimary,
  onUnlink,
  setPrimaryPending,
  unlinkPending,
}: CharacterCardDisplayProps) {
  const { data: boosters = [] } = useCharacterBoosters(char.id);
  const activeBooster = boosters.find((booster) => booster.status === "active");
  const { data: trainingQueue, isLoading: trainingQueueLoading } =
    useCharacterTrainingQueue(char.id);
  const { data: skillSnapshot, isLoading: skillsLoading } = useCharacterSkills(
    char.id,
  );

  const overview = overviewCharacters.find((item) => item.id === char.id);
  const totalSkillPoints = skillSnapshot?.totalSp ?? null;
  const unallocatedSp = skillSnapshot?.unallocatedSp ?? null;

  const renderQueueContent = () => {
    if (trainingQueueLoading) {
      return <Skeleton className="h-4 w-24" />;
    }

    if (!trainingQueue) {
      return (
        <p className="text-xs text-foreground/60">
          Unable to load the skill queue. Re-link this character with the
          skillqueue scope.
        </p>
      );
    }

    if (trainingQueue.isQueueEmpty) {
      return (
        <p className="text-sm font-semibold text-foreground">Skill queue is empty</p>
      );
    }

    const entry = trainingQueue.activeEntry ?? trainingQueue.entries[0] ?? null;

    if (!entry) {
      return (
        <p className="text-xs text-foreground/60">
          Queue data unavailable. Try refreshing later.
        </p>
      );
    }

    const remainingSeconds =
      entry.finishDate != null
        ? Math.max(
            0,
            Math.round((new Date(entry.finishDate).getTime() - Date.now()) / 1000),
          )
        : null;
    const progressPercent = getTrainingProgressPercent(entry);
    const skillLabel = `${entry.skillName ?? `Skill ${entry.skillId}`}${
      entry.levelEnd ? ` • Level ${entry.levelEnd}` : ""
    }`;
    const statusText = trainingQueue.isPaused
      ? "Queue paused"
      : remainingSeconds != null
        ? `${formatDuration(remainingSeconds)} remaining`
        : entry.startDate
          ? "In progress"
          : "Waiting to start";
    const additionalQueued = trainingQueue.entries.length - 1;

    return (
      <div className="space-y-1.5">
        <div>
          <p className="text-sm font-semibold text-foreground truncate">{skillLabel}</p>
          <p className="text-xs text-foreground/60">{statusText}</p>
        </div>
        <TrainingProgressBar value={progressPercent} />
        <p className="text-[11px] text-foreground/50 min-h-[16px]">
          {additionalQueued > 0
            ? `${additionalQueued} more skill${additionalQueued === 1 ? "" : "s"} queued`
            : "\u00A0"}
        </p>
      </div>
    );
  };

  const queueContent = renderQueueContent();
  const queueStateColorClass = trainingQueue?.isTraining
    ? "text-emerald-400 border-emerald-500/40"
    : trainingQueue?.isPaused
      ? "text-amber-400 border-amber-500/40"
      : "text-foreground/40 border-foreground/15";
  const queueStatusLabel = trainingQueue?.isTraining
    ? "Training"
    : trainingQueue?.isPaused
      ? "Paused"
      : trainingQueue?.isQueueEmpty
        ? "Empty"
        : trainingQueue
          ? "Pending"
          : "Unavailable";
  const QueueStateIcon = trainingQueue?.isTraining ? Play : Pause;

  return (
    <Card className="overflow-hidden hover:border-primary/30 transition-all hover:shadow-lg bg-gradient-to-b from-background to-muted/20 shadow-md">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-16 w-16 rounded-xl border shadow-lg ring-1 ring-background">
            <AvatarImage
              src={`https://image.eveonline.com/Character/${char.id}_256.jpg`}
              alt={char.name}
            />
            <AvatarFallback className="rounded-xl text-base font-semibold bg-gradient-to-br from-primary/20 to-primary/5">
              {getCharacterInitials(char.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold truncate">{char.name}</span>
              {isPrimary && (
                <Badge
                  variant="default"
                  className="gap-1 text-xs h-6 px-2 shadow-sm"
                >
                  <Star className="h-3 w-3 fill-current" />
                  Primary
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-0.5 min-h-[44px]">
              {activeBooster ? (
                <>
                  <Badge variant="secondary" className="text-xs w-fit">
                    {activeBooster.boosterName}
                  </Badge>
                  {(() => {
                    const timeInfo = getTimeRemaining(activeBooster.expiresAt);
                    return (
                      <p
                        className={cn(
                          "text-xs font-semibold",
                          getExpiryColorClass(timeInfo.days),
                        )}
                      >
                        {timeInfo.text}
                      </p>
                    );
                  })()}
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-foreground/40">
                  <Minus className="h-3 w-3" />
                  <span>No booster</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-foreground/80">Corporation</span>
            <span className="font-semibold text-right">
              {overview?.corporationName ?? "Unknown"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-foreground/80">Alliance</span>
            <span className="font-semibold text-right">
              {overview?.allianceName ?? "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-foreground/80">Wallet</span>
            <span className="font-semibold font-mono text-right">
              {overview?.walletBalanceIsk != null
                ? `${overview.walletBalanceIsk.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })} ISK`
                : "—"}
            </span>
          </div>
        </div>

        <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5 min-h-[88px]">
            <p className="text-xs text-foreground/60">Skill points</p>
            {skillsLoading ? (
              <Skeleton className="h-5 w-28" />
            ) : totalSkillPoints != null ? (
              <>
                <p className="text-base font-semibold tabular-nums">
                  {formatWholeNumber(totalSkillPoints)} SP
                </p>
                <p className="text-xs text-foreground/60 min-h-[18px]">
                  {unallocatedSp != null && unallocatedSp > 0
                    ? `${formatWholeNumber(unallocatedSp)} unallocated`
                    : "\u00A0"}
                </p>
              </>
            ) : (
              <p className="text-xs text-foreground/60">
                Skill data unavailable. Re-link this character with the skills
                scope.
              </p>
            )}
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2 h-[124px] flex flex-col">
            <div className="flex items-center gap-2 text-xs text-foreground/60">
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border flex-shrink-0",
                  queueStateColorClass,
                )}
              >
                <QueueStateIcon className="h-3 w-3" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {queueStatusLabel}
              </span>
            </div>
            <div className="flex-1">{queueContent}</div>
          </div>
        </div>

        <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="grid grid-cols-2 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isPrimary ? "default" : "outline"}
                className={cn(
                  "text-xs h-9 shadow-sm",
                  isPrimary && "opacity-60 cursor-not-allowed",
                )}
                onClick={() => void onSetPrimary(char.id)}
                disabled={isPrimary || setPrimaryPending}
              >
                <Star className="mr-1.5 h-3 w-3" />
                {isPrimary ? "Primary" : "Set primary"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isPrimary
                ? "This is your primary character"
                : "Set as primary character for login"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-9"
                onClick={() => void onUnlink(char.id)}
                disabled={unlinkPending}
              >
                Unlink
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove this character from your account</TooltipContent>
          </Tooltip>
          <CharacterBoostersDialog characterId={char.id} characterName={char.name} />
          <UnassignCharacterButton accountId={accountId} characterId={char.id} />
        </div>
      </CardContent>
    </Card>
  );
}

function BoosterRenewDialog({
  booster,
  characterId,
}: {
  booster: { id: string; boosterName: string };
  characterId: number;
}) {
  const updateBooster = useUpdateBooster(characterId);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<string>("");
  const [hours, setHours] = useState<string>("");

  const handleRenew = async () => {
    const daysNum = Number(days || "0");
    const hoursNum = Number(hours || "0");

    if (isNaN(daysNum) || isNaN(hoursNum) || (daysNum <= 0 && hoursNum <= 0)) {
      toast.error("Please enter a valid duration");
      return;
    }

    const totalHours = daysNum * 24 + hoursNum;
    if (totalHours <= 0) {
      toast.error("Duration must be greater than 0");
      return;
    }

    const newExpiresAt = new Date(Date.now() + totalHours * 60 * 60 * 1000);

    try {
      await updateBooster.mutateAsync({
        boosterId: booster.id,
        startsAt: new Date().toISOString(),
        expiresAt: newExpiresAt.toISOString(),
      });
      toast.success("Booster renewed");
      setOpen(false);
      setDays("");
      setHours("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">
          <Clock className="h-3 w-3 mr-1" />
          Renew
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle>Renew Booster</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Set new duration for <strong>{booster.boosterName}</strong>. This will
            override any remaining time.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="renew-days" className="text-xs">
                Days
              </Label>
              <Input
                id="renew-days"
                type="number"
                min={0}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="renew-hours" className="text-xs">
                Hours
              </Label>
              <Input
                id="renew-hours"
                type="number"
                min={0}
                max={23}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleRenew()}
            disabled={updateBooster.isPending}
          >
            {updateBooster.isPending ? "Renewing…" : "Renew"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CharacterBoostersDialog({
  characterId,
  characterName,
}: {
  characterId: number;
  characterName: string;
}) {
  const { data: boosters = [] } = useCharacterBoosters(characterId);
  const createBooster = useCreateBooster(characterId);
  const deleteBooster = useDeleteBooster(characterId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string>("");
  const [daysLeft, setDaysLeft] = useState<string>("");
  const [hoursLeft, setHoursLeft] = useState<string>("");

  const handleCreate = async () => {
    const days = Number(daysLeft || "0");
    const hours = Number(hoursLeft || "0");
    if (!name || (isNaN(days) && isNaN(hours)) || (days <= 0 && hours <= 0)) {
      toast.error("Booster name and remaining time are required");
      return;
    }

    const totalHours = days * 24 + hours;
    if (totalHours <= 0) {
      toast.error("Remaining time must be greater than 0");
      return;
    }

    const expiresAtDate = new Date(Date.now() + totalHours * 60 * 60 * 1000);

    try {
      await createBooster.mutateAsync({
        boosterName: name,
        expiresAt: expiresAtDate.toISOString(),
      });
      setName("");
      setDaysLeft("");
      setHoursLeft("");
      toast.success("Booster saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBooster.mutateAsync(id);
      toast.success("Booster deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs h-9">
              Boosters
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Manage cerebral accelerators and skill boosters
        </TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Boosters for {characterName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          {boosters.length === 0 ? (
            <p className="text-muted-foreground">
              No boosters recorded for this character yet.
            </p>
          ) : (
            <div className="space-y-2">
              {boosters.map((booster) => (
                <div
                  key={booster.id}
                  className="flex items-start justify-between gap-2 rounded border bg-background px-2 py-2"
                >
                  <div className="space-y-0.5 flex-1">
                    <div className="font-medium">{booster.boosterName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Until{" "}
                      {new Date(booster.expiresAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}{" "}
                      ({booster.status})
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <BoosterRenewDialog booster={booster} characterId={characterId} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => void handleDelete(booster.id)}
                      disabled={deleteBooster.isPending}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {boosters.length < 1 && (
            <>
              <Separator />
              <div className="grid gap-2 md:grid-cols-[1.4fr,0.9fr,0.9fr,auto]">
                <div className="space-y-1">
                  <Label htmlFor={`booster-name-${characterId}`}>
                    Booster name
                  </Label>
                  <Input
                    id={`booster-name-${characterId}`}
                    placeholder="Example: Cerebral Accelerator"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`booster-days-${characterId}`}>Days left</Label>
                  <Input
                    id={`booster-days-${characterId}`}
                    type="number"
                    min={0}
                    value={daysLeft}
                    onChange={(e) => setDaysLeft(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`booster-hours-${characterId}`}>Hours left</Label>
                  <Input
                    id={`booster-hours-${characterId}`}
                    type="number"
                    min={0}
                    max={23}
                    value={hoursLeft}
                    onChange={(e) => setHoursLeft(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => void handleCreate()}
                    disabled={createBooster.isPending}
                  >
                    {createBooster.isPending ? "Saving…" : "Add"}
                  </Button>
                </div>
              </div>
            </>
          )}
          {boosters.length >= 1 && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground text-center py-2">
                Maximum of 1 active booster per character. Delete or wait for the
                existing one to expire before adding a new booster.
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnassignCharacterButton({
  accountId,
  characterId,
}: {
  accountId: string;
  characterId: number;
}) {
  const unassign = useUnassignCharacterFromAccount();

  const handleUnassign = async () => {
    try {
      await unassign.mutateAsync({ accountId, characterId });
      toast.success("Character removed from account");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-xs h-9"
      onClick={() => void handleUnassign()}
      disabled={unassign.isPending}
    >
      Remove
    </Button>
  );
}

function TrainingProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 rounded-full bg-foreground/10">
      <div
        className="h-2 rounded-full bg-primary transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
