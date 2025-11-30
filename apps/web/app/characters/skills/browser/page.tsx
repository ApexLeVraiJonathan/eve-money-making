"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, FolderTree, GitBranch, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import type { CharacterSkillsResponse } from "@eve/api-contracts";
import { SkillCategoryView } from "./components/skill-category-view";
import { SkillTreeView } from "./components/skill-tree-view";
import {
  useSkillBrowserCharacters,
  useSkillBrowserCharacterSkills,
  useSkillBrowserTrainingQueue,
  useSkillBrowserCharacterAttributes,
} from "./api";
import type { AttributeSet } from "@eve/shared/skills";

type SkillStatus = {
  trainedLevel: number;
  activeLevel: number | null;
  skillpointsInSkill: number;
  isTraining: boolean;
};

function buildSkillStatusMap(
  skills: CharacterSkillsResponse | null | undefined,
  activeTrainingSkillId: number | null,
): Record<number, SkillStatus> {
  if (!skills) return {};
  const map: Record<number, SkillStatus> = {};

  for (const s of skills.skills) {
    map[s.skillId] = {
      trainedLevel: s.trainedSkillLevel,
      activeLevel: s.activeSkillLevel,
      skillpointsInSkill: s.skillpointsInSkill,
      isTraining: activeTrainingSkillId === s.skillId,
    };
  }

  return map;
}

export default function SkillBrowserPage() {
  const [activeTab, setActiveTab] = useState<"categories" | "tree" | "search">(
    "categories",
  );

  const characters = useSkillBrowserCharacters();
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(
    null,
  );

  // Keep selected character in sync with linked characters, preferring primary.
  useEffect(() => {
    if (!characters.length) {
      if (selectedCharacterId !== null) setSelectedCharacterId(null);
      return;
    }

    if (
      selectedCharacterId &&
      characters.some((c) => c.id === selectedCharacterId)
    ) {
      return;
    }

    const primary =
      characters.find((c) => c.isPrimary) ?? characters[0] ?? null;
    if (primary) {
      setSelectedCharacterId(primary.id);
    }
  }, [characters, selectedCharacterId]);

  const { data: characterSkills } =
    useSkillBrowserCharacterSkills(selectedCharacterId);
  const { data: trainingQueue } =
    useSkillBrowserTrainingQueue(selectedCharacterId);
  const { data: characterAttrs } =
    useSkillBrowserCharacterAttributes(selectedCharacterId);

  const activeTrainingSkillId =
    trainingQueue && !trainingQueue.isQueueEmpty && trainingQueue.activeEntry
      ? trainingQueue.activeEntry.skillId
      : null;

  const skillStatusById = useMemo(
    () => buildSkillStatusMap(characterSkills, activeTrainingSkillId),
    [characterSkills, activeTrainingSkillId],
  );

  const hasCharacterOverlay = Object.keys(skillStatusById).length > 0;

  const attributeSet: AttributeSet | null = useMemo(() => {
    if (!characterAttrs) return null;
    return {
      intelligence: characterAttrs.intelligence,
      memory: characterAttrs.memory,
      perception: characterAttrs.perception,
      willpower: characterAttrs.willpower,
      charisma: characterAttrs.charisma,
    };
  }, [characterAttrs]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pb-16">
      {/* Page Header */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/20 text-primary shadow-sm">
              <BookOpen className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold">Skill Browser</h1>
              <p className="text-sm text-foreground/80">
                Explore all EVE Online skills, their dependencies, and training
                requirements in an interactive encyclopedia.
              </p>
            </div>
          </div>

          {characters.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border bg-background/60 px-3 py-2 text-xs">
              <User className="mr-1 h-3 w-3 text-foreground/60" />
              <span className="text-foreground/70">Overlay with</span>
              <Select
                value={
                  selectedCharacterId !== null
                    ? String(selectedCharacterId)
                    : ""
                }
                onValueChange={(v) => setSelectedCharacterId(Number(v))}
              >
                <SelectTrigger className="h-7 w-44 text-xs">
                  <SelectValue placeholder="Select character" />
                </SelectTrigger>
                <SelectContent>
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.isPrimary && " (primary)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="rounded-md border bg-gradient-to-b from-background/80 to-muted/10 p-4 text-sm text-foreground">
          <p className="mb-2 font-medium">Getting started</p>
          <ul className="list-disc space-y-1 pl-5 text-foreground/80">
            <li>
              Use the search box below to find skills by{" "}
              <span className="font-semibold">name</span>,
              <span className="font-semibold"> description</span>, or{" "}
              <span className="font-semibold">group</span>.
            </li>
            <li>
              Expand a skill group such as{" "}
              <span className="font-semibold">Gunnery</span> to browse related
              skills and subcategories.
            </li>
            <li>
              Click any skill card to see detailed training requirements,
              attributes, and prerequisites.
            </li>
            {hasCharacterOverlay && (
              <li>
                With a character selected, badges show{" "}
                <span className="font-semibold">trained</span>,{" "}
                <span className="font-semibold">untrained</span>, and{" "}
                <span className="font-semibold">in training</span> skills.
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* Main Content Card with Tabs */}
      <Card className="bg-gradient-to-b from-background to-muted/10 shadow-md">
        <CardHeader>
          <CardTitle>Explore Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) =>
              setActiveTab(v as "categories" | "tree" | "search")
            }
            className="w-full"
          >
            <TabsList className="w-full">
              <TabsTrigger value="categories" className="gap-2">
                <FolderTree className="h-4 w-4" />
                <span className="hidden sm:inline">Categories</span>
              </TabsTrigger>
              <TabsTrigger value="tree" className="gap-2">
                <GitBranch className="h-4 w-4" />
                <span className="hidden sm:inline">Skill Tree</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="mt-6">
              <SkillCategoryView
                skillStatusById={hasCharacterOverlay ? skillStatusById : {}}
              />
            </TabsContent>
            <TabsContent value="tree" className="mt-6">
              <SkillTreeView
                skillStatusById={hasCharacterOverlay ? skillStatusById : {}}
                attrs={attributeSet ?? undefined}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
