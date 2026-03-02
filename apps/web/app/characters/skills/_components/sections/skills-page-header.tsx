"use client";

import { BookOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@eve/ui";
import type { CharacterAttributesResponse } from "@eve/shared/skill-contracts";
import type { SkillCharacter } from "../lib/skills-page-hooks";

type SkillsPageHeaderProps = {
  selectedId: number | null;
  onSelectId: (id: number) => void;
  characters: SkillCharacter[];
  attrs: CharacterAttributesResponse | null | undefined;
};

export function SkillsPageHeader({
  selectedId,
  onSelectId,
  characters,
  attrs,
}: SkillsPageHeaderProps) {
  return (
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
          onValueChange={(v) => onSelectId(Number(v))}
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
  );
}
