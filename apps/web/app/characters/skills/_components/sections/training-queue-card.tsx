"use client";

import { Clock } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@eve/ui";
import type {
  CharacterAttributesResponse,
  CharacterTrainingQueueSummary,
  SkillEncyclopediaResponse,
} from "@eve/shared/skill-contracts";
import { toRoman } from "../lib/skills-page-utils";

type TrainingQueueCardProps = {
  loading: boolean;
  queue: CharacterTrainingQueueSummary | null | undefined;
  skillNameById: Map<number, string>;
  onSkillClick?: (skillId: number) => void;
  attrs?: CharacterAttributesResponse | null;
  encyclopedia?: SkillEncyclopediaResponse | null;
};

export function TrainingQueueCard({
  loading,
  queue,
  skillNameById,
  onSkillClick,
  attrs,
  encyclopedia,
}: TrainingQueueCardProps) {
  const getSpPerHour = (skillId: number): number | null => {
    if (!attrs || !encyclopedia) return null;

    const skill = encyclopedia.skills.find((s) => s.skillId === skillId);
    if (!skill) return null;

    const primary = attrs[skill.primaryAttribute.toLowerCase() as keyof typeof attrs];
    const secondary = attrs[skill.secondaryAttribute.toLowerCase() as keyof typeof attrs];

    if (typeof primary !== "number" || typeof secondary !== "number") return null;

    return 60 * primary + 30 * secondary;
  };

  const getRemainingSP = (skillId: number, targetLevel: number): number | null => {
    if (!encyclopedia) return null;

    const skill = encyclopedia.skills.find((s) => s.skillId === skillId);
    if (!skill) return null;

    const spLevelKey = `spLevel${targetLevel}` as keyof typeof skill;
    const targetSP = skill[spLevelKey];

    if (typeof targetSP !== "number") return null;

    return targetSP;
  };

  const getProgressPercentage = (
    entry: CharacterTrainingQueueSummary["activeEntry"] | null | undefined,
  ): number => {
    if (!entry) return 0;
    if (!entry.startDate || !entry.finishDate) return 0;

    const startTime = new Date(entry.startDate).getTime();
    const endTime = new Date(entry.finishDate).getTime();
    const now = Date.now();
    const totalDuration = endTime - startTime;
    const elapsed = now - startTime;

    if (totalDuration <= 0) return 100;
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  };

  const formatTotalTime = (seconds: number) => {
    if (seconds <= 0) return "0d 0h";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const getQueueEndDate = (seconds: number) => {
    if (seconds <= 0) return null;
    const endDate = new Date(Date.now() + seconds * 1000);
    return endDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatRemainingTime = (finishDate: string | null | undefined) => {
    if (!finishDate) return null;
    const nowMs = Date.now();
    const endMs = new Date(finishDate).getTime();
    const diffSec = Math.floor((endMs - nowMs) / 1000);
    if (diffSec <= 0) return "0m";

    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <Card className="flex h-full flex-col border bg-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-base">Training Queue</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 p-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!queue || queue.isQueueEmpty) {
    return (
      <Card className="flex h-full flex-col border bg-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-base">Training Queue</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3 w-3" />
              Idle
            </Badge>
            <span className="text-sm">Queue is empty</span>
          </div>
          <p className="mt-3 text-sm text-foreground/70">
            Add skills to your training queue in-game to track progress here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const active = queue.activeEntry;
  const totalTime = formatTotalTime(queue.totalRemainingSeconds);
  const endDate = getQueueEndDate(queue.totalRemainingSeconds);
  const spPerHour = active ? getSpPerHour(active.skillId) : null;
  const progressPercentage = active ? getProgressPercentage(active) : 0;
  const remainingSP = active?.levelEnd ? getRemainingSP(active.skillId, active.levelEnd) : null;

  return (
    <Card className="flex h-full flex-col border bg-card">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Training Queue</CardTitle>
          <Badge variant={queue.isTraining ? "default" : "outline"}>
            {queue.isTraining ? "Training" : queue.isPaused ? "Paused" : "Idle"}
          </Badge>
        </div>
        {queue.totalRemainingSeconds > 0 && (
          <div className="mt-2 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">{totalTime}</span>
              <span className="text-foreground/60">remaining</span>
            </div>
            {endDate && <p className="text-xs text-foreground/60">Completes {endDate}</p>}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-3 p-4">
        {active && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Currently Training
              </Badge>
            </div>
            <div
              className="rounded-md border border-l-4 border-l-primary bg-muted/40 p-3 cursor-pointer hover:bg-muted/60 transition-colors shadow-sm"
              onClick={() => onSkillClick?.(active.skillId)}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {skillNameById.get(active.skillId) ?? `Skill #${active.skillId}`}
                </div>
                {active.levelEnd != null && (
                  <Badge className="text-xs font-semibold">Level {toRoman(active.levelEnd)}</Badge>
                )}
              </div>

              {(spPerHour || remainingSP) && (
                <div className="mt-2 flex items-center justify-between text-xs text-foreground/60">
                  {spPerHour && (
                    <span className="font-mono">{spPerHour.toLocaleString()} SP/hr</span>
                  )}
                  {remainingSP && (
                    <span className="font-mono">{remainingSP.toLocaleString()} SP total</span>
                  )}
                </div>
              )}

              {active.finishDate && (
                <div className="mt-2 text-xs text-foreground/60 flex items-center justify-between gap-2">
                  <span className="text-foreground/70">
                    Time until trained: {formatRemainingTime(active.finishDate)}
                  </span>
                  <span>
                    Finishes{" "}
                    {new Date(active.finishDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </div>
              )}
              {active.startDate && active.finishDate && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-foreground/60">
                    <span>Progress</span>
                    <span className="font-mono">{progressPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full bg-primary transition-all duration-300 animate-pulse"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {queue.entries.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Upcoming Skills</div>
            <div className="space-y-1">
              {queue.entries.slice(0, 10).map((e) => {
                const isActive =
                  queue.activeEntry?.skillId === e.skillId &&
                  queue.activeEntry.queuePosition === e.queuePosition;
                if (isActive) return null;

                return (
                  <div
                    key={`${e.skillId}-${e.queuePosition}`}
                    className="rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => onSkillClick?.(e.skillId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {skillNameById.get(e.skillId) ?? `Skill #${e.skillId}`}
                        {e.levelEnd != null && (
                          <span className="ml-2 text-xs text-foreground/60">
                            Level {toRoman(e.levelEnd)}
                          </span>
                        )}
                      </div>
                    </div>
                    {e.finishDate && (
                      <div className="mt-1 text-xs text-foreground/60 flex items-center justify-between gap-2">
                        <span className="text-foreground/70">
                          Time until trained: {formatRemainingTime(e.finishDate)}
                        </span>
                        <span>
                          {new Date(e.finishDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
