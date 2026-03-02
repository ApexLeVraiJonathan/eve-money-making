"use client";

import { useState } from "react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@eve/ui";
import { Check, Plus, X } from "lucide-react";
import { romanNumerals } from "../../utils/trainingTime";

type SkillAddButtonProps = {
  skillId: number;
  skillName: string;
  isInPlan: boolean;
  onAdd: (skillId: number, level: number) => void;
};

export function SkillAddButton({
  skillId,
  skillName,
  isInPlan,
  onAdd,
}: SkillAddButtonProps) {
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  if (isInPlan) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-[11px] whitespace-nowrap"
        disabled
      >
        <Check className="mr-1.5 h-3 w-3" />
        Added
      </Button>
    );
  }

  if (showLevelSelect) {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <Tooltip key={level}>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 font-mono text-[10px]"
                onClick={() => {
                  onAdd(skillId, level);
                  setShowLevelSelect(false);
                }}
              >
                {romanNumerals[level]}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Add {skillName} Level {level}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => setShowLevelSelect(false)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2 text-[11px] whitespace-nowrap"
      onClick={() => setShowLevelSelect(true)}
    >
      <Plus className="mr-1.5 h-3 w-3" />
      Add
    </Button>
  );
}
