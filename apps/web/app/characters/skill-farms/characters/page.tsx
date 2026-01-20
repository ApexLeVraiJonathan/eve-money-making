"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useSkillFarmCharacters, useUpdateSkillFarmCharacter } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Badge } from "@eve/ui/badge";
import { Button } from "@eve/ui/button";
import { Skeleton } from "@eve/ui/skeleton";
import { toast } from "@eve/ui";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";

function RequirementBadge({
  label,
  status,
}: {
  label: string;
  status: "pass" | "fail" | "warning";
}) {
  let variant: "default" | "secondary" | "outline" = "secondary";
  const icons = {
    pass: <CheckCircle2 className="h-3 w-3" />,
    warning: <AlertTriangle className="h-3 w-3" />,
    fail: <XCircle className="h-3 w-3" />,
  };
  
  if (status === "pass") {
    variant = "default";
  } else if (status === "fail") {
    // Use outline for failures; we rely on text and context, not color only.
    variant = "outline";
  }

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      {icons[status]}
      {label}
    </Badge>
  );
}

function CharactersContent() {
  const { data: chars = [], isLoading } = useSkillFarmCharacters();
  const updateCharacter = useUpdateSkillFarmCharacter();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-gradient-to-b from-background to-muted/5">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-28" />
              </div>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!chars.length) {
    return (
      <p className="text-sm text-foreground/80">
        No characters found. Link characters first, then come back to set up
        skill farms.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {chars.map((c) => {
        const ready =
          c.requirements.minSp.status === "pass" &&
          c.requirements.biology.status === "pass" &&
          c.requirements.cybernetics.status === "pass" &&
          c.requirements.remap.status === "pass" &&
          c.requirements.training.status === "pass" &&
          c.requirements.implants.status === "pass";

        const isActive = c.config.isActive ?? c.config.isActive;

        return (
          <Card
            key={c.characterId}
            className="bg-gradient-to-b from-background to-muted/5"
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <p className="text-xs text-foreground/80">
                  {c.totalSp.toLocaleString()} SP /{" "}
                  <span className="font-medium">
                    {c.nonExtractableSp.toLocaleString()} SP
                  </span>{" "}
                  non-extractable floor
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isActive && <Badge>Active farm</Badge>}
                {!isActive && ready && <Badge variant="secondary">Ready</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-foreground/80">
              <div className="flex flex-wrap gap-2">
                <RequirementBadge
                  label="5.0M SP"
                  status={c.requirements.minSp.status}
                />
                <RequirementBadge
                  label="Biology V"
                  status={c.requirements.biology.status}
                />
                <RequirementBadge
                  label="Cybernetics V"
                  status={c.requirements.cybernetics.status}
                />
                <RequirementBadge
                  label="Remap available"
                  status={c.requirements.remap.status}
                />
                <RequirementBadge
                  label="Omega"
                  status={c.requirements.training.status}
                />
                <RequirementBadge
                  label="+5 Per/Wil & BY-810"
                  status={c.requirements.implants.status}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={isActive ? "outline" : "default"}
                  onClick={() => {
                    const newState = !isActive && ready;
                    updateCharacter.mutate(
                      {
                        characterId: c.characterId,
                        payload: {
                          isCandidate: true,
                          isActiveFarm: newState,
                        },
                      },
                      {
                        onSuccess: () => {
                          toast.success(
                            newState
                              ? `${c.name} added to active farm`
                              : `${c.name} removed from farm`
                          );
                        },
                        onError: () => {
                          toast.error("Failed to update character status");
                        },
                      }
                    );
                  }}
                  disabled={!ready && !isActive}
                >
                  {isActive ? "Remove from farm" : "Set as active farm"}
                </Button>
                <Link
                  href="/characters/skills/plans"
                  className="text-xs text-foreground/80 underline-offset-2 hover:underline"
                >
                  Manage farm skill plan
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function SkillFarmCharactersPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <DynamicBreadcrumbs />
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Skill farm characters
          </h1>
          <Badge variant="secondary" className="text-xs">
            Step 2 of 3
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-foreground/80">
          Select which of your characters are suitable for skill farming. The
          checklist below highlights missing prerequisites so you know what to
          fix before activating a farm.
        </p>
      </header>
      <CharactersContent />
    </div>
  );
}
