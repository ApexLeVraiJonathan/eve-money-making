"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  BookOpen,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import { Badge } from "@eve/ui";
import { Button } from "@eve/ui";
import { Separator } from "@eve/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@eve/ui";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@eve/ui";
import { Skeleton } from "@eve/ui";
import { Input } from "@eve/ui";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { SkillDetailModal } from "./browser/components/skill-detail-modal";
import type {
  SkillEncyclopediaEntry,
  SkillEncyclopediaResponse,
} from "@eve/api-contracts";
import { qk } from "@eve/api-client/queryKeys";
import type {
  CharacterTrainingQueueSummary,
  CharacterSkillsResponse,
  CharacterAttributesResponse,
} from "@eve/api-contracts";
import { useMyCharacters } from "@/app/tradecraft/api/characters/users.hooks";
import { useSkillEncyclopedia } from "./browser/api";
import {
  estimateTrainingTimeSeconds,
  type AttributeSet,
  type SkillPrimaryAttribute,
} from "@eve/shared/skills";

type SkillCharacter = {
  id: number;
  name: string;
  isPrimary: boolean;
};

// Helper function to convert numbers to Roman numerals (for skill levels)
function toRoman(num: number): string {
  const map: Record<number, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
  };
  return map[num] ?? String(num);
}

function useMySkillCharacters(): SkillCharacter[] {
  const { data: chars = [] } = useMyCharacters();
  return (chars ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    isPrimary: c.isPrimary,
  }));
}

function useCharacterTrainingQueue(characterId: number | null | undefined) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    enabled: !!characterId,
    queryKey: qk.characterManagement.characterTrainingQueue(characterId ?? 0),
    queryFn: async () => {
      if (!characterId) return null as CharacterTrainingQueueSummary | null;
      try {
        return await client.get<CharacterTrainingQueueSummary | null>(
          `/character-management/me/characters/${characterId}/training-queue`,
        );
      } catch {
        return null;
      }
    },
    retry: false,
  });
}

function useCharacterSkillsSnapshot(characterId: number | null | undefined) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    enabled: !!characterId,
    queryKey: qk.characterManagement.characterSkills(characterId ?? 0),
    queryFn: async () => {
      if (!characterId) return null as CharacterSkillsResponse | null;
      try {
        return await client.get<CharacterSkillsResponse | null>(
          `/character-management/me/characters/${characterId}/skills`,
        );
      } catch {
        return null;
      }
    },
    retry: false,
  });
}

function useCharacterAttributes(characterId: number | null | undefined) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    enabled: !!characterId,
    queryKey: qk.characterManagement.characterAttributes(characterId ?? 0),
    queryFn: async () => {
      if (!characterId) return null as CharacterAttributesResponse | null;
      try {
        return await client.get<CharacterAttributesResponse | null>(
          `/character-management/me/characters/${characterId}/attributes`,
        );
      } catch {
        return null;
      }
    },
    retry: false,
  });
}

export default function SkillsPage() {
  const characters = useMySkillCharacters();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSkill, setSelectedSkill] =
    useState<SkillEncyclopediaEntry | null>(null);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(true);

  // Load getting started preference from localStorage
  useEffect(() => {
    const hideGettingStarted = localStorage.getItem("hideGettingStarted");
    if (hideGettingStarted === "true") {
      setShowGettingStarted(false);
    }
  }, []);

  // Keep selected character in sync with linked characters, preferring primary
  useEffect(() => {
    if (!characters.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    // If current selection is still valid, keep it
    if (selectedId && characters.some((c) => c.id === selectedId)) {
      return;
    }

    const primary =
      characters.find((c) => c.isPrimary) ?? characters[0] ?? null;
    if (primary) {
      setSelectedId(primary.id);
    }
  }, [characters, selectedId]);

  const { data: queue, isLoading: queueLoading } =
    useCharacterTrainingQueue(selectedId);
  const { data: skills, isLoading: skillsLoading } =
    useCharacterSkillsSnapshot(selectedId);
  const { data: attrs } = useCharacterAttributes(selectedId);

  // Load skill encyclopedia for name resolution
  const { data: encyclopedia } = useSkillEncyclopedia();

  // Create skill ID to name mapping
  const skillNameById = useMemo(() => {
    const map = new Map<number, string>();
    if (encyclopedia?.skills) {
      for (const skill of encyclopedia.skills) {
        map.set(skill.skillId, skill.name);
      }
    }
    return map;
  }, [encyclopedia]);

  // Handle skill click
  const handleSkillClick = (skillId: number) => {
    const skill = encyclopedia?.skills.find((s) => s.skillId === skillId);
    if (skill) {
      setSelectedSkill(skill);
      setIsSkillModalOpen(true);
    }
  };

  const handleRelatedSkillClick = (skillId: number) => {
    const skill = encyclopedia?.skills.find((s) => s.skillId === skillId);
    if (skill) {
      setSelectedSkill(skill);
    }
  };

  const handleDismissGettingStarted = () => {
    setShowGettingStarted(false);
    localStorage.setItem("hideGettingStarted", "true");
  };

  const handleShowGettingStarted = () => {
    setShowGettingStarted(true);
    localStorage.removeItem("hideGettingStarted");
  };

  return (
    <div className="flex h-full flex-col space-y-4 p-4">
      {/* Character Header with attributes */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/20">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Training Overview</h1>
            {selectedId && (
              <p className="text-sm text-foreground/80">
                {characters.find((c) => c.id === selectedId)?.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 lg:gap-6">
          {/* Attributes inline */}
          {attrs && (
            <div className="flex flex-wrap items-center gap-3 lg:gap-4 text-sm">
              <div className="flex items-center gap-1.5" title="Intelligence">
                <span className="text-foreground/70">Int:</span>
                <span className="font-semibold">{attrs.intelligence}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Perception">
                <span className="text-foreground/70">Per:</span>
                <span className="font-semibold">{attrs.perception}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Memory">
                <span className="text-foreground/70">Mem:</span>
                <span className="font-semibold">{attrs.memory}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Willpower">
                <span className="text-foreground/70">Will:</span>
                <span className="font-semibold">{attrs.willpower}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Charisma">
                <span className="text-foreground/70">Cha:</span>
                <span className="font-semibold">{attrs.charisma}</span>
              </div>
            </div>
          )}

          <Select
            value={selectedId ? String(selectedId) : ""}
            onValueChange={(v) => setSelectedId(Number(v))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select character" />
            </SelectTrigger>
            <SelectContent>
              {characters.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {characters.length === 0 ? (
        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>No linked characters</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Link at least one character on the Characters page to see skills
              and training information here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Getting Started helper - Now dismissible */}
          {showGettingStarted && (
            <section className="relative rounded-md border bg-card p-4 text-sm space-y-2">
              <button
                onClick={handleDismissGettingStarted}
                className="absolute right-3 top-3 text-foreground/60 hover:text-foreground transition-colors"
                aria-label="Dismiss getting started"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <p className="font-medium">Getting started</p>
              <ul className="list-disc space-y-1 pl-5 text-foreground">
                <li>
                  Use the <span className="font-semibold">search box</span> to
                  find skills by name or ID, and the{" "}
                  <span className="font-semibold">level filters</span> to focus
                  on specific tiers.
                </li>
                <li>
                  Click any <span className="font-semibold">skill row</span> or{" "}
                  <span className="font-semibold">queue entry</span> to open a
                  detailed view with prerequisites, SP per level, and training
                  attributes.
                </li>
                <li>
                  Watch the{" "}
                  <span className="font-semibold">Training Queue</span> on the
                  right for total time remaining and upcoming skills, and use
                  the character selector to switch between pilots.
                </li>
              </ul>
            </section>
          )}

          {/* Show Getting Started button if dismissed */}
          {!showGettingStarted && (
            <button
              onClick={handleShowGettingStarted}
              className="text-sm text-foreground/70 hover:text-foreground hover:bg-muted/50 flex items-center gap-2 transition-colors rounded-md border border-dashed px-3 py-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Show getting started tips
            </button>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 overflow-hidden">
            {/* Main content: Skills (left, 3 columns) */}
            <div className="col-span-1 lg:col-span-3 flex flex-col overflow-hidden">
              <SkillsListCard
                loading={skillsLoading}
                skills={skills}
                skillNameById={skillNameById}
                encyclopedia={encyclopedia}
                onSkillClick={handleSkillClick}
                attrs={attrs}
                queue={queue}
              />
            </div>

            {/* Sidebar: Training queue (right, 2 columns) */}
            <div className="col-span-1 lg:col-span-2 flex flex-col overflow-hidden">
              <TrainingQueueCard
                loading={queueLoading}
                queue={queue}
                skillNameById={skillNameById}
                onSkillClick={handleSkillClick}
                attrs={attrs}
                encyclopedia={encyclopedia}
              />
            </div>
          </div>

          {/* Skill Detail Modal */}
          {selectedSkill && (
            <SkillDetailModal
              skill={selectedSkill}
              open={isSkillModalOpen}
              onClose={() => setIsSkillModalOpen(false)}
              onSelectRelatedSkill={handleRelatedSkillClick}
            />
          )}
        </>
      )}
    </div>
  );
}

function TrainingQueueCard({
  loading,
  queue,
  skillNameById,
  onSkillClick,
  attrs,
  encyclopedia,
}: {
  loading: boolean;
  queue: CharacterTrainingQueueSummary | null | undefined;
  skillNameById: Map<number, string>;
  onSkillClick?: (skillId: number) => void;
  attrs?: CharacterAttributesResponse | null;
  encyclopedia?: SkillEncyclopediaResponse | null;
}) {
  // Calculate SP/hour for active skill
  const getSpPerHour = (skillId: number): number | null => {
    if (!attrs || !encyclopedia) return null;

    const skill = encyclopedia.skills.find((s) => s.skillId === skillId);
    if (!skill) return null;

    const primary =
      attrs[skill.primaryAttribute.toLowerCase() as keyof typeof attrs];
    const secondary =
      attrs[skill.secondaryAttribute.toLowerCase() as keyof typeof attrs];

    if (typeof primary !== "number" || typeof secondary !== "number")
      return null;

    return 60 * primary + 30 * secondary;
  };

  // Calculate remaining SP for a skill level
  const getRemainingSP = (
    skillId: number,
    targetLevel: number,
  ): number | null => {
    if (!encyclopedia) return null;

    const skill = encyclopedia.skills.find((s) => s.skillId === skillId);
    if (!skill) return null;

    // Get total SP needed for target level
    const spLevelKey = `spLevel${targetLevel}` as keyof typeof skill;
    const targetSP = skill[spLevelKey];

    if (typeof targetSP !== "number") return null;

    return targetSP;
  };

  // Calculate progress percentage for active skill.
  //
  // We intentionally base this on time, not SP, because the skills snapshot
  // is not updated in real time and can make SP-based progress appear stuck
  // at 0% even when the skill is half‑trained. ESI's queue dates are
  // reliable, so a time-based progress bar is a better UX signal.
  const getProgressPercentage = (
    entry: CharacterTrainingQueueSummary["activeEntry"] | null | undefined,
  ): number => {
    if (!entry) return 0;

    if (!entry.startDate || !entry.finishDate) return 0;

    const startTime = new Date(entry.startDate).getTime();
    const endTime = new Date(entry.finishDate).getTime();
    const now = Date.now();

    const totalDuration = endTime - startTime;
    const elapsed = now - startTime;

    if (totalDuration <= 0) return 100;

    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  };
  // Calculate days:hours from total seconds
  const formatTotalTime = (seconds: number) => {
    if (seconds <= 0) return "0d 0h";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  // Calculate end date from total seconds
  const getQueueEndDate = (seconds: number) => {
    if (seconds <= 0) return null;
    const endDate = new Date(Date.now() + seconds * 1000);
    return endDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format remaining time for the active skill (e.g. 8d 20h 52m).
  const formatRemainingTime = (finishDate: string | null | undefined) => {
    if (!finishDate) return null;
    const nowMs = Date.now();
    const endMs = new Date(finishDate).getTime();
    const diffSec = Math.floor((endMs - nowMs) / 1000);
    if (diffSec <= 0) return "0m";

    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <Card className="flex h-full flex-col border bg-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-base">Training Queue</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 p-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!queue || queue.isQueueEmpty) {
    return (
      <Card className="flex h-full flex-col border bg-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-base">Training Queue</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3 w-3" />
              Idle
            </Badge>
            <span className="text-sm">Queue is empty</span>
          </div>
          <p className="mt-3 text-sm text-foreground/70">
            Add skills to your training queue in-game to track progress here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const active = queue.activeEntry;
  const totalTime = formatTotalTime(queue.totalRemainingSeconds);
  const endDate = getQueueEndDate(queue.totalRemainingSeconds);
  const spPerHour = active ? getSpPerHour(active.skillId) : null;
  const progressPercentage = active ? getProgressPercentage(active) : 0;
  const remainingSP = active?.levelEnd
    ? getRemainingSP(active.skillId, active.levelEnd)
    : null;

  return (
    <Card className="flex h-full flex-col border bg-card">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Training Queue</CardTitle>
          <Badge variant={queue.isTraining ? "default" : "outline"}>
            {queue.isTraining ? "Training" : queue.isPaused ? "Paused" : "Idle"}
          </Badge>
        </div>
        {queue.totalRemainingSeconds > 0 && (
          <div className="mt-2 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">{totalTime}</span>
              <span className="text-foreground/60">remaining</span>
            </div>
            {endDate && (
              <p className="text-xs text-foreground/60">Completes {endDate}</p>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-3 p-4">
        {/* Active Skill */}
        {active && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Currently Training
              </Badge>
            </div>
            <div
              className="rounded-md border border-l-4 border-l-primary bg-muted/40 p-3 cursor-pointer hover:bg-muted/60 transition-colors shadow-sm"
              onClick={() => onSkillClick?.(active.skillId)}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {skillNameById.get(active.skillId) ??
                    `Skill #${active.skillId}`}
                </div>
                {active.levelEnd != null && (
                  <Badge className="text-xs font-semibold">
                    Level {toRoman(active.levelEnd)}
                  </Badge>
                )}
              </div>

              {/* SP/hour and Remaining SP */}
              {(spPerHour || remainingSP) && (
                <div className="mt-2 flex items-center justify-between text-xs text-foreground/60">
                  {spPerHour && (
                    <span className="font-mono">
                      {spPerHour.toLocaleString()} SP/hr
                    </span>
                  )}
                  {remainingSP && (
                    <span className="font-mono">
                      {remainingSP.toLocaleString()} SP total
                    </span>
                  )}
                </div>
              )}

              {active.finishDate && (
                <div className="mt-2 text-xs text-foreground/60 flex items-center justify-between gap-2">
                  <span className="text-foreground/70">
                    Time until trained: {formatRemainingTime(active.finishDate)}
                  </span>
                  <span>
                    Finishes{" "}
                    {new Date(active.finishDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </div>
              )}
              {/* Progress bar with actual percentage */}
              {active.startDate && active.finishDate && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-foreground/60">
                    <span>Progress</span>
                    <span className="font-mono">
                      {progressPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full bg-primary transition-all duration-300 animate-pulse"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Queue List */}
        {queue.entries.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Upcoming Skills</div>
            <div className="space-y-1">
              {queue.entries.slice(0, 10).map((e) => {
                const isActive =
                  queue.activeEntry?.skillId === e.skillId &&
                  queue.activeEntry.queuePosition === e.queuePosition;

                if (isActive) return null; // Skip active one as it's shown above

                return (
                  <div
                    key={`${e.skillId}-${e.queuePosition}`}
                    className="rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => onSkillClick?.(e.skillId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {skillNameById.get(e.skillId) ?? `Skill #${e.skillId}`}
                        {e.levelEnd != null && (
                          <span className="ml-2 text-xs text-foreground/60">
                            Level {toRoman(e.levelEnd)}
                          </span>
                        )}
                      </div>
                    </div>
                    {e.finishDate && (
                      <div className="mt-1 text-xs text-foreground/60 flex items-center justify-between gap-2">
                        <span className="text-foreground/70">
                          Time until trained:{" "}
                          {formatRemainingTime(e.finishDate)}
                        </span>
                        <span>
                          {new Date(e.finishDate).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AttributesCard({
  loading,
  attrs,
  compact,
}: {
  loading: boolean;
  attrs: CharacterAttributesResponse | null | undefined;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <Card className="shadow-md bg-gradient-to-b from-background to-muted/10">
        <CardHeader>
          <CardTitle>Attributes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!attrs) {
    return (
      <Card className="shadow-md bg-gradient-to-b from-background to-muted/10">
        <CardHeader>
          <CardTitle>Attributes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/80">
            Attributes could not be loaded for this character (missing token or
            insufficient ESI scopes).
          </p>
        </CardContent>
      </Card>
    );
  }

  const rows = [
    { label: "Intelligence", value: attrs.intelligence },
    { label: "Perception", value: attrs.perception },
    { label: "Memory", value: attrs.memory },
    { label: "Willpower", value: attrs.willpower },
    { label: "Charisma", value: attrs.charisma },
  ];

  if (compact) {
    return (
      <Card className="shadow-md bg-gradient-to-b from-background to-muted/10">
        <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
          <span className="font-semibold text-foreground/80">Attributes</span>
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline gap-1 text-foreground/70"
            >
              <span>{r.label}:</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
          <div className="ml-auto flex flex-wrap items-baseline gap-2 text-foreground/60">
            <span>
              Bonus remaps:{" "}
              <span className="font-semibold">
                {attrs.bonusRemaps ?? "unknown"}
              </span>
            </span>
            {attrs.lastRemapDate && (
              <span>
                Last remap:{" "}
                {new Date(attrs.lastRemapDate).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md bg-gradient-to-b from-background to-muted/10">
      <CardHeader>
        <CardTitle>Attributes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
            >
              <span className="text-foreground/70">{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-2 text-xs text-foreground/70">
          <div className="flex items-center gap-2">
            <ChevronDown className="h-3 w-3" />
            <span>Remap information</span>
          </div>
          <div className="space-y-1">
            <p>
              Bonus remaps:{" "}
              <span className="font-semibold">
                {attrs.bonusRemaps ?? "unknown"}
              </span>
            </p>
            {attrs.lastRemapDate && (
              <p>
                Last remap:{" "}
                {new Date(attrs.lastRemapDate).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkillsListCard({
  loading,
  skills,
  skillNameById,
  encyclopedia,
  onSkillClick,
  attrs,
  queue,
}: {
  loading: boolean;
  skills: CharacterSkillsResponse | null | undefined;
  skillNameById: Map<number, string>;
  encyclopedia: SkillEncyclopediaResponse | null | undefined;
  onSkillClick?: (skillId: number) => void;
  attrs: CharacterAttributesResponse | null | undefined;
  queue: CharacterTrainingQueueSummary | null | undefined;
}) {
  const [tab, setTab] = useState<"all" | "summary">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5]),
  );
  const [rankFilter, setRankFilter] = useState<Set<number>>(new Set());
  const [attributeFilter, setAttributeFilter] = useState<string>("");
  const [showOnlyNotLearned, setShowOnlyNotLearned] = useState(false);

  // Initialize all groups as collapsed by default
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    // Will be populated once we have grouped skills
    return new Set();
  });
  const [hasInitializedCollapse, setHasInitializedCollapse] = useState(false);

  // Convert attributes to AttributeSet for training time calculations
  const attributeSet: AttributeSet | null = useMemo(() => {
    if (!attrs) return null;
    return {
      intelligence: attrs.intelligence,
      memory: attrs.memory,
      perception: attrs.perception,
      willpower: attrs.willpower,
      charisma: attrs.charisma,
    };
  }, [attrs]);

  // Helper function to format training time
  const formatTrainingTime = (seconds: number): string => {
    if (seconds <= 0) return "—";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Calculate training time to next level for a skill
  const getTrainingTimeToNextLevel = (
    skillId: number,
    currentLevel: number,
  ): string => {
    if (currentLevel >= 5 || !attributeSet) return "—";

    const encyclopediaEntry = encyclopedia?.skills.find(
      (s) => s.skillId === skillId,
    );
    if (!encyclopediaEntry) return "—";

    const seconds = estimateTrainingTimeSeconds({
      currentLevel,
      targetLevel: currentLevel + 1,
      rank: encyclopediaEntry.trainingMultiplier,
      attrs: attributeSet,
      primary: encyclopediaEntry.primaryAttribute as SkillPrimaryAttribute,
      secondary: encyclopediaEntry.secondaryAttribute as SkillPrimaryAttribute,
    });

    return formatTrainingTime(seconds);
  };

  // Calculate category statistics
  type SkillRow = CharacterSkillsResponse["skills"][number];

  const notLearnedSkills: SkillRow[] = useMemo(() => {
    if (!encyclopedia?.skills || !skills?.skills) return [];
    const learnedIds = new Set(skills.skills.map((s) => s.skillId));
    return encyclopedia.skills
      .filter((entry) => !learnedIds.has(entry.skillId))
      .map((entry) => ({
        skillId: entry.skillId,
        skillpointsInSkill: 0,
        trainedSkillLevel: 0,
        activeSkillLevel: null,
      }));
  }, [encyclopedia, skills]);

  const categoryStats = useMemo(() => {
    if (!encyclopedia?.skills || !skills?.skills) return new Map();

    const stats = new Map<
      string,
      {
        totalSP: number;
        skillCount: number;
        totalSkillsInCategory: number;
        maxTotalSP: number;
      }
    >();

    // Count total skills per group from encyclopedia and max SP per group
    const totalSkillsByGroup = new Map<string, number>();
    const maxSpByGroup = new Map<string, number>();
    for (const skill of encyclopedia.skills) {
      totalSkillsByGroup.set(
        skill.groupName,
        (totalSkillsByGroup.get(skill.groupName) ?? 0) + 1,
      );
      const maxSp = typeof skill.spLevel5 === "number" ? skill.spLevel5 : 0;
      maxSpByGroup.set(
        skill.groupName,
        (maxSpByGroup.get(skill.groupName) ?? 0) + maxSp,
      );
    }

    // Calculate trained skills and SP per group
    for (const skill of skills.skills) {
      const encyclopediaEntry = encyclopedia.skills.find(
        (s) => s.skillId === skill.skillId,
      );
      if (!encyclopediaEntry) continue;

      const groupName = encyclopediaEntry.groupName;
      const current = stats.get(groupName) ?? {
        totalSP: 0,
        skillCount: 0,
        totalSkillsInCategory: totalSkillsByGroup.get(groupName) ?? 0,
        maxTotalSP: maxSpByGroup.get(groupName) ?? 0,
      };

      current.totalSP += skill.skillpointsInSkill;
      current.skillCount += 1;
      stats.set(groupName, current);
    }

    // Initialize groups that have no learned skills yet
    for (const skill of encyclopedia.skills) {
      if (!stats.has(skill.groupName)) {
        stats.set(skill.groupName, {
          totalSP: 0,
          skillCount: 0,
          totalSkillsInCategory: totalSkillsByGroup.get(skill.groupName) ?? 0,
          maxTotalSP: maxSpByGroup.get(skill.groupName) ?? 0,
        });
      }
    }

    return stats;
  }, [encyclopedia, skills]);

  // Helper to get level color
  const getLevelColor = (level: number): string => {
    if (level === 0) return "text-foreground/40";
    if (level <= 2) return "text-yellow-600 dark:text-yellow-500";
    if (level <= 4) return "text-blue-600 dark:text-blue-400";
    return "text-purple-600 dark:text-purple-400";
  };

  // Helper to get level badge variant
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getLevelBadgeColor = (level: number): string => {
    if (level === 0) return "bg-muted/50 text-foreground/60";
    if (level <= 2)
      return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
    if (level <= 4) return "bg-blue-500/20 text-blue-700 dark:text-blue-400";
    return "bg-purple-500/20 text-purple-700 dark:text-purple-400";
  };

  // Toggle group collapse
  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Filter skills based on search and level filter
  const filteredSkills = useMemo(() => {
    if (!skills?.skills) return [];

    // Combine learned and not learned skills if showOnlyNotLearned is true
    const baseSkills: SkillRow[] = showOnlyNotLearned
      ? [...skills.skills, ...notLearnedSkills]
      : skills.skills;

    let filtered = baseSkills;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((skill) => {
        const encyclopediaEntry = encyclopedia?.skills.find(
          (s) => s.skillId === skill.skillId,
        );
        const name = (skillNameById.get(skill.skillId) ?? "").toLowerCase();
        const skillId = String(skill.skillId);
        const groupName = encyclopediaEntry?.groupName?.toLowerCase() ?? "";

        // Search by name, ID, or group
        const matchesBasic =
          name.includes(query) ||
          skillId.includes(query) ||
          groupName.includes(query);

        // Search by prerequisites (skill names that this skill requires)
        const matchesPrereq =
          encyclopediaEntry?.prerequisites.some((prereq) => {
            const prereqName =
              skillNameById.get(prereq.skillId)?.toLowerCase() ?? "";
            return prereqName.includes(query);
          }) ?? false;

        return matchesBasic || matchesPrereq;
      });
    }

    // Apply level filter
    filtered = filtered.filter((skill) =>
      levelFilter.has(skill.trainedSkillLevel),
    );

    // Apply rank filter
    if (rankFilter.size > 0) {
      filtered = filtered.filter((skill) => {
        const encyclopediaEntry = encyclopedia?.skills.find(
          (s) => s.skillId === skill.skillId,
        );
        return (
          encyclopediaEntry &&
          rankFilter.has(encyclopediaEntry.trainingMultiplier)
        );
      });
    }

    // Apply attribute filter
    if (attributeFilter) {
      filtered = filtered.filter((skill) => {
        const encyclopediaEntry = encyclopedia?.skills.find(
          (s) => s.skillId === skill.skillId,
        );
        return (
          encyclopediaEntry &&
          (encyclopediaEntry.primaryAttribute.toLowerCase() ===
            attributeFilter.toLowerCase() ||
            encyclopediaEntry.secondaryAttribute.toLowerCase() ===
              attributeFilter.toLowerCase())
        );
      });
    }

    return filtered;
  }, [
    skills,
    notLearnedSkills,
    showOnlyNotLearned,
    searchQuery,
    levelFilter,
    rankFilter,
    attributeFilter,
    skillNameById,
    encyclopedia,
  ]);

  // Group filtered skills by category/group using encyclopedia metadata
  const groupedSkills = useMemo(() => {
    if (!encyclopedia?.skills || !skills?.skills) return [];

    // Create a map of skillId to encyclopedia entry for quick lookup
    const encyclopediaMap = new Map<number, SkillEncyclopediaEntry>();
    for (const skill of encyclopedia.skills) {
      encyclopediaMap.set(skill.skillId, skill);
    }

    // Group filtered skills by their group name
    const groups = new Map<string, typeof filteredSkills>();
    for (const skill of filteredSkills) {
      const encyclopediaEntry = encyclopediaMap.get(skill.skillId);
      if (!encyclopediaEntry) {
        console.warn(
          `No encyclopedia entry found for skill ID ${skill.skillId}`,
        );
      }
      const groupName = encyclopediaEntry?.groupName ?? "Unknown";

      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(skill);
    }

    // Convert to sorted array
    return Array.from(groups.entries())
      .map(([groupName, skills]) => ({ groupName, skills }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [filteredSkills, encyclopedia, skills]);

  // Initialize all groups as collapsed on first render
  useEffect(() => {
    if (!hasInitializedCollapse && groupedSkills.length > 0) {
      const allGroupNames = new Set(groupedSkills.map((g) => g.groupName));
      setCollapsedGroups(allGroupNames);
      setHasInitializedCollapse(true);
    }
  }, [groupedSkills, hasInitializedCollapse]);

  // Quick actions
  const expandAllGroups = () => setCollapsedGroups(new Set());
  const collapseAllGroups = () => {
    const allGroupNames = new Set(groupedSkills.map((g) => g.groupName));
    setCollapsedGroups(allGroupNames);
  };

  if (loading) {
    return (
      <Card className="flex h-full flex-col border bg-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-base">Skills</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!skills) {
    return (
      <Card className="flex h-full flex-col border bg-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-base">Skills</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-4">
          <div className="space-y-3">
            <p className="text-sm">
              Skills could not be loaded for this character.
            </p>
            {/* prettier-ignore */}
            <p className="text-sm text-foreground/60">
              This usually means the character needs to be re-authenticated with
              the correct ESI scopes. Click below to refresh the character&apos;s token.
            </p>
            <Button size="sm">Re-authenticate Character</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalSkills = skills.skills.length;
  const levelCounts = [1, 2, 3, 4, 5].map(
    (lvl) => skills.skills.filter((s) => s.trainedSkillLevel === lvl).length,
  );
  const totalEncyclopediaSkills: number | null =
    encyclopedia?.skills?.length ?? null;

  return (
    <Card className="flex h-full flex-col border bg-card overflow-hidden">
      <CardHeader className="border-b px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Skills</CardTitle>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "all" | "summary")}
            className="w-auto"
          >
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3">
                All Skills
              </TabsTrigger>
              <TabsTrigger value="summary" className="text-xs px-3">
                Summary
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs value={tab} className="flex h-full flex-col">
          <TabsContent
            value="all"
            className="flex-1 flex flex-col m-0 p-4 space-y-3 overflow-hidden"
          >
            {/* Search and Filter */}
            <div className="flex-shrink-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, group, or prerequisites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              {/* Level Filter */}
              <div className="flex items-center gap-2 flex-wrap rounded-md border bg-card/50 p-3">
                <span className="text-xs font-medium text-foreground/80">
                  Filter by level:
                </span>
                {[0, 1, 2, 3, 4, 5].map((level) => (
                  <Button
                    key={level}
                    size="sm"
                    variant={levelFilter.has(level) ? "default" : "outline"}
                    className={`h-7 text-xs px-2.5 ${levelFilter.has(level) ? "ring-2 ring-primary/30" : ""}`}
                    onClick={() => {
                      const newFilter = new Set(levelFilter);
                      if (newFilter.has(level)) {
                        newFilter.delete(level);
                      } else {
                        newFilter.add(level);
                      }
                      setLevelFilter(newFilter);
                    }}
                  >
                    {level === 0 ? "Untrained" : `Level ${toRoman(level)}`}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={showOnlyNotLearned ? "default" : "outline"}
                  className={`h-7 text-xs px-2.5 ${showOnlyNotLearned ? "ring-2 ring-primary/30" : ""}`}
                  onClick={() => setShowOnlyNotLearned(!showOnlyNotLearned)}
                >
                  Not Learned
                </Button>
              </div>

              {/* Rank Filter */}
              <div className="flex items-center gap-2 flex-wrap rounded-md border bg-card/50 p-3">
                <span className="text-xs font-medium text-foreground/80">
                  Filter by rank:
                </span>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((rank) => (
                  <Button
                    key={rank}
                    size="sm"
                    variant={rankFilter.has(rank) ? "default" : "outline"}
                    className={`h-7 text-xs px-2.5 ${rankFilter.has(rank) ? "ring-2 ring-primary/30" : ""}`}
                    onClick={() => {
                      const newFilter = new Set(rankFilter);
                      if (newFilter.has(rank)) {
                        newFilter.delete(rank);
                      } else {
                        newFilter.add(rank);
                      }
                      setRankFilter(newFilter);
                    }}
                  >
                    x{rank}
                  </Button>
                ))}
                {rankFilter.size > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => setRankFilter(new Set())}
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Attribute Filter */}
              <div className="flex items-center gap-2 flex-wrap rounded-md border bg-card/50 p-3">
                <span className="text-xs font-medium text-foreground/80">
                  Filter by attribute:
                </span>
                {[
                  "Intelligence",
                  "Memory",
                  "Perception",
                  "Willpower",
                  "Charisma",
                ].map((attr) => (
                  <Button
                    key={attr}
                    size="sm"
                    variant={
                      attributeFilter.toLowerCase() === attr.toLowerCase()
                        ? "default"
                        : "outline"
                    }
                    className={`h-7 text-xs px-2.5 ${attributeFilter.toLowerCase() === attr.toLowerCase() ? "ring-2 ring-primary/30" : ""}`}
                    onClick={() => {
                      setAttributeFilter(
                        attributeFilter.toLowerCase() === attr.toLowerCase()
                          ? ""
                          : attr,
                      );
                    }}
                  >
                    {attr.slice(0, 3)}
                  </Button>
                ))}
                {attributeFilter && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => setAttributeFilter("")}
                  >
                    Clear
                  </Button>
                )}
              </div>

              <div className="text-sm">
                {showOnlyNotLearned ? (
                  <>
                    Showing{" "}
                    <span className="font-semibold">
                      {filteredSkills.length}
                    </span>{" "}
                    of {(skills?.skills.length ?? 0) + notLearnedSkills.length}{" "}
                    skills
                    {totalEncyclopediaSkills
                      ? ` (out of ${totalEncyclopediaSkills} skills in the encyclopedia)`
                      : ""}
                  </>
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-semibold">
                      {filteredSkills.length}
                    </span>{" "}
                    of {skills?.skills.length ?? 0} learned skills for this
                    character
                    {totalEncyclopediaSkills
                      ? ` (out of ${totalEncyclopediaSkills} skills in the encyclopedia)`
                      : ""}
                  </>
                )}
              </div>

              {/* Quick Actions Bar - Right above table */}
              <div className="flex items-center justify-between gap-2 p-3 bg-accent/30 rounded-md">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground/80">
                    Quick Actions:
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs px-2.5 gap-1.5"
                    onClick={expandAllGroups}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="17 11 12 6 7 11"></polyline>
                      <polyline points="17 18 12 13 7 18"></polyline>
                    </svg>
                    Expand All
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs px-2.5 gap-1.5"
                    onClick={collapseAllGroups}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="7 13 12 18 17 13"></polyline>
                      <polyline points="7 6 12 11 17 6"></polyline>
                    </svg>
                    Collapse All
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground/60">
                    {collapsedGroups.size} / {groupedSkills.length} collapsed
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-md border">
              {filteredSkills.length === 0 ? (
                <div className="p-4 text-sm text-foreground/60 text-center">
                  {searchQuery || levelFilter.size < 6
                    ? "No skills match your filters."
                    : "No learned skills found for this character."}
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="bg-muted sticky top-0 z-10 border-b border-border">
                    <tr className="text-left text-sm">
                      <th className="px-4 py-3 font-semibold">Skill Name</th>
                      <th className="px-4 py-3 font-semibold w-24 text-center">
                        Level
                      </th>
                      <th className="px-4 py-3 font-semibold w-32 text-right">
                        SP in Skill
                      </th>
                      <th className="px-4 py-3 font-semibold w-32 text-right hidden sm:table-cell">
                        Time to Next
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedSkills.map((group) => {
                      const isCollapsed = collapsedGroups.has(group.groupName);
                      const stats = categoryStats.get(group.groupName);
                      const completionPercent = stats
                        ? Math.round((stats.totalSP / stats.maxTotalSP) * 100)
                        : 0;
                      return (
                        <React.Fragment key={group.groupName}>
                          <tr className="bg-muted/40">
                            <td
                              className="px-4 py-2 text-sm font-semibold cursor-pointer hover:bg-muted/60 transition-colors focus-within:ring-2 focus-within:ring-primary/50 focus-within:outline-none"
                              role="button"
                              tabIndex={0}
                              aria-expanded={!isCollapsed}
                              onClick={() =>
                                toggleGroupCollapse(group.groupName)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleGroupCollapse(group.groupName);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                {isCollapsed ? (
                                  <ChevronRight className="h-4 w-4 text-foreground/70" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-foreground/70" />
                                )}
                                {group.groupName} ({group.skills.length})
                              </div>
                            </td>
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2 font-mono text-sm text-right text-foreground/60">
                              {stats && (
                                <>
                                  {stats.totalSP.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}{" "}
                                  SP
                                </>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs text-right text-foreground/60 hidden sm:table-cell">
                              {stats && <>{completionPercent}% complete</>}
                            </td>
                          </tr>
                          {!isCollapsed &&
                            group.skills.map((s) => {
                              const trainingTime = getTrainingTimeToNextLevel(
                                s.skillId,
                                s.trainedSkillLevel,
                              );
                              const isInQueue =
                                queue?.entries.some(
                                  (e) => e.skillId === s.skillId,
                                ) ?? false;
                              // A skill is "not learned" only if it came from the notLearnedSkills array
                              // (doesn't exist in the character's actual skills list)
                              const isNotLearned = notLearnedSkills.some(
                                (nls) => nls.skillId === s.skillId,
                              );
                              return (
                                <tr
                                  key={s.skillId}
                                  className={`border-t border-border/40 hover:bg-accent/60 cursor-pointer transition-colors group ${
                                    isInQueue
                                      ? "bg-primary/5"
                                      : isNotLearned
                                        ? "bg-muted/30"
                                        : ""
                                  }`}
                                  onClick={() => onSkillClick?.(s.skillId)}
                                >
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2 justify-between">
                                      <div className="flex flex-col gap-0.5">
                                        <span
                                          className={`font-medium text-sm flex items-center gap-2 group-hover:underline ${isNotLearned ? "text-foreground/60 italic" : ""}`}
                                        >
                                          {skillNameById.get(s.skillId) ??
                                            `Skill #${s.skillId}`}
                                          {isInQueue && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] px-1.5 py-0 h-4"
                                            >
                                              In Queue
                                            </Badge>
                                          )}
                                          {isNotLearned && (
                                            <Badge
                                              variant="secondary"
                                              className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30"
                                            >
                                              Not Learned
                                            </Badge>
                                          )}
                                        </span>
                                        <span className="text-xs text-foreground/50 font-mono">
                                          ID: {s.skillId}
                                        </span>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-sm text-center">
                                    <span
                                      className={`font-semibold ${getLevelColor(s.trainedSkillLevel)}`}
                                    >
                                      {toRoman(s.trainedSkillLevel)}
                                    </span>
                                    {s.activeSkillLevel != null &&
                                      s.activeSkillLevel !==
                                        s.trainedSkillLevel && (
                                        <span className="ml-1 text-foreground/60 text-xs">
                                          (active {toRoman(s.activeSkillLevel)})
                                        </span>
                                      )}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-sm text-right">
                                    {s.skillpointsInSkill.toLocaleString(
                                      undefined,
                                      {
                                        maximumFractionDigits: 0,
                                      },
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 text-sm text-right text-foreground/70 hidden sm:table-cell">
                                    {s.trainedSkillLevel < 5
                                      ? trainingTime
                                      : "Max"}
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
          <TabsContent value="summary" className="flex-1 m-0 p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-card p-4">
                <div className="text-xs text-foreground/60 mb-1">Total SP</div>
                <div className="text-2xl font-bold font-mono">
                  {skills.totalSp.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-xs text-foreground/60 mb-1">
                  Unallocated SP
                </div>
                <div className="text-2xl font-bold font-mono">
                  {skills.unallocatedSp.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-xs text-foreground/60 mb-1">
                  Skills Trained
                </div>
                <div className="text-2xl font-bold">{totalSkills}</div>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="font-medium">Skills by Level</div>
              <div className="grid grid-cols-5 gap-3">
                {levelCounts.map((count, idx) => (
                  <div
                    key={idx + 1}
                    className="rounded-lg border bg-card px-3 py-3 text-center"
                  >
                    <div className="text-xs text-foreground/60 mb-1">
                      Level {idx + 1}
                    </div>
                    <div className="text-xl font-bold">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
