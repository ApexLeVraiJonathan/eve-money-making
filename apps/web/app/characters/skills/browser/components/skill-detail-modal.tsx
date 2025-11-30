"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eve/ui";
import { Badge } from "@eve/ui";
import { Separator } from "@eve/ui";
import { Zap, Brain } from "lucide-react";
import type { SkillEncyclopediaEntry } from "@eve/api-contracts";

interface SkillDetailModalProps {
  skill: SkillEncyclopediaEntry;
  open: boolean;
  onClose: () => void;
  onSelectRelatedSkill?: (skillId: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export function SkillDetailModal({
  skill,
  open,
  onClose,
  onSelectRelatedSkill,
  onNext,
  onPrev,
}: SkillDetailModalProps) {
  // Backend provides cumulative SP thresholds for each level (from level 0)
  const cumulativeSP = [
    skill.spLevel1,
    skill.spLevel2,
    skill.spLevel3,
    skill.spLevel4,
    skill.spLevel5,
  ];

  // Per-level SP required (delta between cumulative thresholds)
  const perLevelSP = [
    skill.spLevel1,
    skill.spLevel2 - skill.spLevel1,
    skill.spLevel3 - skill.spLevel2,
    skill.spLevel4 - skill.spLevel3,
    skill.spLevel5 - skill.spLevel4,
  ];

  const totalSP = skill.spLevel5;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onNext?.();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      onPrev?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="flex items-start justify-between gap-4">
            <span className="text-2xl">{skill.name}</span>
            <Badge variant="secondary" className="text-sm shrink-0">
              <Zap className="h-4 w-4 mr-1" />
              Rank {skill.trainingMultiplier}x
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/80">
            {skill.description
              ? skill.description
              : "Detailed training attributes, skill point requirements, and prerequisites for this skill."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description (kept brief; full text is also in dialog description) */}
          {skill.description && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Description
              </h3>
              <p className="text-sm text-foreground leading-relaxed">
                {skill.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Prerequisites */}
          {skill.prerequisites && skill.prerequisites.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Prerequisites
              </h3>
              <div className="space-y-1">
                {skill.prerequisites.map((prereq) => (
                  <button
                    key={prereq.skillId}
                    type="button"
                    onClick={() => onSelectRelatedSkill?.(prereq.skillId)}
                    className="flex w-full items-center justify-between rounded-md border bg-background/50 px-3 py-2 text-sm text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="font-medium text-foreground">
                      {prereq.skillName}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Level {prereq.requiredLevel}
                    </Badge>
                  </button>
                ))}
              </div>
              {onSelectRelatedSkill && (
                <p className="text-xs text-foreground/70">
                  Click a prerequisite to open its details.
                </p>
              )}
            </div>
          )}

          {skill.prerequisites.length === 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Prerequisites
              </h3>
              <p className="text-sm text-foreground">
                No prerequisites required. This skill can be trained
                immediately.
              </p>
            </div>
          )}

          {/* Required by */}
          {skill.requiredBy && skill.requiredBy.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Required by
                </h3>
                <div className="space-y-1">
                  {skill.requiredBy.map((entry) => (
                    <button
                      key={entry.skillId}
                      type="button"
                      onClick={() => onSelectRelatedSkill?.(entry.skillId)}
                      className="flex w-full items-center justify-between rounded-md border bg-background/50 px-3 py-2 text-sm text-left transition-colors hover:bg-muted/60"
                    >
                      <span className="font-medium text-foreground">
                        {entry.skillName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Requires level {entry.requiredLevel}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* SP Requirements */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Skill Points per Level
            </h3>
            <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
              <span className="font-semibold text-foreground">
                Total SP (Level V):
              </span>{" "}
              <span className="font-mono font-bold text-foreground">
                {totalSP.toLocaleString()}
              </span>
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className="flex items-center justify-between rounded-md border bg-background/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-foreground">
                    Level {level}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-foreground">
                      {cumulativeSP[level - 1].toLocaleString()} SP total
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      +{perLevelSP[level - 1].toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Training Info */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Training Attributes
            </h3>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-foreground">Primary:</span>{" "}
                <Badge variant="outline" className="ml-1 text-sm font-medium">
                  {skill.primaryAttribute.charAt(0).toUpperCase() +
                    skill.primaryAttribute.slice(1)}
                </Badge>
              </div>
              <div>
                <span className="text-foreground">Secondary:</span>{" "}
                <Badge variant="outline" className="ml-1 text-sm font-medium">
                  {skill.secondaryAttribute.charAt(0).toUpperCase() +
                    skill.secondaryAttribute.slice(1)}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-foreground/80">
              Training speed formula: SP/hour = (60 × Primary) + (30 ×
              Secondary)
            </p>
          </div>

          {/* Category/Group Info */}
          <div className="flex flex-col gap-3 text-xs text-foreground">
            <div className="flex gap-4">
              <div>
                <span>Category:</span>{" "}
                <span className="font-medium">{skill.categoryName}</span>
              </div>
              <div>
                <span>Group:</span>{" "}
                <span className="font-medium">{skill.groupName}</span>
              </div>
              <div>
                <span>ID:</span>{" "}
                <span className="font-mono">{skill.skillId}</span>
              </div>
            </div>
            {(onNext || onPrev) && (
              <p className="text-[11px] text-foreground/60">
                Keyboard: use ← / → to move between skills, and Esc to close.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
