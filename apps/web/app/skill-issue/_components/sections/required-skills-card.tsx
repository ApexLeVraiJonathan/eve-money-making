import { ChevronDown } from "lucide-react";
import { Badge } from "@eve/ui";
import { Button } from "@eve/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@eve/ui";
import { Separator } from "@eve/ui";
import type { SkillIssueSkillRequirement } from "@eve/shared/skill-contracts";
import { levelPipColor } from "../lib/required-skills";

type RequiredSkillsCardProps = {
  requiredSkills: SkillIssueSkillRequirement[];
  requiredSorted: SkillIssueSkillRequirement[];
  requiredMissing: SkillIssueSkillRequirement[];
  requiredMetOrUnknown: SkillIssueSkillRequirement[];
  showMetRequired: boolean;
  setShowMetRequired: (value: boolean) => void;
  onOpenSkill: (skillId: number) => void;
};

export function RequiredSkillsCard({
  requiredSkills,
  requiredSorted,
  requiredMissing,
  requiredMetOrUnknown,
  showMetRequired,
  setShowMetRequired,
  onOpenSkill,
}: RequiredSkillsCardProps) {
  const missingCount = requiredSkills.filter((skill) => skill.status === "missing").length;
  const unknownCount = requiredSkills.filter((skill) => skill.status === "unknown").length;

  return (
    <Card className="border bg-card lg:col-span-5">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Required skills</CardTitle>
        <p className="text-sm text-foreground/70">Missing first.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">Total: {requiredSkills.length}</Badge>
          <Badge variant="outline">Missing: {missingCount}</Badge>
          <Badge variant="outline">Unknown: {unknownCount}</Badge>
        </div>

        <Separator />

        {requiredSorted.length === 0 ? (
          <p className="text-sm text-foreground/70">
            No required skills found (unexpected).
          </p>
        ) : null}

        {requiredMissing.length ? (
          <div className="space-y-2">
            {requiredMissing.map((skill) => (
              <div
                key={skill.skillId}
                className="flex items-center justify-between gap-3 rounded-md border bg-background/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenSkill(skill.skillId)}
                    className="truncate font-medium text-left hover:underline focus-visible:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                    title="Open skill details"
                  >
                    {skill.skillName ?? `Skill #${skill.skillId}`}
                  </button>
                  <div className="text-sm text-foreground/80">
                    Need {skill.requiredLevel} • You{" "}
                    {skill.trainedLevel == null ? "?" : skill.trainedLevel}
                  </div>
                </div>
                <Badge className={levelPipColor(skill.status)} variant="outline">
                  MISSING
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-3 text-sm">
            <p className="font-medium">No missing required skills</p>
            <p className="text-foreground/70">
              You meet all of the fit&apos;s required skill checks.
            </p>
          </div>
        )}

        {requiredMetOrUnknown.length ? (
          <Collapsible open={showMetRequired} onOpenChange={setShowMetRequired}>
            <div className="pt-1">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>Show met/unknown ({requiredMetOrUnknown.length})</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showMetRequired ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 space-y-2">
                  {requiredMetOrUnknown.map((skill) => (
                    <div
                      key={skill.skillId}
                      className="flex items-center justify-between gap-3 rounded-md border bg-background/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenSkill(skill.skillId)}
                          className="truncate font-medium text-left hover:underline focus-visible:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                          title="Open skill details"
                        >
                          {skill.skillName ?? `Skill #${skill.skillId}`}
                        </button>
                        <div className="text-sm text-foreground/80">
                          Need {skill.requiredLevel} • You{" "}
                          {skill.trainedLevel == null ? "?" : skill.trainedLevel}
                        </div>
                      </div>
                      <Badge className={levelPipColor(skill.status)} variant="outline">
                        {skill.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ) : null}
      </CardContent>
    </Card>
  );
}
