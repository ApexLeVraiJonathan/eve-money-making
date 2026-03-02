import { Search, Sparkles } from "lucide-react";
import { Badge } from "@eve/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import { Input } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { Separator } from "@eve/ui";
import type { SkillIssueInfluencingSkill } from "@eve/shared/skill-contracts";
import { CATEGORY_ORDER, type InfluenceCategory } from "../lib/constants";

type InfluencingSkillsCardProps = {
  allSkillsCount: number;
  influencingFiltered: SkillIssueInfluencingSkill[];
  influencingCategoryCounts: Map<InfluenceCategory, number>;
  influencingQuery: string;
  setInfluencingQuery: (value: string) => void;
  influencingCategory: InfluenceCategory | "All";
  setInfluencingCategory: (value: InfluenceCategory | "All") => void;
  influencingSort: "impact" | "name";
  setInfluencingSort: (value: "impact" | "name") => void;
  unresolvedTypeNames: string[] | undefined;
  onOpenSkill: (skillId: number) => void;
};

export function InfluencingSkillsCard({
  allSkillsCount,
  influencingFiltered,
  influencingCategoryCounts,
  influencingQuery,
  setInfluencingQuery,
  influencingCategory,
  setInfluencingCategory,
  influencingSort,
  setInfluencingSort,
  unresolvedTypeNames,
  onOpenSkill,
}: InfluencingSkillsCardProps) {
  return (
    <Card className="border bg-card lg:col-span-7">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Influencing skills</CardTitle>
        <p className="text-sm text-foreground/70">
          Where the value is: skills that can modify attributes present on this
          fit.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-2 top-2.5 h-4 w-4 text-foreground/60"
                aria-hidden="true"
              />
              <Input
                value={influencingQuery}
                onChange={(event) => setInfluencingQuery(event.target.value)}
                placeholder="Search influencing skills…"
                className="pl-8 pr-8"
              />
              {influencingQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setInfluencingQuery("")}
                  className="absolute right-2 top-2.5 h-4 w-4 text-foreground/60 hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
            <Select
              value={influencingCategory}
              onValueChange={(value) =>
                setInfluencingCategory(value as InfluenceCategory | "All")
              }
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Category: All ({allSkillsCount})</SelectItem>
                {CATEGORY_ORDER.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category} ({influencingCategoryCounts.get(category) ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={influencingSort}
              onValueChange={(value) => setInfluencingSort(value as "impact" | "name")}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="impact">Sort: Impact</SelectItem>
                <SelectItem value="name">Sort: Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">
              Showing: {influencingFiltered.length} / {allSkillsCount}
            </Badge>
            <Badge variant="outline">Default: Impact</Badge>
          </div>
        </div>

        <Separator />

        {influencingFiltered.length === 0 ? (
          <p className="text-sm text-foreground/70">
            No influencing skills found (this likely means SDE effects weren't
            loaded).
          </p>
        ) : (
          <div className="space-y-2 max-h-[620px] overflow-auto pr-1">
            {influencingFiltered.map((skill) => {
              const impactCount = skill.modifiedAttributeIds?.length ?? 0;
              const isHighImpact = impactCount >= 2;
              return (
                <div
                  key={skill.skillId}
                  className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                    isHighImpact
                      ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                      : "bg-background/40"
                  }`}
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
                      Affects {impactCount} attribute{impactCount === 1 ? "" : "s"}
                      {" • "}
                      {(skill.categories?.length
                        ? skill.categories.slice(0, 1)
                        : ["Other"]
                      ).map((category) => (
                        <Badge key={category} variant="outline" className="ml-1">
                          {category}
                        </Badge>
                      ))}
                      {skill.categories && skill.categories.length > 1 ? (
                        <Badge variant="outline" className="ml-1">
                          +{skill.categories.length - 1}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={isHighImpact ? "bg-primary/10 text-primary font-semibold" : ""}
                  >
                    {impactCount}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {unresolvedTypeNames?.length ? (
          <>
            <Separator />
            <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-foreground/70" />
                <p className="font-medium">Unresolved type names</p>
                <Badge variant="outline">{unresolvedTypeNames.length}</Badge>
              </div>
              <p className="text-foreground/70">
                These names in the EFT didn't resolve to SDE types.
              </p>
              <div className="flex flex-wrap gap-1">
                {unresolvedTypeNames.slice(0, 18).map((name) => (
                  <Badge key={name} variant="outline">
                    {name}
                  </Badge>
                ))}
                {unresolvedTypeNames.length > 18 ? (
                  <Badge variant="outline">
                    +{unresolvedTypeNames.length - 18} more
                  </Badge>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
