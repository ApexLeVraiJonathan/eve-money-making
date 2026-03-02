"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@eve/ui";
import { useSkillEncyclopedia } from "@/app/characters/skills/browser/api";
import { SkillDetailModal } from "@/app/characters/skills/browser/components/skill-detail-modal";
import { useMyCharacters } from "@/app/tradecraft/api/characters/users.hooks";
import type {
  SkillIssueInfluencingSkill,
  SkillIssueSkillRequirement,
} from "@eve/shared/skill-contracts";
import { useSkillIssueAnalyze } from "../api";
import { CATEGORY_ORDER, DEFAULT_EFT, type InfluenceCategory } from "./lib/constants";
import { AnalyzeControlsCard } from "./sections/analysis-controls-card";
import { EmptyAnalysisState } from "./sections/empty-analysis-state";
import { InfluencingSkillsCard } from "./sections/influencing-skills-card";
import { SkillIssuePageHero } from "./sections/page-hero";
import { RequiredSkillsCard } from "./sections/required-skills-card";

export function SkillIssuePageClient() {
  const { data: characters = [], isLoading: charsLoading } = useMyCharacters();
  const { data: encyclopedia } = useSkillEncyclopedia();
  const [characterId, setCharacterId] = useState<number | null>(null);
  const [eft, setEft] = useState<string>(DEFAULT_EFT);
  const [eftDraft, setEftDraft] = useState<string>(DEFAULT_EFT);
  const [influencingQuery, setInfluencingQuery] = useState<string>("");
  const [influencingSort, setInfluencingSort] = useState<"impact" | "name">(
    "impact",
  );
  const [influencingCategory, setInfluencingCategory] = useState<
    InfluenceCategory | "All"
  >("All");
  const [showMetRequired, setShowMetRequired] = useState<boolean>(false);
  const [skillModalOpen, setSkillModalOpen] = useState<boolean>(false);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);

  const analyze = useSkillIssueAnalyze();
  const result = analyze.data;

  useEffect(() => {
    if (!characters.length) {
      setCharacterId(null);
      return;
    }
    if (characterId && characters.some((character) => character.id === characterId)) {
      return;
    }
    const primary = characters.find((character) => character.isPrimary) ?? characters[0] ?? null;
    setCharacterId(primary?.id ?? null);
  }, [characters, characterId]);

  const selectedSkill = useMemo(() => {
    if (!encyclopedia || selectedSkillId == null) return null;
    return encyclopedia.skills.find((skill) => skill.skillId === selectedSkillId) ?? null;
  }, [encyclopedia, selectedSkillId]);

  const openSkill = (skillId: number) => {
    setSelectedSkillId(skillId);
    const exists = encyclopedia?.skills?.some((skill) => skill.skillId === skillId) ?? false;
    if (!exists) {
      toast("Skill details unavailable", {
        description:
          "We couldn't load this skill's description. Try refreshing, or open Skills -> Browser.",
      });
      return;
    }
    setSkillModalOpen(true);
  };

  const requiredSorted = useMemo(() => {
    const list = result?.requiredSkills ?? [];
    return [...list].sort(
      (a: SkillIssueSkillRequirement, b: SkillIssueSkillRequirement) => {
        const rank = (skill: SkillIssueSkillRequirement) =>
          skill.status === "missing" ? 0 : skill.status === "unknown" ? 1 : 2;
        const rankA = rank(a);
        const rankB = rank(b);
        if (rankA !== rankB) return rankA - rankB;
        return (a.skillName ?? `${a.skillId}`).localeCompare(b.skillName ?? `${b.skillId}`);
      },
    );
  }, [result]);

  const requiredMissing = useMemo(
    () => requiredSorted.filter((skill) => skill.status === "missing"),
    [requiredSorted],
  );
  const requiredMetOrUnknown = useMemo(
    () => requiredSorted.filter((skill) => skill.status !== "missing"),
    [requiredSorted],
  );

  const influencingFiltered = useMemo(() => {
    const list = result?.influencingSkills ?? [];
    const query = influencingQuery.trim().toLowerCase();
    const filteredByQuery = query
      ? list.filter((skill) =>
          (skill.skillName ?? `${skill.skillId}`).toLowerCase().includes(query),
        )
      : list;
    const filteredByCategory =
      influencingCategory === "All"
        ? filteredByQuery
        : filteredByQuery.filter((skill) =>
            (
              (skill.categories?.length
                ? skill.categories
                : ["Other"]) as Array<InfluenceCategory>
            ).includes(influencingCategory),
          );
    return [...filteredByCategory].sort(
      (a: SkillIssueInfluencingSkill, b: SkillIssueInfluencingSkill) => {
        if (influencingSort === "name") {
          return (a.skillName ?? `${a.skillId}`).localeCompare(b.skillName ?? `${b.skillId}`);
        }
        const impactA = a.modifiedAttributeIds?.length ?? 0;
        const impactB = b.modifiedAttributeIds?.length ?? 0;
        if (impactB !== impactA) return impactB - impactA;
        return (a.skillName ?? `${a.skillId}`).localeCompare(b.skillName ?? `${b.skillId}`);
      },
    );
  }, [result, influencingQuery, influencingSort, influencingCategory]);

  const influencingCategoryCounts = useMemo(() => {
    const counts = CATEGORY_ORDER.reduce((acc, category) => {
      acc.set(category, 0);
      return acc;
    }, new Map<InfluenceCategory, number>());

    (result?.influencingSkills ?? []).forEach((skill) => {
      const categories = (
        skill.categories?.length ? skill.categories : ["Other"]
      ) as Array<InfluenceCategory>;
      categories.forEach((category) => {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      });
    });

    return counts;
  }, [result]);

  const canAnalyze = !!characterId && eft.trim().length > 0 && !analyze.isPending;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 space-y-6">
      <SkillIssuePageHero />

      <AnalyzeControlsCard
        characters={characters}
        charsLoading={charsLoading}
        characterId={characterId}
        setCharacterId={setCharacterId}
        eft={eft}
        setEft={setEft}
        eftDraft={eftDraft}
        setEftDraft={setEftDraft}
        canAnalyze={canAnalyze}
        analyzeState={{ isPending: analyze.isPending, error: analyze.error }}
        onAnalyze={() => analyze.mutate({ characterId: characterId ?? 0, eft })}
      />

      {result ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <InfluencingSkillsCard
            allSkillsCount={result.influencingSkills.length}
            influencingFiltered={influencingFiltered}
            influencingCategoryCounts={influencingCategoryCounts}
            influencingQuery={influencingQuery}
            setInfluencingQuery={setInfluencingQuery}
            influencingCategory={influencingCategory}
            setInfluencingCategory={setInfluencingCategory}
            influencingSort={influencingSort}
            setInfluencingSort={setInfluencingSort}
            unresolvedTypeNames={result.fit?.unresolvedTypeNames}
            onOpenSkill={openSkill}
          />

          <RequiredSkillsCard
            requiredSkills={result.requiredSkills}
            requiredSorted={requiredSorted}
            requiredMissing={requiredMissing}
            requiredMetOrUnknown={requiredMetOrUnknown}
            showMetRequired={showMetRequired}
            setShowMetRequired={setShowMetRequired}
            onOpenSkill={openSkill}
          />
        </div>
      ) : (
        <EmptyAnalysisState />
      )}

      {selectedSkill ? (
        <SkillDetailModal
          skill={selectedSkill}
          open={skillModalOpen}
          onClose={() => setSkillModalOpen(false)}
          onSelectRelatedSkill={(skillId) => openSkill(skillId)}
        />
      ) : null}
    </div>
  );
}
