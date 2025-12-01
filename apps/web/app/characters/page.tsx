"use client";

import { useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  Star,
  Minus,
  ChevronDown,
  Play,
  Pause,
  Trash2,
  Clock,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import { Badge } from "@eve/ui";
import { Button } from "@eve/ui";
import { Input } from "@eve/ui";
import { Label } from "@eve/ui";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@eve/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@eve/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@eve/ui";
import { Separator } from "@eve/ui";
import { Skeleton } from "@eve/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@eve/ui";
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
} from "@eve/ui";
import {
  useCurrentUser,
  useMyCharacters,
  useSetPrimaryCharacter,
  useUnlinkCharacter,
  startCharacterLink,
  useUserFeatures,
  useUpdateUserFeatures,
} from "../tradecraft/api/characters/users.hooks";
import {
  useCharacterOverview,
  useMyAccounts,
  useAccountPlex,
  useCreatePlexSubscription,
  useUpdatePlexSubscription,
  useDeletePlexSubscription,
  useCharacterBoosters,
  useCreateBooster,
  useUpdateBooster,
  useDeleteBooster,
  useCreateAccount,
  useAssignCharacterToAccount,
  useUnassignCharacterFromAccount,
  useAccountMct,
  useCreateMct,
  useUpdateMct,
  useDeleteMct,
  useCharacterTrainingQueue,
  useCharacterSkills,
  useDeleteAccount,
} from "./api";
import type {
  CharacterOverview,
  EveAccountPlex,
  EveAccountMct,
  CharacterBooster,
} from "./api";
import type { CharacterTrainingQueueSummary } from "@eve/api-contracts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CharactersHome() {
  const { data: me } = useCurrentUser();
  const { data: features } = useUserFeatures();
  const { data: linkedChars = [], isLoading: linkedCharsLoading } =
    useMyCharacters();
  const { data: overview, isLoading: overviewLoading } = useCharacterOverview();
  const { data: accountsData, isLoading: accountsLoading } = useMyAccounts();

  const setPrimaryMutation = useSetPrimaryCharacter();
  const unlinkMutation = useUnlinkCharacter();
  const updateFeatures = useUpdateUserFeatures();

  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedAccounts, setCollapsedAccounts] = useState<Set<string>>(
    new Set(),
  );
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const enabledFeatures = features?.enabledFeatures ?? [];

  const toggleFeature = (key: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSaveFeatures = async () => {
    try {
      const next = selectedFeatures.length ? selectedFeatures : enabledFeatures;
      await updateFeatures.mutateAsync(next);
      toast.success("App access updated");
      setFeatureDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleAccountCollapse = (accountId: string) => {
    setCollapsedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const primaryChar =
    linkedChars.find((c) => c.isPrimary) ?? linkedChars[0] ?? null;

  const accounts = useMemo(
    () => accountsData?.accounts ?? [],
    [accountsData?.accounts],
  );
  const unassigned = accountsData?.unassignedCharacters ?? [];
  const overviewCharacters = overview?.characters ?? [];
  const isHeroLoading =
    overviewLoading || accountsLoading || linkedCharsLoading;

  const totalWallet = (overview?.characters ?? []).reduce(
    (sum, c) => sum + (c.walletBalanceIsk ?? 0),
    0,
  );

  // Filter accounts and characters by search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;

    return accounts
      .map((account) => ({
        ...account,
        characters: account.characters.filter((char) =>
          char.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      }))
      .filter((account) => account.characters.length > 0);
  }, [accounts, searchQuery]);

  const totalFilteredCharacters = useMemo(
    () => filteredAccounts.reduce((sum, a) => sum + a.characters.length, 0),
    [filteredAccounts],
  );

  const handleSetPrimary = async (id: number) => {
    try {
      await setPrimaryMutation.mutateAsync(id);
      toast.success("Primary character updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUnlink = async (id: number) => {
    try {
      await unlinkMutation.mutateAsync(id);
      toast.success("Character unlinked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleStartLink = () => {
    startCharacterLink(window.location.href);
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Characters
          </h1>
          <p className="text-sm text-foreground/70">
            Manage linked characters, assign accounts, track boosters, and
            control subscriptions.
          </p>
        </div>
      </div>
      <section className="flex flex-col gap-4 md:flex-row md:items-stretch">
        <Card className="flex-1 bg-gradient-to-br from-background to-muted/20 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/20 text-primary shadow-sm">
                <Users className="h-6 w-6" />
              </span>
              Character Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground/80">
              Central place to link your EVE characters, choose a primary, and
              manage accounts, PLEX, and boosters.
            </p>
            <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
              <div className="space-y-1 min-w-0">
                <div className="text-xs text-foreground/80">
                  Linked characters
                </div>
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {isHeroLoading ? (
                    <Skeleton className="h-7 w-16 rounded-md" />
                  ) : (
                    linkedChars.length
                  )}
                </div>
              </div>
              <div className="space-y-1 min-w-0">
                <div className="text-xs text-foreground/80">Accounts</div>
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {isHeroLoading ? (
                    <Skeleton className="h-7 w-16 rounded-md" />
                  ) : (
                    accounts.length
                  )}
                </div>
              </div>
              <div className="space-y-1 min-w-0 overflow-hidden">
                <div className="text-xs text-foreground/80 whitespace-nowrap">
                  Total wallet (ISK)
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-foreground leading-tight break-all sm:text-xl lg:text-2xl">
                  {isHeroLoading ? (
                    <Skeleton className="h-7 w-32 rounded-md" />
                  ) : (
                    totalWallet.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="w-full md:w-96 bg-gradient-to-br from-background to-muted/20 shadow-md">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              onClick={handleStartLink}
              className="whitespace-nowrap shadow-sm"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Link character
            </Button>
            <Dialog
              open={featureDialogOpen}
              onOpenChange={setFeatureDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="whitespace-nowrap shadow-sm"
                >
                  App access
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle>App access</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <p className="text-foreground/70">
                    Choose which parts of the app you want this account to use.
                    Linking characters will request ESI scopes for the selected
                    app areas.
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                      <span className="text-sm font-medium">Characters</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={
                          selectedFeatures.length
                            ? selectedFeatures.includes("CHARACTERS")
                            : enabledFeatures.includes("CHARACTERS")
                        }
                        onChange={() => toggleFeature("CHARACTERS")}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                      <span className="text-sm font-medium">Tradecraft</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={
                          selectedFeatures.length
                            ? selectedFeatures.includes("TRADECRAFT")
                            : enabledFeatures.length === 0 ||
                              enabledFeatures.includes("TRADECRAFT")
                        }
                        onChange={() => toggleFeature("TRADECRAFT")}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-foreground/60">
                    You can change these options later. New scopes are requested
                    the next time you link a character.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFeatureDialogOpen(false)}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleSaveFeatures()}
                    disabled={updateFeatures.isPending}
                  >
                    {updateFeatures.isPending ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {linkedCharsLoading ? (
              <div className="mt-2 flex items-center gap-3 rounded-lg border bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1 min-w-0 flex-1">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-40 rounded" />
                </div>
              </div>
            ) : primaryChar ? (
              <div className="mt-2 flex items-center gap-3 rounded-lg border bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm">
                <Avatar className="h-10 w-10 rounded-lg shadow-md ring-1 ring-background">
                  <AvatarImage
                    src={`https://image.eveonline.com/Character/${primaryChar.id}_128.jpg`}
                    alt={primaryChar.name}
                  />
                  <AvatarFallback className="rounded-lg">
                    {primaryChar.name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">
                      {primaryChar.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="gap-1 shrink-0 shadow-sm"
                    >
                      <Star className="h-3 w-3" />
                      Primary
                    </Badge>
                  </div>
                  {me && (
                    <p className="text-xs text-foreground/70 truncate">
                      Logged in as {me.characterName}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <Card className="shadow-md bg-gradient-to-b from-background to-muted/10">
          <CardHeader className="space-y-4">
            <div className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Accounts & characters</CardTitle>
              <NewAccountDialog
                unassigned={unassigned.map((c) => ({
                  id: c.id,
                  name: c.name,
                }))}
              />
            </div>
            {accounts.length > 0 && (
              <div className="space-y-2">
                <Input
                  type="search"
                  placeholder="Search characters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
                {searchQuery && (
                  <p className="text-sm text-muted-foreground">
                    Found {totalFilteredCharacters} character(s) matching&nbsp;
                    &quot;{searchQuery}&quot;
                  </p>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            {accountsLoading ? (
              <AccountsSkeleton />
            ) : filteredAccounts.length === 0 && searchQuery ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users className="mb-3 h-10 w-10 text-foreground/50" />
                <p className="text-sm text-foreground/80 font-medium mb-1">
                  No characters found
                </p>
                <p className="text-sm text-foreground/60">
                  Try a different search term or clear the filter
                </p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users className="mb-3 h-10 w-10 text-foreground/50" />
                <p className="text-sm text-foreground/70">
                  No accounts created yet. Link a character, then create
                  accounts and assign characters to them.
                </p>
              </div>
            ) : (
              filteredAccounts.map((account, index) => (
                <div key={account.id} className="space-y-4">
                  {index > 0 && (
                    <Separator className="my-4 bg-gradient-to-r from-transparent via-border to-transparent" />
                  )}
                  <div className="space-y-4">
                    {/* Account header */}
                    <div className="space-y-3 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 p-4 shadow-sm border">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => toggleAccountCollapse(account.id)}
                          className="flex flex-1 items-center justify-between text-left hover:opacity-80 transition-opacity"
                        >
                          <h3 className="text-xl font-bold">
                            {account.label || "Account"}
                          </h3>
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 transition-transform duration-200",
                              collapsedAccounts.has(account.id) && "rotate-180",
                            )}
                          />
                        </button>
                        <DeleteAccountButton accountId={account.id} />
                      </div>
                      {!collapsedAccounts.has(account.id) && (
                        <AccountStatusSummary
                          accountId={account.id}
                          plex={account.plex ?? null}
                        />
                      )}
                    </div>
                    {/* Character cards grid */}
                    {!collapsedAccounts.has(account.id) &&
                      account.characters.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {account.characters.map((char) => {
                            const primaryMatch = linkedChars.find(
                              (c) => c.id === char.id && c.isPrimary,
                            );
                            const isPrimary = !!primaryMatch;
                            return (
                              <CharacterCardDisplay
                                key={char.id}
                                char={char}
                                isPrimary={isPrimary}
                                accountId={account.id}
                                overviewCharacters={overviewCharacters}
                                onSetPrimary={handleSetPrimary}
                                onUnlink={handleUnlink}
                                setPrimaryPending={setPrimaryMutation.isPending}
                                unlinkPending={unlinkMutation.isPending}
                              />
                            );
                          })}
                        </div>
                      )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <UnassignedCharactersCard characters={unassigned} accounts={accounts} />
      </section>
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1].map((group) => (
        <div key={group} className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
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
              {plex.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-2 rounded border bg-background px-2 py-2"
                >
                  <div className="space-y-0.5 flex-1">
                    <div>
                      Expires:{" "}
                      {new Date(p.expiresAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </div>
                    {p.notes && (
                      <div className="text-[11px] text-muted-foreground">
                        {p.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <PlexExtendPopover plex={p} accountId={accountId} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => void handleDelete(p.id)}
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
              {slots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1"
                >
                  <div className="space-y-0.5">
                    <div>
                      Expires on{" "}
                      {new Date(s.expiresAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}{" "}
                      (EVE Time)
                    </div>
                    {s.notes && (
                      <div className="text-[11px] text-muted-foreground">
                        {s.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <MctExtendPopover slot={s} accountId={accountId} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => void handleDelete(s.id)}
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
                Maximum of 2 MCT slots per account. Delete an existing slot to
                add a new one.
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

function AccountStatusSummary({
  accountId,
  plex,
}: {
  accountId: string;
  plex: {
    expiresAt: string;
    daysRemaining: number | null;
    status: "none" | "active" | "expired" | "upcoming";
  } | null;
}) {
  const { data: mctSlots = [] } = useAccountMct(accountId);
  const [plexDialogOpen, setPlexDialogOpen] = useState(false);
  const [mctDialogOpen, setMctDialogOpen] = useState(false);

  const now = Date.now();

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-4 text-sm sm:flex-nowrap sm:items-center sm:gap-8">
        {/* PLEX Section */}
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

        {/* MCT Section */}
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
                    <span
                      className={cn("font-semibold text-sm", getColorClass())}
                    >
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

function BoosterRenewDialog({
  booster,
  characterId,
}: {
  booster: CharacterBooster;
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
            Set new duration for <strong>{booster.boosterName}</strong>. This
            will override any remaining time.
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
              {boosters.map((b) => (
                <div
                  key={b.id}
                  className="flex items-start justify-between gap-2 rounded border bg-background px-2 py-2"
                >
                  <div className="space-y-0.5 flex-1">
                    <div className="font-medium">{b.boosterName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Until{" "}
                      {new Date(b.expiresAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}{" "}
                      ({b.status})
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <BoosterRenewDialog booster={b} characterId={characterId} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => void handleDelete(b.id)}
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
                  <Label htmlFor={`booster-days-${characterId}`}>
                    Days left
                  </Label>
                  <Input
                    id={`booster-days-${characterId}`}
                    type="number"
                    min={0}
                    value={daysLeft}
                    onChange={(e) => setDaysLeft(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`booster-hours-${characterId}`}>
                    Hours left
                  </Label>
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
                Maximum of 1 active booster per character. Delete or wait for
                the existing one to expire before adding a new booster.
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

function UnassignedCharactersCard({
  characters,
  accounts,
}: {
  characters: { id: number; name: string; tokenStatus: string }[];
  accounts: { id: string; label: string | null }[];
}) {
  const assign = useAssignCharacterToAccount();
  const unlink = useUnlinkCharacter();

  const handleAssign = async (characterId: number, accountId: string) => {
    if (!accountId) {
      toast.error("Choose an account");
      return;
    }
    try {
      await assign.mutateAsync({ accountId, characterId });
      toast.success("Character assigned to account");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUnlink = async (characterId: number) => {
    try {
      await unlink.mutateAsync(characterId);
      toast.success("Character unlinked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unassigned characters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {characters.length === 0 ? (
          <p className="text-muted-foreground">
            All characters are currently assigned to accounts.
          </p>
        ) : (
          characters.map((char) => (
            <div
              key={char.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-background p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={`https://image.eveonline.com/Character/${char.id}_128.jpg`}
                    alt={char.name}
                  />
                  <AvatarFallback className="rounded-lg">
                    {char.name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{char.name}</div>
                  <p className="text-[11px]">
                    Token: {char.tokenStatus ?? "unknown"}
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <AssignCharacterToAccountSelect
                  characterId={char.id}
                  accounts={accounts}
                  onAssign={handleAssign}
                  disabled={assign.isPending}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-9"
                  onClick={() => void handleUnlink(char.id)}
                  disabled={unlink.isPending}
                >
                  Unlink
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AssignCharacterToAccountSelect({
  characterId,
  accounts,
  onAssign,
  disabled,
}: {
  characterId: number;
  accounts: { id: string; label: string | null }[];
  onAssign: (characterId: number, accountId: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [accountId, setAccountId] = useState<string>("");

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor={`assign-${characterId}`}>Account</Label>
        <select
          id={`assign-${characterId}`}
          className="w-40 rounded-md border bg-background px-2 py-1 text-xs"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">Choose…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label || "Account"}
            </option>
          ))}
        </select>
      </div>
      <Button
        size="sm"
        className="text-xs"
        onClick={() => void onAssign(characterId, accountId)}
        disabled={disabled || !accountId}
      >
        Assign
      </Button>
    </div>
  );
}

function DeleteAccountButton({ accountId }: { accountId: string }) {
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

function CharacterCardDisplay({
  char,
  isPrimary,
  accountId,
  overviewCharacters,
  onSetPrimary,
  onUnlink,
  setPrimaryPending,
  unlinkPending,
}: {
  char: { id: number; name: string; tokenStatus: string };
  isPrimary: boolean;
  accountId: string;
  overviewCharacters: CharacterOverview[];
  onSetPrimary: (id: number) => void | Promise<void>;
  onUnlink: (id: number) => void | Promise<void>;
  setPrimaryPending: boolean;
  unlinkPending: boolean;
}) {
  const { data: boosters = [] } = useCharacterBoosters(char.id);
  const activeBooster = boosters.find((b) => b.status === "active");
  const { data: trainingQueue, isLoading: trainingQueueLoading } =
    useCharacterTrainingQueue(char.id);
  const { data: skillSnapshot, isLoading: skillsLoading } = useCharacterSkills(
    char.id,
  );

  const overview = overviewCharacters.find((oc) => oc.id === char.id);
  const totalSkillPoints = skillSnapshot?.totalSp ?? null;
  const unallocatedSp = skillSnapshot?.unallocatedSp ?? null;

  const getTimeRemaining = (expiresAt: string) => {
    const now = Date.now();
    const expiry = new Date(expiresAt).getTime();
    const diffMs = expiry - now;

    if (diffMs <= 0) return { text: "Expired", days: 0 };

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let text: string;
    if (days > 0) {
      text = `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
      text = `${hours}h ${minutes}m remaining`;
    } else {
      text = `${minutes}m remaining`;
    }

    return { text, days };
  };

  const getExpiryColorClass = (days: number) => {
    if (days <= 3) return "text-destructive";
    if (days <= 15) return "text-amber-500 dark:text-amber-400";
    return "text-foreground/80";
  };

  const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(" ");
  };

  const formatNumber = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const getTrainingProgressPercent = (
    entry: CharacterTrainingQueueSummary["activeEntry"] | null | undefined,
  ) => {
    if (!entry) return 0;
    if (entry.startDate && entry.finishDate) {
      const start = new Date(entry.startDate).getTime();
      const end = new Date(entry.finishDate).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        const pct = ((Date.now() - start) / (end - start)) * 100;
        return Math.min(100, Math.max(0, pct));
      }
    }
    return 0;
  };

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
        <p className="text-sm font-semibold text-foreground">
          Skill queue is empty
        </p>
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
            Math.round(
              (new Date(entry.finishDate).getTime() - Date.now()) / 1000,
            ),
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
          <p className="text-sm font-semibold text-foreground truncate">
            {skillLabel}
          </p>
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
              {char.name
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)}
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
                  {formatNumber(totalSkillPoints)} SP
                </p>
                <p className="text-xs text-foreground/60 min-h-[18px]">
                  {unallocatedSp != null && unallocatedSp > 0
                    ? `${formatNumber(unallocatedSp)} unallocated`
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
            <TooltipContent>
              Remove this character from your account
            </TooltipContent>
          </Tooltip>
          <CharacterBoostersDialog
            characterId={char.id}
            characterName={char.name}
          />
          <UnassignCharacterButton
            accountId={accountId}
            characterId={char.id}
          />
        </div>
      </CardContent>
    </Card>
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

function NewAccountDialog({
  unassigned,
}: {
  unassigned: { id: number; name: string }[];
}) {
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
