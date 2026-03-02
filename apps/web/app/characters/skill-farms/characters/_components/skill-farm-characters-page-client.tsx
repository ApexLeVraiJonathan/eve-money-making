"use client";

import * as React from "react";
import { useSkillFarmCharacters, useUpdateSkillFarmCharacter } from "../../api";
import { Badge } from "@eve/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eve/ui/alert-dialog";
import { toast } from "@eve/ui";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";
import {
  computeCharacters,
  filterAndSortCharacters,
  getCharacterCounts,
} from "./lib/character-utils";
import type { FarmFilter, FarmSort, SkillFarmCharacter } from "./lib/types";
import { CharacterRow } from "./sections/character-row";
import { CharactersEmptyState } from "./sections/characters-empty-state";
import { CharactersLoadingState } from "./sections/characters-loading-state";
import { SkillFarmOverviewCard } from "./sections/skill-farm-overview-card";

function CharactersContent() {
  const { data: chars = [], isLoading } = useSkillFarmCharacters();
  const updateCharacter = useUpdateSkillFarmCharacter();
  const [filter, setFilter] = React.useState<FarmFilter>("all");
  const [sort, setSort] = React.useState<FarmSort>("status");
  const [query, setQuery] = React.useState("");
  const [pendingCharacterId, setPendingCharacterId] = React.useState<
    number | null
  >(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkMode, setBulkMode] = React.useState<
    "activate-ready" | "deactivate-all"
  >("activate-ready");
  const [bulkPending, setBulkPending] = React.useState(false);

  if (isLoading) {
    return <CharactersLoadingState />;
  }

  if (!chars.length) {
    return <CharactersEmptyState />;
  }

  const computed = React.useMemo(
    () => computeCharacters(chars as SkillFarmCharacter[]),
    [chars],
  );
  const counts = React.useMemo(() => getCharacterCounts(computed), [computed]);

  const isBusy = pendingCharacterId !== null || bulkPending;
  const activateReadyTargets = computed.filter((x) => x.isReady && !x.isActive);
  const deactivateTargets = computed.filter((x) => x.isActive);

  const visible = React.useMemo(
    () =>
      filterAndSortCharacters({
        computed,
        query,
        filter,
        sort,
      }),
    [computed, query, filter, sort],
  );

  const bulkTitle =
    bulkMode === "activate-ready"
      ? "Activate all ready farms?"
      : "Deactivate all farms?";
  const bulkDescription =
    bulkMode === "activate-ready"
      ? `This will activate ${activateReadyTargets.length} character(s) that already meet all requirements.`
      : `This will remove ${deactivateTargets.length} active character(s) from Tracking.`;
  const bulkActionLabel =
    bulkMode === "activate-ready" ? "Activate ready farms" : "Deactivate all";

  return (
    <div className="space-y-4">
      <SkillFarmOverviewCard
        counts={counts}
        filter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        isBusy={isBusy}
        activateReadyCount={activateReadyTargets.length}
        deactivateCount={deactivateTargets.length}
        onOpenActivateReady={() => {
          setBulkMode("activate-ready");
          setBulkOpen(true);
        }}
        onOpenDeactivateAll={() => {
          setBulkMode("deactivate-all");
          setBulkOpen(true);
        }}
      />

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkTitle}</AlertDialogTitle>
            <AlertDialogDescription>{bulkDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkPending}
              onClick={async (e) => {
                // Prevent dialog from closing immediately; close on success.
                e.preventDefault();
                setBulkPending(true);

                const targets =
                  bulkMode === "activate-ready"
                    ? activateReadyTargets
                    : deactivateTargets;
                let succeeded = 0;
                try {
                  for (const t of targets) {
                    await updateCharacter.mutateAsync({
                      characterId: t.c.characterId,
                      payload:
                        bulkMode === "activate-ready"
                          ? { isActiveFarm: true, isCandidate: true }
                          : { isActiveFarm: false },
                    });
                    succeeded += 1;
                  }

                  toast.success(
                    bulkMode === "activate-ready"
                      ? `Activated ${succeeded} farm(s)`
                      : `Deactivated ${succeeded} farm(s)`,
                  );
                  setBulkOpen(false);
                } catch {
                  toast.error(
                    `Bulk update failed after ${succeeded} succeeded. Try again.`,
                  );
                } finally {
                  setBulkPending(false);
                }
              }}
            >
              {bulkActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-3">
        {visible.map(
          ({
            c,
            isActive,
            isReady,
            isCandidate,
            blocking,
            statusLabel,
            statusVariant,
          }) => {
            return (
              <CharacterRow
                key={c.characterId}
                character={c}
                isActive={isActive}
                isReady={isReady}
                isCandidate={isCandidate}
                blocking={blocking}
                statusLabel={statusLabel}
                statusVariant={statusVariant}
                isPending={pendingCharacterId === c.characterId}
                onSetPending={(id) => setPendingCharacterId(id)}
                onClearPending={() => setPendingCharacterId(null)}
                updateCharacter={updateCharacter}
              />
            );
          },
        )}
      </div>
    </div>
  );
}

export default function SkillFarmCharactersPageClient() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-6">
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
        <p className="max-w-4xl text-sm text-foreground/80">
          Select which of your characters are suitable for skill farming. The
          checklist below highlights missing prerequisites so you know what to
          fix before activating a farm.
        </p>
      </header>
      <CharactersContent />
    </div>
  );
}
