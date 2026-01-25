"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import Link from "next/link";
import { useSkillFarmCharacters, useUpdateSkillFarmCharacter } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Badge } from "@eve/ui/badge";
import { Button } from "@eve/ui/button";
import { Input } from "@eve/ui/input";
import { Label } from "@eve/ui/label";
import { Switch } from "@eve/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eve/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@eve/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@eve/ui/tabs";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui/empty";
import { Skeleton } from "@eve/ui/skeleton";
import { toast } from "@eve/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@eve/ui/tooltip";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  Users,
  Info,
} from "lucide-react";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";

function RequirementBadge({
  label,
  status,
  details,
}: {
  label: string;
  status: "pass" | "fail" | "warning";
  details?: string | null;
}) {
  let variant: "default" | "secondary" | "outline" = "secondary";
  const icons = {
    pass: <CheckCircle2 className="h-3 w-3" />,
    warning: <AlertTriangle className="h-3 w-3" />,
    fail: <XCircle className="h-3 w-3" />,
  };

  if (status === "pass") {
    variant = "default";
  } else if (status === "fail") {
    // Use outline for failures; we rely on text and context, not color only.
    variant = "outline";
  }

  const badge = (
    <Badge
      variant={variant}
      className="flex items-center gap-1"
      data-status={status}
    >
      {icons[status]}
      {label}
    </Badge>
  );

  if (!details) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent sideOffset={8} className="max-w-xs">
        {details}
      </TooltipContent>
    </Tooltip>
  );
}

type FarmFilter = "all" | "active" | "ready" | "needs-work" | "candidates";
type FarmSort = "status" | "name" | "sp";

type RequirementSummary = {
  status: "pass" | "fail" | "warning";
  label: string;
  details?: string | null;
};

function getRequirementList(c: {
  requirements: {
    minSp: RequirementSummary;
    biology: RequirementSummary;
    cybernetics: RequirementSummary;
    remap: RequirementSummary;
    training: RequirementSummary;
    implants: RequirementSummary;
  };
}) {
  return [
    c.requirements.minSp,
    c.requirements.biology,
    c.requirements.cybernetics,
    c.requirements.remap,
    c.requirements.training,
    c.requirements.implants,
  ];
}

function CharactersContent() {
  const { data: chars = [], isLoading } = useSkillFarmCharacters();
  const updateCharacter = useUpdateSkillFarmCharacter();
  const [filter, setFilter] = React.useState<FarmFilter>("all");
  const [sort, setSort] = React.useState<FarmSort>("status");
  const [query, setQuery] = React.useState("");
  const [pendingCharacterId, setPendingCharacterId] = React.useState<
    number | null
  >(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkMode, setBulkMode] = React.useState<
    "activate-ready" | "deactivate-all"
  >("activate-ready");
  const [bulkPending, setBulkPending] = React.useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-gradient-to-b from-background to-muted/5">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-28" />
              </div>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!chars.length) {
    return (
      <Empty className="bg-gradient-to-b from-background to-muted/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No characters to evaluate yet</EmptyTitle>
          <EmptyDescription>
            Link your characters first, then return here to check skill-farm
            readiness and activate farms for Tracking.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/characters">Go to Characters</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();

  const computed = chars.map((c) => {
    const reqs = getRequirementList(c);
    const isReady = reqs.every((r) => r.status === "pass");
    const hasWarnings = reqs.some((r) => r.status === "warning");
    const blocking = reqs.filter((r) => r.status !== "pass");
    const isActive = c.config.isActive;
    const isCandidate = !!c.config.isCandidate;

    const statusLabel = isActive
      ? "Active farm"
      : isReady
        ? "Ready"
        : hasWarnings
          ? "Needs attention"
          : "Not ready";

    const statusVariant: "default" | "secondary" | "outline" = isActive
      ? "default"
      : isReady
        ? "secondary"
        : "outline";

    return {
      c,
      isReady,
      isActive,
      isCandidate,
      blocking,
      statusLabel,
      statusVariant,
    };
  });

  const counts = {
    total: computed.length,
    active: computed.filter((x) => x.isActive).length,
    ready: computed.filter((x) => x.isReady && !x.isActive).length,
    needsWork: computed.filter((x) => !x.isReady && !x.isActive).length,
    candidates: computed.filter((x) => x.isCandidate).length,
  };

  const isBusy = pendingCharacterId !== null || bulkPending;
  const activateReadyTargets = computed.filter((x) => x.isReady && !x.isActive);
  const deactivateTargets = computed.filter((x) => x.isActive);

  const visibleUnsorted = computed
    .filter((x) => {
      if (!normalizedQuery) return true;
      return x.c.name.toLowerCase().includes(normalizedQuery);
    })
    .filter((x) => {
      if (filter === "all") return true;
      if (filter === "active") return x.isActive;
      if (filter === "ready") return x.isReady && !x.isActive;
      if (filter === "needs-work") return !x.isReady && !x.isActive;
      if (filter === "candidates") return x.isCandidate;
      return true;
    });

  const visible = [...visibleUnsorted].sort((a, b) => {
    if (sort === "name") return a.c.name.localeCompare(b.c.name);
    if (sort === "sp") return b.c.totalSp - a.c.totalSp;

    // default: status-first
    const statusRank = (x: (typeof visibleUnsorted)[number]) => {
      if (x.isActive) return 0;
      if (x.isReady) return 1;
      const hasWarning = x.blocking.some((r) => r.status === "warning");
      return hasWarning ? 2 : 3;
    };

    const r = statusRank(a) - statusRank(b);
    if (r !== 0) return r;

    // Within a status group, put "closest to ready" first
    const missingCount = (x: (typeof visibleUnsorted)[number]) =>
      x.blocking.length;
    const m = missingCount(a) - missingCount(b);
    if (m !== 0) return m;

    return a.c.name.localeCompare(b.c.name);
  });

  const bulkTitle =
    bulkMode === "activate-ready"
      ? "Activate all ready farms?"
      : "Deactivate all farms?";
  const bulkDescription =
    bulkMode === "activate-ready"
      ? `This will activate ${activateReadyTargets.length} character(s) that already meet all requirements.`
      : `This will remove ${deactivateTargets.length} active character(s) from Tracking.`;
  const bulkActionLabel =
    bulkMode === "activate-ready" ? "Activate ready farms" : "Deactivate all";

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-b from-background to-muted/10 p-4 md:p-6">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">At a glance</CardTitle>
              <p className="text-sm text-foreground/80">
                Activate farms here to control who appears in Tracking. Hover a
                requirement badge to see details, or expand a row for the full
                checklist.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline">
                <Link href="/characters/skills/plans">Skill plan</Link>
              </Button>
              <Button asChild>
                <Link href="/characters/skill-farms/tracking">
                  View tracking
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Active farms</div>
                <Sparkles className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="mt-1 text-2xl font-semibold">{counts.active}</div>
              <div className="text-xs text-foreground/80">
                Included on Tracking
              </div>
            </div>
            <div className="rounded-md border bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Ready to activate</div>
                <Target className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="mt-1 text-2xl font-semibold">{counts.ready}</div>
              <div className="text-xs text-foreground/80">
                Meet all requirements
              </div>
            </div>
            <div className="rounded-md border bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Needs work</div>
                <AlertTriangle className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {counts.needsWork}
              </div>
              <div className="text-xs text-foreground/80">
                Missing prerequisites
              </div>
            </div>
            <div className="rounded-md border bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Candidates</div>
                <Users className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {counts.candidates}
              </div>
              <div className="text-xs text-foreground/80">
                Marked for farming
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as FarmFilter)}
              className="w-full sm:w-auto"
            >
              <TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-1">
                <TabsTrigger value="all" className="flex-none">
                  All ({counts.total})
                </TabsTrigger>
                <TabsTrigger value="active" className="flex-none">
                  Active ({counts.active})
                </TabsTrigger>
                <TabsTrigger value="ready" className="flex-none">
                  Ready ({counts.ready})
                </TabsTrigger>
                <TabsTrigger value="needs-work" className="flex-none">
                  Needs work ({counts.needsWork})
                </TabsTrigger>
                <TabsTrigger value="candidates" className="flex-none">
                  Candidates ({counts.candidates})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="w-full sm:w-auto">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search characters…"
                  className="h-8 w-full text-sm sm:w-64 md:w-72"
                />
                <Select
                  value={sort}
                  onValueChange={(v) => setSort(v as FarmSort)}
                >
                  <Label className="sr-only" htmlFor="skill-farm-sort">
                    Sort
                  </Label>
                  <SelectTrigger
                    id="skill-farm-sort"
                    size="sm"
                    className="w-full sm:w-[160px]"
                  >
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="status">Sort: Status</SelectItem>
                    <SelectItem value="name">Sort: Name</SelectItem>
                    <SelectItem value="sp">Sort: SP</SelectItem>
                  </SelectContent>
                </Select>

                <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    variant="secondary"
                    disabled={isBusy || activateReadyTargets.length === 0}
                    onClick={() => {
                      setBulkMode("activate-ready");
                      setBulkOpen(true);
                    }}
                  >
                    <span className="sm:hidden">Activate</span>
                    <span className="hidden sm:inline">Activate ready</span> (
                    {activateReadyTargets.length})
                  </Button>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    variant="outline"
                    disabled={isBusy || deactivateTargets.length === 0}
                    onClick={() => {
                      setBulkMode("deactivate-all");
                      setBulkOpen(true);
                    }}
                  >
                    <span className="sm:hidden">Deactivate</span>
                    <span className="hidden sm:inline">Deactivate all</span> (
                    {deactivateTargets.length})
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkTitle}</AlertDialogTitle>
            <AlertDialogDescription>{bulkDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkPending}
              onClick={async (e) => {
                // Prevent dialog from closing immediately; close on success.
                e.preventDefault();
                setBulkPending(true);

                const targets =
                  bulkMode === "activate-ready"
                    ? activateReadyTargets
                    : deactivateTargets;

                let succeeded = 0;
                try {
                  for (const t of targets) {
                    await updateCharacter.mutateAsync({
                      characterId: t.c.characterId,
                      payload:
                        bulkMode === "activate-ready"
                          ? { isActiveFarm: true, isCandidate: true }
                          : { isActiveFarm: false },
                    });
                    succeeded += 1;
                  }

                  toast.success(
                    bulkMode === "activate-ready"
                      ? `Activated ${succeeded} farm(s)`
                      : `Deactivated ${succeeded} farm(s)`,
                  );
                  setBulkOpen(false);
                } catch {
                  toast.error(
                    `Bulk update failed after ${succeeded} succeeded. Try again.`,
                  );
                } finally {
                  setBulkPending(false);
                }
              }}
            >
              {bulkActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-3">
        {visible.map(
          ({
            c,
            isActive,
            isReady,
            isCandidate,
            blocking,
            statusLabel,
            statusVariant,
          }) => {
            return (
              <CharacterRow
                key={c.characterId}
                character={c}
                isActive={isActive}
                isReady={isReady}
                isCandidate={isCandidate}
                blocking={blocking}
                statusLabel={statusLabel}
                statusVariant={statusVariant}
                isPending={pendingCharacterId === c.characterId}
                onSetPending={(id) => setPendingCharacterId(id)}
                onClearPending={() => setPendingCharacterId(null)}
                updateCharacter={updateCharacter}
              />
            );
          },
        )}
      </div>
    </div>
  );
}

function CharacterRow({
  character,
  isActive,
  isReady,
  isCandidate,
  blocking,
  statusLabel,
  statusVariant,
  isPending,
  onSetPending,
  onClearPending,
  updateCharacter,
}: {
  character: Parameters<typeof getRequirementList>[0] & {
    characterId: number;
    name: string;
    totalSp: number;
    nonExtractableSp: number;
    config: { isActive: boolean; isCandidate?: boolean };
  };
  isActive: boolean;
  isReady: boolean;
  isCandidate: boolean;
  blocking: RequirementSummary[];
  statusLabel: string;
  statusVariant: "default" | "secondary" | "outline";
  isPending: boolean;
  onSetPending: (id: number) => void;
  onClearPending: () => void;
  updateCharacter: ReturnType<typeof useUpdateSkillFarmCharacter>;
}) {
  const [open, setOpen] = React.useState(false);

  const reqs = getRequirementList(character);
  const omegaDetailsWithSource = `${character.requirements.training.details ? String(character.requirements.training.details) : ""}${character.requirements.training.details ? "\n\n" : ""}Omega status is taken from the Characters → Overview page.`;
  const missingLabels = blocking.map((b) => b.label);
  const missingSummary =
    missingLabels.length > 0
      ? `Missing ${missingLabels.length}: ${missingLabels
          .slice(0, 2)
          .join(", ")}${
          missingLabels.length > 2 ? ` +${missingLabels.length - 2} more` : ""
        }`
      : null;

  return (
    <Card className="bg-gradient-to-b from-background to-muted/5 p-4 md:p-5">
      <CardHeader className="gap-3">
        <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
          <div className="min-w-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base truncate" title={character.name}>
                {character.name}
              </CardTitle>
              <p className="text-xs text-foreground/80">
                {character.totalSp.toLocaleString()} SP /{" "}
                <span className="font-medium">
                  {Number(5_000_000).toLocaleString()} SP
                </span>{" "}
                non-extractable floor
              </p>
            </div>

            <div className="min-w-0 flex flex-wrap items-center gap-2 sm:justify-end">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              {!isActive && !isReady && missingSummary && (
                <Badge variant="outline" className="max-w-full truncate">
                  {missingSummary}
                </Badge>
              )}
            </div>
          </div>

          <div className="min-w-0 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <RequirementBadge
                label="5.0M SP"
                status={character.requirements.minSp.status}
                details={character.requirements.minSp.details}
              />
              <RequirementBadge
                label="Biology V"
                status={character.requirements.biology.status}
                details={character.requirements.biology.details}
              />
              <RequirementBadge
                label="Cybernetics V"
                status={character.requirements.cybernetics.status}
                details={character.requirements.cybernetics.details}
              />
              <RequirementBadge
                label="Remap available"
                status={character.requirements.remap.status}
                details={character.requirements.remap.details}
              />
              <RequirementBadge
                label="Omega"
                status={character.requirements.training.status}
                details={omegaDetailsWithSource}
              />
              <RequirementBadge
                label="+5 Per/Wil & BY-810"
                status={character.requirements.implants.status}
                details={character.requirements.implants.details}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`candidate-${character.characterId}`}
                    checked={isCandidate}
                    disabled={isPending}
                    onCheckedChange={(checked) => {
                      onSetPending(character.characterId);
                      updateCharacter.mutate(
                        {
                          characterId: character.characterId,
                          payload: { isCandidate: checked },
                        },
                        {
                          onSuccess: () => {
                            toast.success(
                              checked
                                ? `${character.name} marked as candidate`
                                : `${character.name} removed from candidates`,
                            );
                          },
                          onError: () => {
                            toast.error("Failed to update candidate status");
                          },
                          onSettled: () => onClearPending(),
                        },
                      );
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <Label
                      htmlFor={`candidate-${character.characterId}`}
                      className="text-sm text-foreground/80"
                    >
                      Farm candidate
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          aria-label="What does Farm candidate mean?"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={8}
                        className="max-w-xs"
                      >
                        Marks this character as eligible for skill farming. Use
                        the Candidates filter to focus on your intended farm
                        roster. Activating a farm automatically marks the
                        character as a candidate.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id={`active-${character.characterId}`}
                    checked={isActive}
                    disabled={isPending || (!isActive && !isReady)}
                    onCheckedChange={(checked) => {
                      if (checked && !isReady) return;
                      onSetPending(character.characterId);
                      updateCharacter.mutate(
                        {
                          characterId: character.characterId,
                          payload: {
                            isActiveFarm: checked,
                            ...(checked ? { isCandidate: true } : null),
                          },
                        },
                        {
                          onSuccess: () => {
                            toast.success(
                              checked
                                ? `${character.name} added to active farm`
                                : `${character.name} removed from farm`,
                            );
                          },
                          onError: () => {
                            toast.error("Failed to update active farm status");
                          },
                          onSettled: () => onClearPending(),
                        },
                      );
                    }}
                  />
                  <Label
                    htmlFor={`active-${character.characterId}`}
                    className="text-sm font-medium"
                  >
                    Active farm
                  </Label>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!open && (
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ChevronDown className="h-4 w-4" />
                      Show details
                    </Button>
                  </CollapsibleTrigger>
                )}
              </div>
            </div>
          </div>

          <CollapsibleContent className="rounded-md border bg-background/50 p-3 md:p-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ChevronUp className="h-4 w-4" />
                      Hide details
                    </Button>
                  </CollapsibleTrigger>
                  <div className="text-sm font-medium">Requirement details</div>
                </div>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {reqs.map((r) => {
                  const icon =
                    r.status === "pass" ? (
                      <CheckCircle2 className="h-4 w-4 text-foreground/70" />
                    ) : r.status === "warning" ? (
                      <AlertTriangle className="h-4 w-4 text-foreground/70" />
                    ) : (
                      <XCircle className="h-4 w-4 text-foreground/70" />
                    );

                  return (
                    <div
                      key={r.label}
                      className="flex min-w-0 items-start gap-2 rounded-md border bg-background/40 p-3"
                    >
                      <div className="mt-0.5 shrink-0">{icon}</div>
                      <div className="min-w-0">
                        <div className="font-medium">{r.label}</div>
                        {r.details ? (
                          <div className="break-words text-foreground/80">
                            {String(r.details)}
                          </div>
                        ) : (
                          <div className="text-foreground/80">
                            {r.status === "pass" ? "Met" : "Not met"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isActive && !isReady && (
                <div className="text-sm text-foreground/80">
                  This character can’t be activated yet. Fix the missing
                  requirements above, then toggle{" "}
                  <span className="font-medium">Active farm</span>.
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  );
}

export default function SkillFarmCharactersPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-6">
      <DynamicBreadcrumbs />
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Skill farm characters
          </h1>
          <Badge variant="secondary" className="text-xs">
            Step 2 of 3
          </Badge>
        </div>
        <p className="max-w-4xl text-sm text-foreground/80">
          Select which of your characters are suitable for skill farming. The
          checklist below highlights missing prerequisites so you know what to
          fix before activating a farm.
        </p>
      </header>
      <CharactersContent />
    </div>
  );
}
