"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@eve/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@eve/ui/tabs";
import { AlertTriangle, Sparkles, Target, Users } from "lucide-react";
import type { FarmFilter, FarmSort } from "../lib/types";

type Counts = {
  total: number;
  active: number;
  ready: number;
  needsWork: number;
  candidates: number;
};

export function SkillFarmOverviewCard({
  counts,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  isBusy,
  activateReadyCount,
  deactivateCount,
  onOpenActivateReady,
  onOpenDeactivateAll,
}: {
  counts: Counts;
  filter: FarmFilter;
  onFilterChange: (value: FarmFilter) => void;
  query: string;
  onQueryChange: (value: string) => void;
  sort: FarmSort;
  onSortChange: (value: FarmSort) => void;
  isBusy: boolean;
  activateReadyCount: number;
  deactivateCount: number;
  onOpenActivateReady: () => void;
  onOpenDeactivateAll: () => void;
}) {
  return (
    <Card className="bg-gradient-to-b from-background to-muted/10 p-4 md:p-6">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">At a glance</CardTitle>
            <p className="text-sm text-foreground/80">
              Activate farms here to control who appears in Tracking. Hover a
              requirement badge to see details, or expand a row for the full
              checklist.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/characters/skills/plans">Skill plan</Link>
            </Button>
            <Button asChild>
              <Link href="/characters/skill-farms/tracking">View tracking</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border bg-background/50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Active farms</div>
              <Sparkles className="h-4 w-4 text-foreground/70" />
            </div>
            <div className="mt-1 text-2xl font-semibold">{counts.active}</div>
            <div className="text-xs text-foreground/80">Included on Tracking</div>
          </div>
          <div className="rounded-md border bg-background/50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Ready to activate</div>
              <Target className="h-4 w-4 text-foreground/70" />
            </div>
            <div className="mt-1 text-2xl font-semibold">{counts.ready}</div>
            <div className="text-xs text-foreground/80">Meet all requirements</div>
          </div>
          <div className="rounded-md border bg-background/50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Needs work</div>
              <AlertTriangle className="h-4 w-4 text-foreground/70" />
            </div>
            <div className="mt-1 text-2xl font-semibold">{counts.needsWork}</div>
            <div className="text-xs text-foreground/80">Missing prerequisites</div>
          </div>
          <div className="rounded-md border bg-background/50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Candidates</div>
              <Users className="h-4 w-4 text-foreground/70" />
            </div>
            <div className="mt-1 text-2xl font-semibold">{counts.candidates}</div>
            <div className="text-xs text-foreground/80">Marked for farming</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={filter}
            onValueChange={(v) => onFilterChange(v as FarmFilter)}
            className="w-full sm:w-auto"
          >
            <TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-1">
              <TabsTrigger value="all" className="flex-none">
                All ({counts.total})
              </TabsTrigger>
              <TabsTrigger value="active" className="flex-none">
                Active ({counts.active})
              </TabsTrigger>
              <TabsTrigger value="ready" className="flex-none">
                Ready ({counts.ready})
              </TabsTrigger>
              <TabsTrigger value="needs-work" className="flex-none">
                Needs work ({counts.needsWork})
              </TabsTrigger>
              <TabsTrigger value="candidates" className="flex-none">
                Candidates ({counts.candidates})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="w-full sm:w-auto">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <Input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search characters…"
                className="h-8 w-full text-sm sm:w-64 md:w-72"
              />
              <Select value={sort} onValueChange={(v) => onSortChange(v as FarmSort)}>
                <Label className="sr-only" htmlFor="skill-farm-sort">
                  Sort
                </Label>
                <SelectTrigger
                  id="skill-farm-sort"
                  size="sm"
                  className="w-full sm:w-[160px]"
                >
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="status">Sort: Status</SelectItem>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="sp">Sort: SP</SelectItem>
                </SelectContent>
              </Select>

              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  variant="secondary"
                  disabled={isBusy || activateReadyCount === 0}
                  onClick={onOpenActivateReady}
                >
                  <span className="sm:hidden">Activate</span>
                  <span className="hidden sm:inline">Activate ready</span> (
                  {activateReadyCount})
                </Button>
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  variant="outline"
                  disabled={isBusy || deactivateCount === 0}
                  onClick={onOpenDeactivateAll}
                >
                  <span className="sm:hidden">Deactivate</span>
                  <span className="hidden sm:inline">Deactivate all</span> (
                  {deactivateCount})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
