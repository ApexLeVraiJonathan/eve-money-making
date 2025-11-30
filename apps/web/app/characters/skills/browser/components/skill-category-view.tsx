"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Search,
  X,
  Zap,
} from "lucide-react";
import { Badge, Checkbox, Skeleton, Input } from "@eve/ui";
import { useSkillEncyclopedia } from "../api";
import { SkillDetailModal } from "./skill-detail-modal";
import type { SkillEncyclopediaEntry } from "@eve/api-contracts";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&");
}

function highlightMatches(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, "gi");
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="bg-primary/20 text-primary font-semibold">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

type SkillStatusById = Record<
  number,
  {
    trainedLevel: number;
    activeLevel: number | null;
    skillpointsInSkill: number;
    isTraining: boolean;
  }
>;

interface SkillCategoryViewProps {
  skillStatusById?: SkillStatusById;
}

export function SkillCategoryView({ skillStatusById }: SkillCategoryViewProps) {
  const { data, isLoading } = useSkillEncyclopedia();
  const [openGroupIds, setOpenGroupIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [comparedSkillIds, setComparedSkillIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasCharacterOverlay =
    !!skillStatusById && Object.keys(skillStatusById).length > 0;
  const [statusFilter, setStatusFilter] = useState<
    "all" | "trained" | "untrained"
  >("all");

  // Track whether we've already auto-expanded a default group so we don't
  // force it open again after the user manually collapses everything.
  const hasAutoExpandedRef = useRef(false);

  // When the encyclopedia first loads, open a sensible default group so the
  // page never feels like an empty wall of collapsed sections. Prefer Gunnery
  // if present, otherwise fall back to the first group. This runs once per
  // data load and will not re-open groups after the user collapses them.
  useEffect(() => {
    if (!data || hasSearchQuery || hasAutoExpandedRef.current) {
      return;
    }

    const groups = data.categories[0]?.groups ?? [];
    if (groups.length === 0) return;

    const preferred =
      groups.find((g) => g.groupId === 255) /* Gunnery */ ?? groups[0];

    setOpenGroupIds(new Set([preferred.groupId]));
    hasAutoExpandedRef.current = true;
  }, [data, hasSearchQuery]);

  const handleGroupClick = (groupId: number) => {
    setActiveSectionId(null);
    setOpenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Always compute filtered skills via useMemo so Hook order is stable across renders.
  const filteredSkills = useMemo(() => {
    let allSkills = data?.skills ?? [];
    if (hasCharacterOverlay && statusFilter !== "all") {
      allSkills = allSkills.filter((skill) => {
        const status = skillStatusById?.[skill.skillId];
        if (statusFilter === "trained") {
          return status && status.trainedLevel > 0;
        }
        // untrained
        return !status || status.trainedLevel === 0;
      });
    }
    if (!searchQuery.trim()) return allSkills;
    const query = searchQuery.toLowerCase();
    return allSkills.filter((skill) => {
      const name = skill.name.toLowerCase();
      const description = (skill.description ?? "").toLowerCase();
      const groupName = skill.groupName.toLowerCase();
      return (
        name.includes(query) ||
        description.includes(query) ||
        groupName.includes(query)
      );
    });
  }, [data, searchQuery, hasCharacterOverlay, statusFilter, skillStatusById]);

  const [selectedSkill, setSelectedSkill] =
    useState<SkillEncyclopediaEntry | null>(null);

  const handleOpenSkill = (skill: SkillEncyclopediaEntry) => {
    setSelectedSkill(skill);
  };

  const handleSelectNext = () => {
    if (!selectedSkill || filteredSkills.length === 0) return;
    const index = filteredSkills.findIndex(
      (s) => s.skillId === selectedSkill.skillId,
    );
    if (index === -1) return;
    const next = filteredSkills[(index + 1) % filteredSkills.length];
    setSelectedSkill(next);
  };

  const handleSelectPrev = () => {
    if (!selectedSkill || filteredSkills.length === 0) return;
    const index = filteredSkills.findIndex(
      (s) => s.skillId === selectedSkill.skillId,
    );
    if (index === -1) return;
    const prev =
      filteredSkills[
        (index - 1 + filteredSkills.length) % filteredSkills.length
      ];
    setSelectedSkill(prev);
  };

  const skillById = useMemo(() => {
    const map = new Map<number, SkillEncyclopediaEntry>();
    for (const skill of data?.skills ?? []) {
      map.set(skill.skillId, skill);
    }
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data || data.skills.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 p-8 text-center">
        <p className="text-sm text-foreground/70">
          No skills found. The skill encyclopedia may not be loaded yet.
        </p>
      </div>
    );
  }

  // Group filtered skills by groupId
  const skillsByGroup = new Map<number, SkillEncyclopediaEntry[]>();
  for (const skill of filteredSkills) {
    if (!skillsByGroup.has(skill.groupId)) {
      skillsByGroup.set(skill.groupId, []);
    }
    skillsByGroup.get(skill.groupId)!.push(skill);
  }

  const filteredGroups =
    data?.categories[0]?.groups.filter((group) =>
      skillsByGroup.has(group.groupId),
    ) ?? [];

  type SkillSection = {
    id: string;
    label: string;
    skills: SkillEncyclopediaEntry[];
  };

  // Frontend-only sub-group configuration for large, well-known groups.
  const buildSectionsForGroup = (
    groupId: number,
    groupName: string,
    groupSkills: SkillEncyclopediaEntry[],
  ): SkillSection[] => {
    const name = groupName.toLowerCase();

    // If the backend provides curated sub-groups, prefer those over heuristics.
    const hasBackendSubgroups = groupSkills.some(
      (skill) => skill.subGroupKey && skill.subGroupKey.length > 0,
    );

    if (hasBackendSubgroups) {
      const sectionsByKey = new Map<string, SkillSection>();

      for (const skill of groupSkills) {
        const key = skill.subGroupKey || "other";
        const label =
          skill.subGroupLabel ||
          (key === "other"
            ? `Other ${groupName} Skills`
            : key.replace(/_/g, " "));

        const existing = sectionsByKey.get(key);
        if (existing) {
          existing.skills.push(skill);
        } else {
          sectionsByKey.set(key, {
            id: key,
            label,
            skills: [skill],
          });
        }
      }

      // Custom ordering for backend-driven subgroups so the pill bar reads
      // Small → Medium → Large → Capital → Support → Other (left to right).
      const orderedKeysForGroup: Record<number, string[]> = {
        255: [
          "gunnery_small",
          "gunnery_small_t2",
          "gunnery_medium",
          "gunnery_medium_t2",
          "gunnery_large",
          "gunnery_large_t2",
          "gunnery_capital",
          "gunnery_capital_t2",
          "gunnery_support",
          "other",
        ],
        257: [
          "spaceship_frigates",
          "spaceship_cruisers",
          "spaceship_battleships",
          "spaceship_support",
          "other",
        ],
      };

      const result: SkillSection[] = [];
      const order = orderedKeysForGroup[groupId];

      const pushSectionInOrder = (key: string) => {
        const section = sectionsByKey.get(key);
        if (!section || section.skills.length === 0) return;
        // Sort skills in-section by training rank, then name.
        section.skills.sort(
          (a, b) =>
            a.trainingMultiplier - b.trainingMultiplier ||
            a.name.localeCompare(b.name),
        );
        result.push(section);
        sectionsByKey.delete(key);
      };

      if (order) {
        for (const key of order) {
          pushSectionInOrder(key);
        }
      }

      // Any remaining sections (for future groups without explicit ordering)
      // fall back to label ordering.
      if (sectionsByKey.size) {
        const remaining = Array.from(sectionsByKey.values());
        remaining.sort((a, b) => a.label.localeCompare(b.label));
        for (const section of remaining) {
          section.skills.sort(
            (a, b) =>
              a.trainingMultiplier - b.trainingMultiplier ||
              a.name.localeCompare(b.name),
          );
          result.push(section);
        }
      }

      return result;
    }

    // Gunnery
    if (groupId === 255 || name === "gunnery") {
      const sections: Omit<SkillSection, "skills">[] = [
        { id: "small", label: "Small Turrets" },
        { id: "medium", label: "Medium Turrets" },
        { id: "large", label: "Large Turrets" },
        { id: "capital", label: "Capital Weapons" },
        { id: "support", label: "Support Skills" },
      ];

      const buckets: Record<string, SkillEncyclopediaEntry[]> = {};
      const other: SkillEncyclopediaEntry[] = [];

      for (const section of sections) {
        buckets[section.id] = [];
      }

      for (const skill of groupSkills) {
        const skillName = skill.name.toLowerCase();

        if (
          skillName.includes("small ") &&
          /turret|railgun|artillery|autocannon|beam|pulse|blaster/.test(
            skillName,
          )
        ) {
          buckets["small"].push(skill);
        } else if (
          skillName.includes("medium ") &&
          /turret|railgun|artillery|autocannon|beam|pulse|blaster/.test(
            skillName,
          )
        ) {
          buckets["medium"].push(skill);
        } else if (
          skillName.includes("large ") &&
          /turret|railgun|artillery|autocannon|beam|pulse|blaster/.test(
            skillName,
          )
        ) {
          buckets["large"].push(skill);
        } else if (
          /\bcapital\b|\bxl\b|\bcitadel\b/.test(skillName) ||
          skillName.includes("doomsday")
        ) {
          buckets["capital"].push(skill);
        } else if (
          skillName.includes("gunnery") ||
          skillName.includes("trajectory") ||
          skillName.includes("controlled bursts") ||
          skillName.includes("surgical strike") ||
          skillName.includes("motion prediction") ||
          skillName.includes("rapid firing")
        ) {
          buckets["support"].push(skill);
        } else {
          other.push(skill);
        }
      }

      const result: SkillSection[] = [];
      for (const section of sections) {
        const items = buckets[section.id];
        if (items.length) {
          // Sort by rank within each heuristic bucket as well.
          items.sort(
            (a, b) =>
              a.trainingMultiplier - b.trainingMultiplier ||
              a.name.localeCompare(b.name),
          );
          result.push({
            id: section.id,
            label: section.label,
            skills: items,
          });
        }
      }
      if (other.length) {
        other.sort(
          (a, b) =>
            a.trainingMultiplier - b.trainingMultiplier ||
            a.name.localeCompare(b.name),
        );
        result.push({
          id: "other",
          label: "Other Gunnery Skills",
          skills: other,
        });
      }
      return result;
    }

    // Spaceship Command
    if (groupId === 257 || name === "spaceship command") {
      const frigateKeywords = ["frigate", "destroyer", "interceptor"];
      const cruiserKeywords = ["cruiser", "battlecruiser", "strategic cruiser"];
      const battleshipKeywords = ["battleship", "dreadnought", "titan"];

      const frigates: SkillEncyclopediaEntry[] = [];
      const cruisers: SkillEncyclopediaEntry[] = [];
      const battleships: SkillEncyclopediaEntry[] = [];
      const support: SkillEncyclopediaEntry[] = [];
      const other: SkillEncyclopediaEntry[] = [];

      for (const skill of groupSkills) {
        const skillName = skill.name.toLowerCase();

        if (frigateKeywords.some((k) => skillName.includes(k))) {
          frigates.push(skill);
        } else if (cruiserKeywords.some((k) => skillName.includes(k))) {
          cruisers.push(skill);
        } else if (battleshipKeywords.some((k) => skillName.includes(k))) {
          battleships.push(skill);
        } else if (
          skillName.includes("spaceship command") ||
          skillName.includes("spaceship") ||
          skillName.includes("starship") ||
          skillName.includes("support")
        ) {
          support.push(skill);
        } else {
          other.push(skill);
        }
      }

      const result: SkillSection[] = [];
      if (frigates.length) {
        frigates.sort(
          (a, b) =>
            a.trainingMultiplier - b.trainingMultiplier ||
            a.name.localeCompare(b.name),
        );
        result.push({
          id: "frigates",
          label: "Frigates & Destroyers",
          skills: frigates,
        });
      }
      if (cruisers.length) {
        cruisers.sort(
          (a, b) =>
            a.trainingMultiplier - b.trainingMultiplier ||
            a.name.localeCompare(b.name),
        );
        result.push({
          id: "cruisers",
          label: "Cruisers & Battlecruisers",
          skills: cruisers,
        });
      }
      if (battleships.length) {
        battleships.sort(
          (a, b) =>
            a.trainingMultiplier - b.trainingMultiplier ||
            a.name.localeCompare(b.name),
        );
        result.push({
          id: "battleships",
          label: "Battleships & Capitals",
          skills: battleships,
        });
      }
      if (support.length) {
        support.sort(
          (a, b) =>
            a.trainingMultiplier - b.trainingMultiplier ||
            a.name.localeCompare(b.name),
        );
        result.push({
          id: "support",
          label: "Support & Misc",
          skills: support,
        });
      }
      if (other.length) {
        other.sort(
          (a, b) =>
            a.trainingMultiplier - b.trainingMultiplier ||
            a.name.localeCompare(b.name),
        );
        result.push({
          id: "other",
          label: "Other Ship Skills",
          skills: other,
        });
      }
      return result;
    }

    // Default: single section with all skills.
    return [
      {
        id: "all",
        label: "All skills",
        skills: groupSkills,
      },
    ];
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
          <Input
            placeholder="Search all skills by name, description, or group..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-8 focus-visible:ring-2 focus-visible:ring-primary/50"
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
          Results and group counts update across all categories as you type.
        </p>

        {/* Summary stats + filters */}
        <div className="rounded-md border bg-background/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-foreground">Total skills:</span>{" "}
                <span className="font-semibold text-foreground">
                  {filteredSkills.length}
                  {searchQuery && (
                    <span className="text-foreground/70">
                      {" "}
                      (filtered from {data.skills.length})
                    </span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-foreground">Skill groups:</span>{" "}
                <span className="font-semibold text-foreground">
                  {filteredGroups.length}
                  {searchQuery && (
                    <span className="text-foreground/70">
                      {" "}
                      (filtered from {data.categories[0]?.groups.length ?? 0})
                    </span>
                  )}
                </span>
              </div>
            </div>
            {hasCharacterOverlay && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-foreground/70">Filter:</span>
                <div className="inline-flex overflow-hidden rounded-full border bg-background text-[11px]">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1 ${
                      statusFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/80 hover:bg-muted/60"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("trained")}
                    className={`px-3 py-1 border-l ${
                      statusFilter === "trained"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/80 hover:bg-muted/60"
                    }`}
                  >
                    Trained
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("untrained")}
                    className={`px-3 py-1 border-l ${
                      statusFilter === "untrained"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/80 hover:bg-muted/60"
                    }`}
                  >
                    Untrained
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Flat search results preview */}
        {hasSearchQuery && filteredSkills.length > 0 && (
          <div className="rounded-md border bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-foreground/80">
              <span className="font-semibold">
                Search results ({filteredSkills.length.toLocaleString()})
              </span>
              <span>
                Showing first{" "}
                {Math.min(10, filteredSkills.length).toLocaleString()}{" "}
                {filteredSkills.length > 10
                  ? `of ${filteredSkills.length.toLocaleString()} matches`
                  : "matches"}
              </span>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {filteredSkills.slice(0, 10).map((skill) => (
                <button
                  key={skill.skillId}
                  type="button"
                  onClick={() => setSelectedSkill(skill)}
                  className="flex w-full items-center justify-between rounded-md bg-background px-3 py-1.5 text-left text-xs hover:bg-muted/70"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {highlightMatches(skill.name, searchQuery)}
                    </span>
                    <span className="truncate text-[11px] text-foreground/70">
                      {skill.groupName}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="ml-2 shrink-0 px-2 py-0.5 text-[10px]"
                  >
                    Rank {skill.trainingMultiplier}x
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Skill groups */}
        {filteredGroups.length === 0 && searchQuery ? (
          <div className="rounded-md border bg-muted/20 p-8 text-center">
            <p className="text-sm text-foreground">
              No skills found matching &quot;{searchQuery}&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGroups.map((group) => {
              const groupSkills = skillsByGroup.get(group.groupId) ?? [];
              const isActive = hasSearchQuery
                ? true
                : openGroupIds.has(group.groupId);
              const sections = buildSectionsForGroup(
                group.groupId,
                group.groupName,
                groupSkills,
              );

              const visibleSkillCount = groupSkills.length;
              const totalSkillCount = group.skillCount;

              const groupDescription =
                group.groupId === 255
                  ? "Turret and weapon support skills for all turret sizes."
                  : group.groupId === 257
                    ? "Ship command skills across frigates, cruisers, battleships, and capitals."
                    : undefined;

              const hasMultipleSections = sections.length > 1;

              return (
                <div
                  key={group.groupId}
                  className={`rounded-md border bg-background/50 transition-colors ${
                    isActive ? "border-primary bg-primary/5 shadow-sm" : ""
                  }`}
                >
                  {/* Group header */}
                  <button
                    onClick={() => handleGroupClick(group.groupId)}
                    className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      {isActive ? (
                        <ChevronDown className="h-4 w-4 text-foreground/70" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-foreground/70" />
                      )}
                      <span className="font-semibold">{group.groupName}</span>
                      <Badge variant="outline" className="text-xs">
                        {visibleSkillCount.toLocaleString()} skills
                        {searchQuery &&
                          visibleSkillCount !== totalSkillCount && (
                            <span className="ml-1 text-foreground/70">
                              (of {totalSkillCount.toLocaleString()})
                            </span>
                          )}
                      </Badge>
                      {isActive && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase tracking-wide"
                        >
                          Selected
                        </Badge>
                      )}
                    </div>
                  </button>

                  {/* Active group content */}
                  {isActive && (
                    <div className="border-t bg-background/40">
                      {/* Context header + section jump controls */}
                      <div className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                          <div className="text-sm">
                            <div className="font-semibold text-foreground">
                              {group.groupName} –{" "}
                              {visibleSkillCount.toLocaleString()} skills
                            </div>
                            {groupDescription && (
                              <p className="text-xs text-foreground/70">
                                {groupDescription}
                              </p>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 md:mt-0">
                            {hasMultipleSections && (
                              <div className="flex flex-wrap gap-2">
                                {sections.map((section) => (
                                  <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => {
                                      setActiveSectionId(section.id);
                                      const el =
                                        sectionRefs.current[
                                          `${group.groupId}-${section.id}`
                                        ];
                                      if (el) {
                                        el.scrollIntoView({
                                          behavior: "smooth",
                                          block: "start",
                                        });
                                      }
                                    }}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                                      activeSectionId === section.id
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border bg-background/80 text-foreground hover:bg-muted/60"
                                    }`}
                                  >
                                    {section.label}
                                  </button>
                                ))}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleGroupClick(group.groupId)}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60"
                              aria-label={`Collapse ${group.groupName}`}
                            >
                              <ChevronUp className="h-3 w-3" />
                              <span className="hidden sm:inline">Collapse</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Group skills list with optional sub-sections */}
                      <div className="space-y-4 px-4 py-4">
                        {sections.map((section) => (
                          <div
                            key={section.id}
                            ref={(el) => {
                              sectionRefs.current[
                                `${group.groupId}-${section.id}`
                              ] = el;
                            }}
                            className="space-y-2"
                          >
                            {hasMultipleSections && (
                              <div className="flex items-center justify-between text-xs text-foreground/80">
                                <div className="font-semibold">
                                  {section.label}
                                </div>
                                <div>
                                  {section.skills.length.toLocaleString()}{" "}
                                  skills
                                </div>
                              </div>
                            )}
                            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                              {section.skills.map((skill) => (
                                <div
                                  key={skill.skillId}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => handleOpenSkill(skill)}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      handleOpenSkill(skill);
                                    }
                                  }}
                                  className="flex flex-col items-stretch justify-between rounded-md border bg-background/60 p-3 text-left text-sm shadow-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                >
                                  <div className="space-y-1">
                                    <div className="text-sm font-semibold text-foreground line-clamp-1">
                                      {skill.name}
                                    </div>
                                    {skill.description && (
                                      <p className="text-xs text-foreground/70 line-clamp-2">
                                        {skill.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="mt-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="secondary"
                                        className={`px-2 py-0.5 text-[11px] ${
                                          skill.trainingMultiplier <= 2
                                            ? "bg-emerald-500/20 text-emerald-300"
                                            : skill.trainingMultiplier <= 5
                                              ? "bg-amber-500/20 text-amber-300"
                                              : skill.trainingMultiplier <= 10
                                                ? "bg-orange-500/20 text-orange-300"
                                                : "bg-red-500/20 text-red-300"
                                        }`}
                                      >
                                        <Zap className="mr-1 h-3 w-3" />
                                        Rank {skill.trainingMultiplier}x
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="px-2 py-0.5 text-[11px] font-medium"
                                      >
                                        {skill.primaryAttribute
                                          .slice(0, 3)
                                          .toUpperCase()}{" "}
                                        /{" "}
                                        {skill.secondaryAttribute
                                          .slice(0, 3)
                                          .toUpperCase()}
                                      </Badge>
                                      {hasCharacterOverlay &&
                                        (() => {
                                          const status =
                                            skillStatusById?.[skill.skillId];
                                          if (
                                            !status ||
                                            status.trainedLevel <= 0
                                          ) {
                                            return (
                                              <Badge className="px-2 py-0.5 text-[10px]">
                                                Not trained
                                              </Badge>
                                            );
                                          }
                                          if (status.isTraining) {
                                            return (
                                              <Badge className="px-2 py-0.5 text-[10px]">
                                                In training
                                              </Badge>
                                            );
                                          }
                                          return (
                                            <Badge className="px-2 py-0.5 text-[10px]">
                                              Level {status.trainedLevel}
                                            </Badge>
                                          );
                                        })()}
                                      <Checkbox
                                        className="h-3 w-3"
                                        checked={comparedSkillIds.has(
                                          skill.skillId,
                                        )}
                                        // Prevent toggling comparison when pressing Enter/Space
                                        // on the card container; we only want direct clicks.
                                        onClick={(e) => e.stopPropagation()}
                                        onCheckedChange={(checked) => {
                                          setComparedSkillIds((prev) => {
                                            const next = new Set(prev);
                                            if (checked) {
                                              next.add(skill.skillId);
                                            } else {
                                              next.delete(skill.skillId);
                                            }
                                            return next;
                                          });
                                        }}
                                        aria-label="Include in comparison"
                                      />
                                      <ChevronRight className="h-4 w-4 text-foreground/40" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparison drawer */}
      {comparedSkillIds.size > 0 && (
        <div className="mt-4 rounded-md border bg-background/70 p-3 text-xs">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground/80">
              Compared skills ({comparedSkillIds.size})
            </span>
            <button
              type="button"
              className="text-foreground/60 hover:text-foreground/80"
              onClick={() => setComparedSkillIds(new Set())}
            >
              Clear
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {Array.from(comparedSkillIds)
              .map((id) => skillById.get(id))
              .filter((s): s is SkillEncyclopediaEntry => !!s)
              .map((skill) => (
                <div
                  key={skill.skillId}
                  className="rounded-md border bg-background px-3 py-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold line-clamp-1">
                      {skill.name}
                    </div>
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {skill.trainingMultiplier}x
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground/70">
                    <span>
                      {skill.primaryAttribute.slice(0, 3).toUpperCase()} /{" "}
                      {skill.secondaryAttribute.slice(0, 3).toUpperCase()}
                    </span>
                    <span>SP: {skill.spLevel5.toLocaleString()}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Skill detail modal */}
      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          open={!!selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onSelectRelatedSkill={(skillId) => {
            const next = skillById.get(skillId);
            if (next) {
              setSelectedSkill(next);
            }
          }}
          onNext={handleSelectNext}
          onPrev={handleSelectPrev}
        />
      )}
    </>
  );
}
