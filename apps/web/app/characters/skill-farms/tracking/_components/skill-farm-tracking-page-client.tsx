"use client";

import * as React from "react";
import {
  useSkillFarmSettings,
  useSkillFarmTracking,
  useUpdateSkillFarmCharacter,
  useUpdateSkillFarmSettings,
} from "../../api";
import { Badge } from "@eve/ui/badge";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";
import { toast } from "@eve/ui";
import { useSkillEncyclopedia } from "../../../skills/browser/api";
import { useSkillPlans } from "../../../skills/api";
import { buildSkillNameById, searchSkills } from "./lib/skill-search";
import { ExtractionTargetsCard } from "./sections/extraction-targets-card";
import { TrackingCharacterCard } from "./sections/tracking-character-card";
import { TrackingEmptyState, TrackingLoadingState } from "./sections/tracking-states";

function TrackingContent() {
  const { data, isLoading } = useSkillFarmTracking();
  const { data: settings } = useSkillFarmSettings();
  const updateSettings = useUpdateSkillFarmSettings();
  const updateCharacter = useUpdateSkillFarmCharacter();
  const { data: encyclopedia } = useSkillEncyclopedia();
  const { data: plansData = [] } = useSkillPlans();

  const skillNameById = React.useMemo(() => {
    return buildSkillNameById(encyclopedia?.skills);
  }, [encyclopedia]);

  const [skillQuery, setSkillQuery] = React.useState("");
  const trimmedQuery = skillQuery.trim().toLowerCase();
  const searchResults = React.useMemo(() => {
    return searchSkills(encyclopedia?.skills, trimmedQuery);
  }, [encyclopedia, trimmedQuery]);

  const plans = React.useMemo(
    () => plansData.map((plan) => ({ id: plan.id, name: plan.name })),
    [plansData],
  );

  const targetIds = settings?.extractionTargetSkillIds ?? [];
  const hasSettings = !!settings;

  const handleToggleTarget = React.useCallback(
    async (skillId: number, isSelected: boolean) => {
      if (!settings) return;
      const next = isSelected
        ? targetIds.filter((id) => id !== skillId)
        : [...targetIds, skillId];
      try {
        await updateSettings.mutateAsync({ extractionTargetSkillIds: next });
        toast.success(isSelected ? "Removed target skill" : "Added target skill");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    },
    [settings, targetIds, updateSettings],
  );

  const handleClearTargets = React.useCallback(async () => {
    if (!settings) return;
    try {
      await updateSettings.mutateAsync({ extractionTargetSkillIds: [] });
      toast.success("Cleared targets");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }, [settings, updateSettings]);

  const handleFarmPlanChange = React.useCallback(
    async (characterId: number, farmPlanId: string | null) => {
      try {
        await updateCharacter.mutateAsync({
          characterId,
          payload: { farmPlanId },
        });
        toast.success("Farm plan updated");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    },
    [updateCharacter],
  );

  if (isLoading) {
    return <TrackingLoadingState />;
  }

  if (!data || !data.characters.length) {
    return <TrackingEmptyState />;
  }

  return (
    <div className="space-y-4">
      <ExtractionTargetsCard
        skillQuery={skillQuery}
        onSkillQueryChange={setSkillQuery}
        trimmedQuery={trimmedQuery}
        searchResults={searchResults}
        targetIds={targetIds}
        skillNameById={skillNameById}
        onToggleTarget={handleToggleTarget}
        onClearTargets={handleClearTargets}
        hasSettings={hasSettings}
      />

      {data.characters.map((character) => (
        <TrackingCharacterCard
          key={character.characterId}
          character={character}
          plans={plans}
          onFarmPlanChange={handleFarmPlanChange}
        />
      ))}
    </div>
  );
}

export default function SkillFarmTrackingPageClient() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <DynamicBreadcrumbs />
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Skill farm tracking
          </h1>
          <Badge variant="secondary" className="text-xs">
            Step 3 of 3
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-foreground/80">
          See extractable SP and queue risk for all active farm characters.
          Discord alerts will fire when extractors are ready or queues go low or
          empty.
        </p>
      </header>
      <TrackingContent />
    </div>
  );
}
