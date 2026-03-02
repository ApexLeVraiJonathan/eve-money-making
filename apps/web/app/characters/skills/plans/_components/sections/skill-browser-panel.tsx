"use client";

import { useMemo, useState } from "react";
import { Badge, Input, Skeleton } from "@eve/ui";
import { ChevronRight } from "lucide-react";
import { useSkillEncyclopedia } from "../../../browser/api";
import { SkillAddButton } from "./skill-add-button";

type SkillBrowserPanelProps = {
  encyclopedia: ReturnType<typeof useSkillEncyclopedia>["data"];
  onAddSkill: (skillId: number, level: number) => void;
  skillsInPlan: Set<number>;
};

export function SkillBrowserPanel({
  encyclopedia,
  onAddSkill,
  skillsInPlan,
}: SkillBrowserPanelProps) {
  const [query, setQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const skills = useMemo(
    () => encyclopedia?.skills ?? [],
    [encyclopedia?.skills],
  );

  const groupedSkills = useMemo(() => {
    const groups = new Map<string, typeof skills>();
    for (const skill of skills) {
      const groupName = skill.groupName || "Other";
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)?.push(skill);
    }
    return Array.from(groups.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [skills]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return null;
    }
    return skills
      .filter((s) => {
        const name = s.name.toLowerCase();
        const id = String(s.skillId);
        const group = s.groupName.toLowerCase();
        return name.includes(q) || id.includes(q) || group.includes(q);
      })
      .slice(0, 150);
  }, [skills, query]);

  if (!encyclopedia) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Skill browser
        </label>
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const totalFiltered = filtered ? filtered.length : skills.length;

  return (
    <div className="flex flex-col space-y-2 h-full">
      <div className="flex items-center justify-between">
        {filtered && (
          <span className="text-[11px] text-muted-foreground">
            {totalFiltered} skill{totalFiltered !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, ID, or group..."
        className="h-8 text-xs"
      />
      <div className="flex-1 overflow-auto rounded-md border bg-card min-h-0">
        {filtered !== null ? (
          filtered.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No skills match your search.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((skill) => (
                <li
                  key={skill.skillId}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[13px]">
                      {skill.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                      <span>• {skill.groupName}</span>
                      {skill.trainingMultiplier && (
                        <span>• x{skill.trainingMultiplier}</span>
                      )}
                    </div>
                  </div>
                  <SkillAddButton
                    skillId={skill.skillId}
                    skillName={skill.name}
                    isInPlan={skillsInPlan.has(skill.skillId)}
                    onAdd={onAddSkill}
                  />
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="divide-y">
            {groupedSkills.map(([groupName, groupSkills]) => {
              const isExpanded = expandedGroups.has(groupName);
              return (
                <div key={groupName}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(groupName)) {
                          next.delete(groupName);
                        } else {
                          next.add(groupName);
                        }
                        return next;
                      });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                      <span>{groupName}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {groupSkills.length}
                    </Badge>
                  </button>
                  {isExpanded && (
                    <ul className="divide-y border-t bg-muted/20">
                      {groupSkills.map((skill) => (
                        <li
                          key={skill.skillId}
                          className="flex items-center justify-between gap-2 px-3 py-2 pl-8 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[13px]">
                              {skill.name}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                              {skill.trainingMultiplier && (
                                <span>x{skill.trainingMultiplier}</span>
                              )}
                            </div>
                          </div>
                          <SkillAddButton
                            skillId={skill.skillId}
                            skillName={skill.name}
                            isInPlan={skillsInPlan.has(skill.skillId)}
                            onAdd={onAddSkill}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
