"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import type { SkillEncyclopediaEntry } from "@eve/shared/skill-contracts";
import { useSkillEncyclopedia } from "../browser/api";
import {
  useCharacterAttributes,
  useCharacterSkillsSnapshot,
  useCharacterTrainingQueue,
  useMySkillCharacters,
} from "./lib/skills-page-hooks";
import { createSkillNameByIdMap } from "./lib/skills-page-utils";
import { GettingStartedTips } from "./sections/getting-started-tips";
import { SkillsListCard } from "./sections/skills-list-card";
import { SkillsPageHeader } from "./sections/skills-page-header";
import { TrainingQueueCard } from "./sections/training-queue-card";
import { SkillDetailModal } from "../browser/components/skill-detail-modal";

export function SkillsPageClient() {
  const characters = useMySkillCharacters();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillEncyclopediaEntry | null>(null);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(true);

  useEffect(() => {
    const hideGettingStarted = localStorage.getItem("hideGettingStarted");
    if (hideGettingStarted === "true") {
      setShowGettingStarted(false);
    }
  }, []);

  useEffect(() => {
    if (!characters.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    if (selectedId && characters.some((c) => c.id === selectedId)) {
      return;
    }

    const primary = characters.find((c) => c.isPrimary) ?? characters[0] ?? null;
    if (primary) {
      setSelectedId(primary.id);
    }
  }, [characters, selectedId]);

  const { data: queue, isLoading: queueLoading } = useCharacterTrainingQueue(selectedId);
  const { data: skills, isLoading: skillsLoading } = useCharacterSkillsSnapshot(selectedId);
  const { data: attrs } = useCharacterAttributes(selectedId);
  const { data: encyclopedia } = useSkillEncyclopedia();

  const skillNameById = useMemo(() => createSkillNameByIdMap(encyclopedia), [encyclopedia]);

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
      <SkillsPageHeader
        selectedId={selectedId}
        onSelectId={setSelectedId}
        characters={characters}
        attrs={attrs}
      />

      {characters.length === 0 ? (
        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>No linked characters</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Link at least one character on the Characters page to see skills and training
              information here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <GettingStartedTips
            showGettingStarted={showGettingStarted}
            onDismiss={handleDismissGettingStarted}
            onShow={handleShowGettingStarted}
          />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 overflow-hidden">
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
