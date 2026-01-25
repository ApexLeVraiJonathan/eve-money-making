"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import Link from "next/link";
import {
  useSkillFarmSettings,
  useSkillFarmTracking,
  useUpdateSkillFarmCharacter,
  useUpdateSkillFarmSettings,
} from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Badge } from "@eve/ui/badge";
import { Button } from "@eve/ui/button";
import { Input } from "@eve/ui/input";
import { Label } from "@eve/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui/select";
import { Skeleton } from "@eve/ui/skeleton";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";
import { toast } from "@eve/ui";
import { useSkillEncyclopedia } from "../../skills/browser/api";
import { useSkillPlans } from "../../skills/api";
import { formatTrainingTime } from "../../skills/plans/utils/trainingTime";

function formatIsoOrDash(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function StatusBadge({
  status,
}: {
  status: "OK" | "WARNING" | "URGENT" | "EMPTY";
}) {
  if (status === "OK") return <Badge variant="secondary">OK</Badge>;
  if (status === "WARNING") return <Badge>Queue &lt;= 3 days</Badge>;
  if (status === "URGENT")
    return <Badge variant="outline">Queue &lt;= 1 day</Badge>;
  return <Badge variant="outline">Queue empty</Badge>;
}

function TargetSourceBadge({
  source,
}: {
  source: "ALL_ABOVE_FLOOR" | "SETTINGS" | "PLAN";
}) {
  if (source === "PLAN") return <Badge>Plan</Badge>;
  if (source === "SETTINGS") return <Badge variant="secondary">Targets</Badge>;
  return <Badge variant="outline">All above floor</Badge>;
}

function TrackingContent() {
  const { data, isLoading } = useSkillFarmTracking();
  const { data: settings } = useSkillFarmSettings();
  const updateSettings = useUpdateSkillFarmSettings();
  const updateCharacter = useUpdateSkillFarmCharacter();
  const { data: encyclopedia } = useSkillEncyclopedia();
  const { data: plans = [] } = useSkillPlans();

  const skillNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    if (!encyclopedia?.skills) return map;
    for (const s of encyclopedia.skills) map.set(s.skillId, s.name);
    return map;
  }, [encyclopedia]);

  const [skillQuery, setSkillQuery] = React.useState("");
  const trimmedQuery = skillQuery.trim().toLowerCase();
  const searchResults = React.useMemo(() => {
    if (!encyclopedia?.skills) return [];
    if (trimmedQuery.length < 2) return [];
    return encyclopedia.skills
      .filter((s) => {
        const name = s.name.toLowerCase();
        const group = (s.groupName ?? "").toLowerCase();
        const id = String(s.skillId);
        return (
          name.includes(trimmedQuery) ||
          group.includes(trimmedQuery) ||
          id.includes(trimmedQuery)
        );
      })
      .slice(0, 25);
  }, [encyclopedia, trimmedQuery]);

  const targetIds = settings?.extractionTargetSkillIds ?? [];
  const targetsCount = targetIds.length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="bg-gradient-to-b from-background to-muted/5">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || !data.characters.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground/80">
          No active farm characters configured yet. Mark characters as active on
          the Skill Farm Characters page.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/characters/skill-farms/characters">
            Manage characters
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-b from-background to-muted/10">
        <CardHeader className="gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Extraction targets</CardTitle>
              <p className="text-xs text-foreground/80">
                These skills define what you consider “farmable”. Characters
                with a selected farm plan will use that plan instead.
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
              onChange={(e) => setSkillQuery(e.target.value)}
              placeholder="Search skills by name, group, or ID…"
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
                    {searchResults.map((s) => {
                      const isSelected = targetIds.includes(s.skillId);
                      return (
                        <li
                          key={s.skillId}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {s.name}
                            </div>
                            <div className="text-[11px] text-foreground/70">
                              {s.groupName} • {s.skillId}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isSelected ? "outline" : "secondary"}
                            className="h-7"
                            onClick={async () => {
                              if (!settings) return;
                              const next = isSelected
                                ? targetIds.filter((id) => id !== s.skillId)
                                : [...targetIds, s.skillId];
                              try {
                                await updateSettings.mutateAsync({
                                  extractionTargetSkillIds: next,
                                });
                                toast.success(
                                  isSelected
                                    ? "Removed target skill"
                                    : "Added target skill",
                                );
                              } catch (e) {
                                toast.error(
                                  e instanceof Error ? e.message : String(e),
                                );
                              }
                            }}
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
                  onClick={async () => {
                    if (!settings) return;
                    try {
                      await updateSettings.mutateAsync({
                        extractionTargetSkillIds: [],
                      });
                      toast.success("Cleared targets");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e));
                    }
                  }}
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
                      onClick={async () => {
                        if (!settings) return;
                        const next = targetIds.filter((x) => x !== id);
                        try {
                          await updateSettings.mutateAsync({
                            extractionTargetSkillIds: next,
                          });
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : String(e),
                          );
                        }
                      }}
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

      {data.characters.map((c) => {
        const hasActiveSkill = !!c.activeTrainingSkillId;
        const queueRemainingLabel =
          c.queueSecondsRemaining > 0
            ? formatTrainingTime(Math.round(c.queueSecondsRemaining))
            : "none (empty)";

        return (
          <Card
            key={c.characterId}
            className="bg-gradient-to-b from-background to-muted/5"
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <p className="text-xs text-foreground/80">
                  Total SP: {c.totalSp.toLocaleString()} – floor:{" "}
                  {c.nonExtractableSp.toLocaleString()} SP
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <TargetSourceBadge source={c.targetSource} />
                <StatusBadge status={c.queueStatus} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-foreground/80">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border bg-background/50 p-3">
                  <div className="text-[11px] text-foreground/70">
                    Farmable SP (per targets)
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {c.farmPlanSp.toLocaleString()} SP
                  </div>
                </div>
                <div className="rounded-md border bg-background/50 p-3">
                  <div className="text-[11px] text-foreground/70">
                    Extractable now
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {c.extractableSp.toLocaleString()} SP
                  </div>
                  <div className="mt-1 text-[11px] text-foreground/70">
                    {c.fullExtractorsReady} LSI ready •{" "}
                    {c.remainderSp.toLocaleString()} SP toward next
                  </div>
                </div>
              </div>

              <p>
                Training queue remaining:{" "}
                <span className="font-medium">{queueRemainingLabel}</span>
              </p>
              <p>
                Active skill:{" "}
                {hasActiveSkill ? (
                  <span className="font-medium">
                    {c.activeTrainingSkillName ??
                      `Skill ${c.activeTrainingSkillId}`}
                  </span>
                ) : (
                  <span className="font-medium">—</span>
                )}{" "}
                <span className="text-foreground/70">
                  (ends {formatIsoOrDash(c.activeTrainingEndsAt)})
                </span>
              </p>

              <div className="rounded-md border bg-background/50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-foreground">
                      Farm plan (optional)
                    </div>
                    <div className="text-[11px] text-foreground/70">
                      When set, plan steps define farmable SP for this
                      character.
                    </div>
                  </div>
                  <div className="w-full sm:w-[260px]">
                    <Select
                      value={c.farmPlanId ?? "none"}
                      onValueChange={async (v) => {
                        const nextPlanId = v === "none" ? null : v;
                        try {
                          await updateCharacter.mutateAsync({
                            characterId: c.characterId,
                            payload: { farmPlanId: nextPlanId },
                          });
                          toast.success("Farm plan updated");
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : String(e),
                          );
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="none">
                          No plan (use targets)
                        </SelectItem>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function SkillFarmTrackingPage() {
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
