import type { SkillEncyclopediaEntry } from "@eve/shared/skill-contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Badge } from "@eve/ui/badge";
import { Button } from "@eve/ui/button";
import { Input } from "@eve/ui/input";
import { Label } from "@eve/ui/label";

type ExtractionTargetsCardProps = {
  skillQuery: string;
  onSkillQueryChange: (value: string) => void;
  trimmedQuery: string;
  searchResults: SkillEncyclopediaEntry[];
  targetIds: number[];
  skillNameById: Map<number, string>;
  onToggleTarget: (skillId: number, isSelected: boolean) => Promise<void>;
  onClearTargets: () => Promise<void>;
  hasSettings: boolean;
};

export function ExtractionTargetsCard({
  skillQuery,
  onSkillQueryChange,
  trimmedQuery,
  searchResults,
  targetIds,
  skillNameById,
  onToggleTarget,
  onClearTargets,
  hasSettings,
}: ExtractionTargetsCardProps) {
  const targetsCount = targetIds.length;

  return (
    <Card className="bg-gradient-to-b from-background to-muted/10">
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Extraction targets</CardTitle>
            <p className="text-xs text-foreground/80">
              These skills define what you consider farmable. Characters with a
              selected farm plan will use that plan instead.
            </p>
          </div>
          <Badge
            variant={targetsCount > 0 ? "secondary" : "outline"}
            className="w-fit"
          >
            {targetsCount} target{targetsCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1">
          <Label htmlFor="sf-target-skill-search" className="text-xs">
            Add a target skill
          </Label>
          <Input
            id="sf-target-skill-search"
            value={skillQuery}
            onChange={(e) => onSkillQueryChange(e.target.value)}
            placeholder="Search skills by name, group, or ID..."
            className="h-8 text-sm"
          />
          {trimmedQuery.length >= 2 && (
            <div className="rounded-md border bg-background/50">
              {searchResults.length === 0 ? (
                <div className="p-3 text-xs text-foreground/70">
                  No skills match your search.
                </div>
              ) : (
                <ul className="divide-y">
                  {searchResults.map((skill) => {
                    const isSelected = targetIds.includes(skill.skillId);
                    return (
                      <li
                        key={skill.skillId}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {skill.name}
                          </div>
                          <div className="text-[11px] text-foreground/70">
                            {skill.groupName} • {skill.skillId}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? "outline" : "secondary"}
                          className="h-7"
                          disabled={!hasSettings}
                          onClick={() =>
                            void onToggleTarget(skill.skillId, isSelected)
                          }
                        >
                          {isSelected ? "Remove" : "Add"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {targetsCount > 0 && (
          <div className="rounded-md border bg-background/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium">Selected targets</div>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={!hasSettings}
                onClick={() => void onClearTargets()}
              >
                Clear
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {targetIds.map((id) => (
                <Badge key={id} variant="secondary" className="gap-2">
                  <span className="max-w-[260px] truncate">
                    {skillNameById.get(id) ?? `Skill ${id}`}
                  </span>
                  <button
                    type="button"
                    className="text-foreground/70 hover:text-foreground"
                    aria-label={`Remove ${skillNameById.get(id) ?? `skill ${id}`}`}
                    disabled={!hasSettings}
                    onClick={() => void onToggleTarget(id, true)}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
