"use client";

import * as React from "react";
import { useUpdateSkillFarmCharacter } from "../../../api";
import { Card, CardHeader, CardTitle } from "@eve/ui/card";
import { Badge } from "@eve/ui/badge";
import { Button } from "@eve/ui/button";
import { Label } from "@eve/ui/label";
import { Switch } from "@eve/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@eve/ui/collapsible";
import { toast } from "@eve/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@eve/ui/tooltip";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  XCircle,
} from "lucide-react";
import { getRequirementList } from "../lib/character-utils";
import type { RequirementSummary, SkillFarmCharacter } from "../lib/types";
import { RequirementBadge } from "./requirement-badge";

export function CharacterRow({
  character,
  isActive,
  isReady,
  isCandidate,
  blocking,
  statusLabel,
  statusVariant,
  isPending,
  onSetPending,
  onClearPending,
  updateCharacter,
}: {
  character: SkillFarmCharacter;
  isActive: boolean;
  isReady: boolean;
  isCandidate: boolean;
  blocking: RequirementSummary[];
  statusLabel: string;
  statusVariant: "default" | "secondary" | "outline";
  isPending: boolean;
  onSetPending: (id: number) => void;
  onClearPending: () => void;
  updateCharacter: ReturnType<typeof useUpdateSkillFarmCharacter>;
}) {
  const [open, setOpen] = React.useState(false);

  const reqs = getRequirementList(character);
  const omegaDetailsWithSource = `${character.requirements.training.details ? String(character.requirements.training.details) : ""}${character.requirements.training.details ? "\n\n" : ""}Omega status is taken from the Characters → Overview page.`;
  const missingLabels = blocking.map((b) => b.label);
  const missingSummary =
    missingLabels.length > 0
      ? `Missing ${missingLabels.length}: ${missingLabels
          .slice(0, 2)
          .join(", ")}${
          missingLabels.length > 2 ? ` +${missingLabels.length - 2} more` : ""
        }`
      : null;

  return (
    <Card className="bg-gradient-to-b from-background to-muted/5 p-4 md:p-5">
      <CardHeader className="gap-3">
        <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
          <div className="min-w-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="truncate text-base" title={character.name}>
                {character.name}
              </CardTitle>
              <p className="text-xs text-foreground/80">
                {character.totalSp.toLocaleString()} SP /{" "}
                <span className="font-medium">
                  {Number(5_000_000).toLocaleString()} SP
                </span>{" "}
                non-extractable floor
              </p>
            </div>

            <div className="min-w-0 flex flex-wrap items-center gap-2 sm:justify-end">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              {!isActive && !isReady && missingSummary && (
                <Badge variant="outline" className="max-w-full truncate">
                  {missingSummary}
                </Badge>
              )}
            </div>
          </div>

          <div className="min-w-0 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <RequirementBadge
                label="5.0M SP"
                status={character.requirements.minSp.status}
                details={character.requirements.minSp.details}
              />
              <RequirementBadge
                label="Biology V"
                status={character.requirements.biology.status}
                details={character.requirements.biology.details}
              />
              <RequirementBadge
                label="Cybernetics V"
                status={character.requirements.cybernetics.status}
                details={character.requirements.cybernetics.details}
              />
              <RequirementBadge
                label="Remap available"
                status={character.requirements.remap.status}
                details={character.requirements.remap.details}
              />
              <RequirementBadge
                label="Omega"
                status={character.requirements.training.status}
                details={omegaDetailsWithSource}
              />
              <RequirementBadge
                label="+5 Per/Wil & BY-810"
                status={character.requirements.implants.status}
                details={character.requirements.implants.details}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`candidate-${character.characterId}`}
                    checked={isCandidate}
                    disabled={isPending}
                    onCheckedChange={(checked) => {
                      onSetPending(character.characterId);
                      updateCharacter.mutate(
                        {
                          characterId: character.characterId,
                          payload: { isCandidate: checked },
                        },
                        {
                          onSuccess: () => {
                            toast.success(
                              checked
                                ? `${character.name} marked as candidate`
                                : `${character.name} removed from candidates`,
                            );
                          },
                          onError: () => {
                            toast.error("Failed to update candidate status");
                          },
                          onSettled: () => onClearPending(),
                        },
                      );
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <Label
                      htmlFor={`candidate-${character.characterId}`}
                      className="text-sm text-foreground/80"
                    >
                      Farm candidate
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          aria-label="What does Farm candidate mean?"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={8}
                        className="max-w-xs"
                      >
                        Marks this character as eligible for skill farming. Use
                        the Candidates filter to focus on your intended farm
                        roster. Activating a farm automatically marks the
                        character as a candidate.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id={`active-${character.characterId}`}
                    checked={isActive}
                    disabled={isPending || (!isActive && !isReady)}
                    onCheckedChange={(checked) => {
                      if (checked && !isReady) return;
                      onSetPending(character.characterId);
                      updateCharacter.mutate(
                        {
                          characterId: character.characterId,
                          payload: {
                            isActiveFarm: checked,
                            ...(checked ? { isCandidate: true } : null),
                          },
                        },
                        {
                          onSuccess: () => {
                            toast.success(
                              checked
                                ? `${character.name} added to active farm`
                                : `${character.name} removed from farm`,
                            );
                          },
                          onError: () => {
                            toast.error("Failed to update active farm status");
                          },
                          onSettled: () => onClearPending(),
                        },
                      );
                    }}
                  />
                  <Label
                    htmlFor={`active-${character.characterId}`}
                    className="text-sm font-medium"
                  >
                    Active farm
                  </Label>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!open && (
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ChevronDown className="h-4 w-4" />
                      Show details
                    </Button>
                  </CollapsibleTrigger>
                )}
              </div>
            </div>
          </div>

          <CollapsibleContent className="rounded-md border bg-background/50 p-3 md:p-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ChevronUp className="h-4 w-4" />
                      Hide details
                    </Button>
                  </CollapsibleTrigger>
                  <div className="text-sm font-medium">Requirement details</div>
                </div>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {reqs.map((r) => {
                  const icon =
                    r.status === "pass" ? (
                      <CheckCircle2 className="h-4 w-4 text-foreground/70" />
                    ) : r.status === "warning" ? (
                      <AlertTriangle className="h-4 w-4 text-foreground/70" />
                    ) : (
                      <XCircle className="h-4 w-4 text-foreground/70" />
                    );

                  return (
                    <div
                      key={r.label}
                      className="flex min-w-0 items-start gap-2 rounded-md border bg-background/40 p-3"
                    >
                      <div className="mt-0.5 shrink-0">{icon}</div>
                      <div className="min-w-0">
                        <div className="font-medium">{r.label}</div>
                        {r.details ? (
                          <div className="break-words text-foreground/80">
                            {String(r.details)}
                          </div>
                        ) : (
                          <div className="text-foreground/80">
                            {r.status === "pass" ? "Met" : "Not met"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isActive && !isReady && (
                <div className="text-sm text-foreground/80">
                  This character can’t be activated yet. Fix the missing
                  requirements above, then toggle{" "}
                  <span className="font-medium">Active farm</span>.
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  );
}
