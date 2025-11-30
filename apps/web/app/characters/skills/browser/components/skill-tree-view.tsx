"use client";

import { useEffect, useMemo, useState } from "react";
import { GitBranch, Search, Shuffle, X } from "lucide-react";
import { Input, Skeleton, Badge } from "@eve/ui";
import { useSkillEncyclopedia } from "../api";
import type { SkillEncyclopediaEntry } from "@eve/api-contracts";
import {
  estimateTrainingTimeSeconds,
  type AttributeSet,
  type SkillPrimaryAttribute,
} from "@eve/shared/skills";

type Direction = "prereqs" | "unlocks";
type SkillStatusById = Record<
  number,
  {
    trainedLevel: number;
    activeLevel: number | null;
    skillpointsInSkill: number;
    isTraining: boolean;
  }
>;

interface SkillTreeViewProps {
  skillStatusById?: SkillStatusById;
  attrs?: AttributeSet;
}

export function SkillTreeView({ skillStatusById, attrs }: SkillTreeViewProps) {
  const { data, isLoading } = useSkillEncyclopedia();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>("prereqs");
  const [collapsedTiers, setCollapsedTiers] = useState<Set<number>>(new Set());
  const [collapseInitialized, setCollapseInitialized] = useState(false);

  const skillById = useMemo(() => {
    const map = new Map<number, SkillEncyclopediaEntry>();
    for (const skill of data?.skills ?? []) {
      map.set(skill.skillId, skill);
    }
    return map;
  }, [data]);

  const allSkills = useMemo(() => data?.skills ?? [], [data?.skills]);
  const hasCharacterOverlay =
    !!skillStatusById && Object.keys(skillStatusById).length > 0;

  function formatDuration(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (!days && !hours) parts.push(`${minutes}m`);
    else if (minutes) parts.push(`${minutes}m`);
    return parts.join(" ");
  }

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return allSkills;
    const q = searchQuery.toLowerCase();
    return allSkills.filter((skill) => {
      const name = skill.name.toLowerCase();
      const desc = (skill.description ?? "").toLowerCase();
      const group = skill.groupName.toLowerCase();
      return name.includes(q) || desc.includes(q) || group.includes(q);
    });
  }, [allSkills, searchQuery]);

  useEffect(() => {
    if (
      selectedSkillId &&
      !filteredSkills.some((s) => s.skillId === selectedSkillId)
    ) {
      // If the current selection is filtered out, clear selection and show
      // the empty-state instructions instead of auto-selecting something else.
      setSelectedSkillId(null);
    }
  }, [filteredSkills, selectedSkillId]);

  const selectedSkill = selectedSkillId
    ? (skillById.get(selectedSkillId) ?? null)
    : null;

  type Column = SkillEncyclopediaEntry[];

  const columns: Column[] = useMemo(() => {
    if (!selectedSkill) return [];

    const result: Column[] = [];
    const visited = new Set<number>();

    const enqueue = (
      root: SkillEncyclopediaEntry,
      expand: (skill: SkillEncyclopediaEntry) => SkillEncyclopediaEntry[],
    ) => {
      const queue: { skill: SkillEncyclopediaEntry; depth: number }[] = [
        { skill: root, depth: 0 },
      ];
      visited.add(root.skillId);

      while (queue.length) {
        const { skill, depth } = queue.shift()!;
        if (!result[depth]) result[depth] = [];
        if (!result[depth].some((s) => s.skillId === skill.skillId)) {
          result[depth].push(skill);
        }

        const next = expand(skill);
        for (const child of next) {
          if (!visited.has(child.skillId)) {
            visited.add(child.skillId);
            queue.push({ skill: child, depth: depth + 1 });
          }
        }
      }
    };

    if (direction === "prereqs") {
      enqueue(selectedSkill, (skill) =>
        skill.prerequisites
          .map((p) => skillById.get(p.skillId))
          .filter((s): s is SkillEncyclopediaEntry => !!s),
      );
    } else {
      enqueue(selectedSkill, (skill) =>
        (skill.requiredBy ?? [])
          .map((p) => skillById.get(p.skillId))
          .filter((s): s is SkillEncyclopediaEntry => !!s),
      );
    }

    return result;
  }, [selectedSkill, direction, skillById]);

  useEffect(() => {
    if (collapseInitialized) return;
    if (columns.length > 3) {
      const next = new Set<number>();
      for (let depth = 3; depth < columns.length; depth += 1) {
        next.add(depth);
      }
      setCollapsedTiers(next);
    }
    setCollapseInitialized(true);
  }, [columns.length, collapseInitialized]);

  const trainingSummary = useMemo(() => {
    if (!selectedSkill || direction !== "prereqs" || !attrs) return null;

    const targetLevels = new Map<number, number>();
    const visited = new Set<number>();

    const dfs = (skill: SkillEncyclopediaEntry) => {
      if (visited.has(skill.skillId)) return;
      visited.add(skill.skillId);
      for (const prereq of skill.prerequisites) {
        const existing = targetLevels.get(prereq.skillId) ?? 0;
        if (prereq.requiredLevel > existing) {
          targetLevels.set(prereq.skillId, prereq.requiredLevel);
        }
        const prereqSkill = skillById.get(prereq.skillId);
        if (prereqSkill) {
          dfs(prereqSkill);
        }
      }
    };

    dfs(selectedSkill);

    let totalSeconds = 0;
    let remainingSeconds = 0;
    let totalSkills = 0;
    let completedSkills = 0;

    for (const [skillId, targetLevel] of targetLevels) {
      const skill = skillById.get(skillId);
      if (!skill) continue;
      totalSkills += 1;

      const status = skillStatusById?.[skillId];
      const currentLevel = status?.trainedLevel ?? 0;

      const rank = skill.trainingMultiplier;
      const primary = skill.primaryAttribute as SkillPrimaryAttribute;
      const secondary = skill.secondaryAttribute as SkillPrimaryAttribute;

      const totalForSkill = estimateTrainingTimeSeconds({
        currentLevel: 0,
        targetLevel,
        rank,
        attrs,
        primary,
        secondary,
      });
      const remainingForSkill = estimateTrainingTimeSeconds({
        currentLevel,
        targetLevel,
        rank,
        attrs,
        primary,
        secondary,
      });

      totalSeconds += totalForSkill;
      if (remainingForSkill <= 0) {
        completedSkills += 1;
      } else {
        remainingSeconds += remainingForSkill;
      }
    }

    if (totalSkills === 0) return null;

    return {
      totalSkills,
      completedSkills,
      totalSeconds,
      remainingSeconds,
      remainingLabel: formatDuration(remainingSeconds),
    };
  }, [selectedSkill, direction, attrs, skillById, skillStatusById]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data || data.skills.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 p-8 text-center">
        <p className="text-sm text-foreground/70">
          The skill encyclopedia has not been loaded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(260px,0.4fr)_1fr] md:items-start md:gap-4">
        {/* Left: search + selection list */}
        <div className="w-full space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
            <Input
              placeholder="Search skills to explore their tree..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground/60 hover:bg-muted/60"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-foreground/70">
            {filteredSkills.length > 0
              ? `Showing ${filteredSkills.length.toLocaleString()} skill${
                  filteredSkills.length === 1 ? "" : "s"
                }${searchQuery ? ` matching "${searchQuery}"` : ""}`
              : searchQuery
                ? `No skills found matching "${searchQuery}".`
                : `Showing all ${allSkills.length.toLocaleString()} skills.`}
          </p>
          <div className="rounded-md border bg-background/60 max-h-72 overflow-y-auto text-sm">
            {filteredSkills.length === 0 ? (
              <div className="p-3 text-sm text-foreground/70">
                No skills found matching &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredSkills.slice(0, 80).map((skill) => {
                  const isActive = skill.skillId === selectedSkillId;
                  return (
                    <li key={skill.skillId}>
                      <button
                        type="button"
                        onClick={() => setSelectedSkillId(skill.skillId)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        <span
                          className="truncate font-medium"
                          title={skill.name}
                        >
                          {skill.name}
                        </span>
                        <span className="ml-2 text-xs text-foreground/60">
                          {skill.groupName}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: tree visualization + controls */}
        <div className="flex flex-col rounded-md border bg-background/60 p-4">
          {!selectedSkill ? (
            <div className="space-y-3 text-sm text-foreground/70">
              <p>
                Select a skill on the left to explore its{" "}
                <span className="font-semibold">prerequisites</span> or{" "}
                <span className="font-semibold">what it unlocks</span>.
              </p>
              <p>
                Use the search box to quickly find a specific skill, then choose
                between <span className="font-semibold">Prerequisites</span> and{" "}
                <span className="font-semibold">What this unlocks</span> to
                change the tree direction.
              </p>
            </div>
          ) : columns.length === 0 ? (
            <p className="text-sm text-foreground/70">
              No{" "}
              {direction === "prereqs" ? "prerequisites" : "dependent skills"}{" "}
              found for{" "}
              <span className="font-semibold">{selectedSkill.name}</span>.
            </p>
          ) : (
            <div className="flex flex-1 flex-col space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-foreground/70" />
                    <span className="text-base font-semibold text-foreground">
                      {direction === "prereqs"
                        ? "⬆ Prerequisite tree"
                        : "⬇ Unlocks tree"}{" "}
                      for{" "}
                      <span className="underline">{selectedSkill.name}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/60">
                    <span>
                      {columns.length} {columns.length === 1 ? "tier" : "tiers"}{" "}
                      in view
                    </span>
                    {trainingSummary && (
                      <span>
                        {trainingSummary.completedSkills} of{" "}
                        {trainingSummary.totalSkills} prerequisites completed •
                        Remaining time: {trainingSummary.remainingLabel}
                      </span>
                    )}
                  </div>
                </div>
                {/* Direction toggle */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-foreground/70">View:</span>
                  <div className="inline-flex overflow-hidden rounded-full border bg-background text-[11px]">
                    <button
                      type="button"
                      onClick={() => setDirection("prereqs")}
                      className={`flex items-center gap-1 px-3 py-1 ${
                        direction === "prereqs"
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/80 hover:bg-muted/60"
                      }`}
                    >
                      <GitBranch className="h-3 w-3" />
                      Prerequisites
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("unlocks")}
                      className={`flex items-center gap-1 border-l px-3 py-1 ${
                        direction === "unlocks"
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/80 hover:bg-muted/60"
                      }`}
                    >
                      <Shuffle className="h-3 w-3" />
                      What this unlocks
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-2 space-y-4 pb-3">
                {columns.map((col, depth) => (
                  <section
                    key={depth}
                    className="space-y-3 rounded-md border bg-background px-3 py-3"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70 md:text-sm">
                        {direction === "prereqs"
                          ? depth === 0
                            ? "Target skill"
                            : `Requires (tier ${depth})`
                          : depth === 0
                            ? "Starting skill"
                            : `Unlocks (tier ${depth})`}
                      </div>
                      {depth > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedTiers((prev) => {
                              const next = new Set(prev);
                              if (next.has(depth)) {
                                next.delete(depth);
                              } else {
                                next.add(depth);
                              }
                              return next;
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-foreground/60 hover:bg-muted/60"
                        >
                          <span>{collapsedTiers.has(depth) ? "▶" : "▼"}</span>
                          <span>{col.length} skills</span>
                        </button>
                      )}
                    </div>
                    {!collapsedTiers.has(depth) && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {col.map((skill) => {
                          const status = skillStatusById?.[skill.skillId];
                          const isSelected = skill.skillId === selectedSkillId;
                          const isRoot =
                            depth === 0 && skill.skillId === selectedSkillId;

                          const cardBase =
                            "w-full rounded-md border px-4 py-3 text-left text-sm transition-colors";
                          const cardVariant = isRoot
                            ? "border-primary/80 bg-primary/15 text-primary shadow-md"
                            : isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background/80 hover:bg-muted/60";

                          const multiplierColor =
                            skill.trainingMultiplier <= 2
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                              : skill.trainingMultiplier <= 5
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                : skill.trainingMultiplier <= 10
                                  ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                                  : "border-red-500/40 bg-red-500/10 text-red-300";

                          let statusLabel = "Not trained";
                          let statusClass = "text-amber-300";
                          if (status) {
                            if (status.isTraining) {
                              statusLabel = "In training";
                              statusClass = "text-primary";
                            } else if (status.trainedLevel > 0) {
                              statusLabel = `Level ${status.trainedLevel}`;
                              statusClass = "text-emerald-300";
                            }
                          }

                          return (
                            <button
                              key={skill.skillId}
                              type="button"
                              onClick={() => setSelectedSkillId(skill.skillId)}
                              className={`${cardBase} ${cardVariant}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span
                                  className="truncate text-base font-semibold md:text-lg"
                                  title={skill.name}
                                >
                                  {skill.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`px-2 py-0.5 text-xs font-medium ${multiplierColor}`}
                                >
                                  {skill.trainingMultiplier}x
                                </Badge>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-xs text-foreground/70 md:text-sm">
                                <span className="truncate">
                                  {skill.groupName}
                                </span>
                                <span>
                                  {skill.primaryAttribute
                                    .slice(0, 3)
                                    .toUpperCase()}{" "}
                                  /{" "}
                                  {skill.secondaryAttribute
                                    .slice(0, 3)
                                    .toUpperCase()}
                                </span>
                              </div>
                              {hasCharacterOverlay && (
                                <div className="mt-2 flex items-center justify-between text-xs font-medium md:text-sm">
                                  <span className={statusClass}>
                                    {statusLabel}
                                  </span>
                                  {status && status.trainedLevel > 0 && (
                                    <Badge className="px-2 py-0.5 text-[11px]">
                                      {status.isTraining ? "Active" : "Trained"}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
