"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@eve/ui";
import type {
  CharacterAttributesResponse,
  CharacterSkillsResponse,
  CharacterTrainingQueueSummary,
  SkillEncyclopediaEntry,
  SkillEncyclopediaResponse,
} from "@eve/shared/skill-contracts";
import {
  estimateTrainingTimeSeconds,
  type AttributeSet,
  type SkillPrimaryAttribute,
} from "@eve/shared/skills";
import { toRoman } from "../lib/skills-page-utils";

type SkillsListCardProps = {
  loading: boolean;
  skills: CharacterSkillsResponse | null | undefined;
  skillNameById: Map<number, string>;
  encyclopedia: SkillEncyclopediaResponse | null | undefined;
  onSkillClick?: (skillId: number) => void;
  attrs: CharacterAttributesResponse | null | undefined;
  queue: CharacterTrainingQueueSummary | null | undefined;
};

type SkillRow = CharacterSkillsResponse["skills"][number];

export function SkillsListCard({
  loading,
  skills,
  skillNameById,
  encyclopedia,
  onSkillClick,
  attrs,
  queue,
}: SkillsListCardProps) {
  const [tab, setTab] = useState<"all" | "summary">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5]));
  const [rankFilter, setRankFilter] = useState<Set<number>>(new Set());
  const [attributeFilter, setAttributeFilter] = useState<string>("");
  const [showOnlyNotLearned, setShowOnlyNotLearned] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [hasInitializedCollapse, setHasInitializedCollapse] = useState(false);

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

  const formatTrainingTime = (seconds: number): string => {
    if (seconds <= 0) return "—";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getTrainingTimeToNextLevel = (skillId: number, currentLevel: number): string => {
    if (currentLevel >= 5 || !attributeSet) return "—";

    const encyclopediaEntry = encyclopedia?.skills.find((s) => s.skillId === skillId);
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

    const totalSkillsByGroup = new Map<string, number>();
    const maxSpByGroup = new Map<string, number>();
    for (const skill of encyclopedia.skills) {
      totalSkillsByGroup.set(
        skill.groupName,
        (totalSkillsByGroup.get(skill.groupName) ?? 0) + 1,
      );
      const maxSp = typeof skill.spLevel5 === "number" ? skill.spLevel5 : 0;
      maxSpByGroup.set(skill.groupName, (maxSpByGroup.get(skill.groupName) ?? 0) + maxSp);
    }

    for (const skill of skills.skills) {
      const encyclopediaEntry = encyclopedia.skills.find((s) => s.skillId === skill.skillId);
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

  const getLevelColor = (level: number): string => {
    if (level === 0) return "text-foreground/40";
    if (level <= 2) return "text-yellow-600 dark:text-yellow-500";
    if (level <= 4) return "text-blue-600 dark:text-blue-400";
    return "text-purple-600 dark:text-purple-400";
  };

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

  const filteredSkills = useMemo(() => {
    if (!skills?.skills) return [];

    const baseSkills: SkillRow[] = showOnlyNotLearned
      ? [...skills.skills, ...notLearnedSkills]
      : skills.skills;

    let filtered = baseSkills;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((skill) => {
        const encyclopediaEntry = encyclopedia?.skills.find((s) => s.skillId === skill.skillId);
        const name = (skillNameById.get(skill.skillId) ?? "").toLowerCase();
        const skillId = String(skill.skillId);
        const groupName = encyclopediaEntry?.groupName?.toLowerCase() ?? "";

        const matchesBasic =
          name.includes(query) || skillId.includes(query) || groupName.includes(query);

        const matchesPrereq =
          encyclopediaEntry?.prerequisites.some((prereq) => {
            const prereqName = skillNameById.get(prereq.skillId)?.toLowerCase() ?? "";
            return prereqName.includes(query);
          }) ?? false;

        return matchesBasic || matchesPrereq;
      });
    }

    filtered = filtered.filter((skill) => levelFilter.has(skill.trainedSkillLevel));

    if (rankFilter.size > 0) {
      filtered = filtered.filter((skill) => {
        const encyclopediaEntry = encyclopedia?.skills.find((s) => s.skillId === skill.skillId);
        return encyclopediaEntry && rankFilter.has(encyclopediaEntry.trainingMultiplier);
      });
    }

    if (attributeFilter) {
      filtered = filtered.filter((skill) => {
        const encyclopediaEntry = encyclopedia?.skills.find((s) => s.skillId === skill.skillId);
        return (
          encyclopediaEntry &&
          (encyclopediaEntry.primaryAttribute.toLowerCase() === attributeFilter.toLowerCase() ||
            encyclopediaEntry.secondaryAttribute.toLowerCase() === attributeFilter.toLowerCase())
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

  const groupedSkills = useMemo(() => {
    if (!encyclopedia?.skills || !skills?.skills) return [];

    const encyclopediaMap = new Map<number, SkillEncyclopediaEntry>();
    for (const skill of encyclopedia.skills) {
      encyclopediaMap.set(skill.skillId, skill);
    }

    const groups = new Map<string, typeof filteredSkills>();
    for (const skill of filteredSkills) {
      const encyclopediaEntry = encyclopediaMap.get(skill.skillId);
      if (!encyclopediaEntry) {
        console.warn(`No encyclopedia entry found for skill ID ${skill.skillId}`);
      }
      const groupName = encyclopediaEntry?.groupName ?? "Unknown";

      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)?.push(skill);
    }

    return Array.from(groups.entries())
      .map(([groupName, rows]) => ({ groupName, skills: rows }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [filteredSkills, encyclopedia, skills]);

  useEffect(() => {
    if (!hasInitializedCollapse && groupedSkills.length > 0) {
      const allGroupNames = new Set(groupedSkills.map((g) => g.groupName));
      setCollapsedGroups(allGroupNames);
      setHasInitializedCollapse(true);
    }
  }, [groupedSkills, hasInitializedCollapse]);

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
            <p className="text-sm">Skills could not be loaded for this character.</p>
            <p className="text-sm text-foreground/60">
              This usually means the character needs to be re-authenticated with the
              correct ESI scopes. Click below to refresh the character&apos;s token.
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
  const totalEncyclopediaSkills: number | null = encyclopedia?.skills?.length ?? null;

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

              <div className="flex items-center gap-2 flex-wrap rounded-md border bg-card/50 p-3">
                <span className="text-xs font-medium text-foreground/80">Filter by level:</span>
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

              <div className="flex items-center gap-2 flex-wrap rounded-md border bg-card/50 p-3">
                <span className="text-xs font-medium text-foreground/80">Filter by rank:</span>
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

              <div className="flex items-center gap-2 flex-wrap rounded-md border bg-card/50 p-3">
                <span className="text-xs font-medium text-foreground/80">
                  Filter by attribute:
                </span>
                {["Intelligence", "Memory", "Perception", "Willpower", "Charisma"].map((attr) => (
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
                        attributeFilter.toLowerCase() === attr.toLowerCase() ? "" : attr,
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
                    Showing <span className="font-semibold">{filteredSkills.length}</span> of{" "}
                    {(skills?.skills.length ?? 0) + notLearnedSkills.length} skills
                    {totalEncyclopediaSkills
                      ? ` (out of ${totalEncyclopediaSkills} skills in the encyclopedia)`
                      : ""}
                  </>
                ) : (
                  <>
                    Showing <span className="font-semibold">{filteredSkills.length}</span> of{" "}
                    {skills?.skills.length ?? 0} learned skills for this character
                    {totalEncyclopediaSkills
                      ? ` (out of ${totalEncyclopediaSkills} skills in the encyclopedia)`
                      : ""}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 p-3 bg-accent/30 rounded-md">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground/80">Quick Actions:</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs px-2.5 gap-1.5"
                    onClick={expandAllGroups}
                  >
                    Expand All
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs px-2.5 gap-1.5"
                    onClick={collapseAllGroups}
                  >
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
                      <th className="px-4 py-3 font-semibold w-24 text-center">Level</th>
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
                              onClick={() => toggleGroupCollapse(group.groupName)}
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
                                queue?.entries.some((e) => e.skillId === s.skillId) ?? false;
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
                                          {skillNameById.get(s.skillId) ?? `Skill #${s.skillId}`}
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
                                      s.activeSkillLevel !== s.trainedSkillLevel && (
                                        <span className="ml-1 text-foreground/60 text-xs">
                                          (active {toRoman(s.activeSkillLevel)})
                                        </span>
                                      )}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-sm text-right">
                                    {s.skillpointsInSkill.toLocaleString(undefined, {
                                      maximumFractionDigits: 0,
                                    })}
                                  </td>
                                  <td className="px-4 py-2.5 text-sm text-right text-foreground/70 hidden sm:table-cell">
                                    {s.trainedSkillLevel < 5 ? trainingTime : "Max"}
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
                <div className="text-xs text-foreground/60 mb-1">Unallocated SP</div>
                <div className="text-2xl font-bold font-mono">
                  {skills.unallocatedSp.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-xs text-foreground/60 mb-1">Skills Trained</div>
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
                    <div className="text-xs text-foreground/60 mb-1">Level {idx + 1}</div>
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
