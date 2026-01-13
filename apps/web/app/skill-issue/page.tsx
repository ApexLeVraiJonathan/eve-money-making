"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ClipboardCopy,
  Eye,
  FileUp,
  Loader2,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@eve/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui";
import { Label } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { Separator } from "@eve/ui";
import { Textarea } from "@eve/ui";
import { Badge } from "@eve/ui";
import { toast } from "@eve/ui";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@eve/ui";
import { Input } from "@eve/ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@eve/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@eve/ui";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui";
import {
  useMyCharacters,
  startUserLogin,
} from "@/app/tradecraft/api/characters/users.hooks";
import { useSkillEncyclopedia } from "@/app/characters/skills/browser/api";
import { SkillDetailModal } from "@/app/characters/skills/browser/components/skill-detail-modal";
import { useSkillIssueAnalyze } from "./api";
import type {
  SkillIssueInfluencingSkill,
  SkillIssueSkillRequirement,
} from "@eve/api-contracts";

type InfluenceCategory =
  | "Capacitor"
  | "Fitting Resources"
  | "Offense"
  | "Defense"
  | "Targeting"
  | "Navigation"
  | "Drones"
  | "Other";

const CATEGORY_ORDER: InfluenceCategory[] = [
  "Capacitor",
  "Fitting Resources",
  "Offense",
  "Defense",
  "Targeting",
  "Navigation",
  "Drones",
  "Other",
];

const DEFAULT_EFT = `[Sacrilege,   Sacriblu]

1600mm Steel Plates II
Multispectrum Coating II
Shadow Serpentis Thermal Coating
Assault Damage Control II
Ballistic Control System II

50MN Quad LiF Restrained Microwarpdrive
DDO Scoped Tracking Disruptor I
DDO Scoped Tracking Disruptor I
DDO Scoped Tracking Disruptor I

Heavy Missile Launcher II
Heavy Missile Launcher II
Heavy Missile Launcher II
Heavy Missile Launcher II
Heavy Missile Launcher II
Medium Infectious Scoped Energy Neutralizer

Medium Trimark Armor Pump I
Medium Trimark Armor Pump I

Warrior II x5
Hammerhead II x5
Hornet EC-300 x5

Inferno Fury Heavy Missile x1000
Mjolnir Fury Heavy Missile x1000
Nova Fury Heavy Missile x1000
Scourge Fury Heavy Missile x1000
Cap Booster 200 x30
Missile Precision Disruption Script x3
Missile Range Disruption Script x3
`;

function parseEftHeader(
  eft: string,
): { shipName: string; fitName: string } | null {
  const firstLine =
    eft
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";

  const m = firstLine.match(/^\[([^\],]+)\s*,\s*([^\]]+)\]\s*$/);
  if (!m) return null;
  return { shipName: m[1].trim(), fitName: m[2].trim() };
}

function levelPipColor(status: "met" | "missing" | "unknown") {
  if (status === "met")
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (status === "missing")
    return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-muted text-foreground/70 border-border";
}

export default function SkillIssuePage() {
  const { data: characters = [], isLoading: charsLoading } = useMyCharacters();
  const { data: encyclopedia } = useSkillEncyclopedia();
  const [characterId, setCharacterId] = useState<number | null>(null);
  const [eft, setEft] = useState<string>(DEFAULT_EFT);
  const [eftDraft, setEftDraft] = useState<string>(DEFAULT_EFT);
  const [influencingQuery, setInfluencingQuery] = useState<string>("");
  const [influencingSort, setInfluencingSort] = useState<"impact" | "name">(
    "impact",
  );
  const [influencingCategory, setInfluencingCategory] = useState<
    InfluenceCategory | "All"
  >("All");
  const [showMetRequired, setShowMetRequired] = useState<boolean>(false);
  const [skillModalOpen, setSkillModalOpen] = useState<boolean>(false);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);

  const analyze = useSkillIssueAnalyze();

  // Prefer primary character as default selection
  useEffect(() => {
    if (!characters.length) {
      setCharacterId(null);
      return;
    }
    if (characterId && characters.some((c) => c.id === characterId)) return;
    const primary =
      characters.find((c) => c.isPrimary) ?? characters[0] ?? null;
    setCharacterId(primary?.id ?? null);
  }, [characters, characterId]);

  const result = analyze.data;
  const selectedSkill = useMemo(() => {
    if (!encyclopedia || selectedSkillId == null) return null;
    return (
      encyclopedia.skills.find((s) => s.skillId === selectedSkillId) ?? null
    );
  }, [encyclopedia, selectedSkillId]);

  const openSkill = (skillId: number) => {
    setSelectedSkillId(skillId);
    // If encyclopedia isn't loaded or doesn't contain this skill, we'll toast instead
    const exists =
      encyclopedia?.skills?.some((s) => s.skillId === skillId) ?? false;
    if (!exists) {
      toast("Skill details unavailable", {
        description:
          "We couldn't load this skill's description. Try refreshing, or open Skills → Browser.",
      });
      return;
    }
    setSkillModalOpen(true);
  };

  const fitHeader = useMemo(() => parseEftHeader(eft), [eft]);
  const fitLabel = fitHeader?.fitName ?? "Imported fit";
  const fitSubLabel = fitHeader?.shipName ?? "EFT fit";

  const requiredSorted = useMemo(() => {
    const list = result?.requiredSkills ?? [];
    return [...list].sort(
      (a: SkillIssueSkillRequirement, b: SkillIssueSkillRequirement) => {
        const rank = (s: SkillIssueSkillRequirement) =>
          s.status === "missing" ? 0 : s.status === "unknown" ? 1 : 2;
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return (a.skillName ?? `${a.skillId}`).localeCompare(
          b.skillName ?? `${b.skillId}`,
        );
      },
    );
  }, [result]);

  const requiredMissing = useMemo(
    () => requiredSorted.filter((s) => s.status === "missing"),
    [requiredSorted],
  );
  const requiredMetOrUnknown = useMemo(
    () => requiredSorted.filter((s) => s.status !== "missing"),
    [requiredSorted],
  );

  const influencingFiltered = useMemo(() => {
    const list = result?.influencingSkills ?? [];
    const q = influencingQuery.trim().toLowerCase();
    const filteredByQuery = q
      ? list.filter((s) =>
          (s.skillName ?? `${s.skillId}`).toLowerCase().includes(q),
        )
      : list;
    const filteredByCategory =
      influencingCategory === "All"
        ? filteredByQuery
        : filteredByQuery.filter((s) =>
            (
              (s.categories?.length
                ? s.categories
                : ["Other"]) as Array<InfluenceCategory>
            ).includes(influencingCategory),
          );
    const sorted = [...filteredByCategory].sort(
      (a: SkillIssueInfluencingSkill, b: SkillIssueInfluencingSkill) => {
        if (influencingSort === "name") {
          return (a.skillName ?? `${a.skillId}`).localeCompare(
            b.skillName ?? `${b.skillId}`,
          );
        }
        const ai = a.modifiedAttributeIds?.length ?? 0;
        const bi = b.modifiedAttributeIds?.length ?? 0;
        if (bi !== ai) return bi - ai;
        return (a.skillName ?? `${a.skillId}`).localeCompare(
          b.skillName ?? `${b.skillId}`,
        );
      },
    );
    return sorted;
  }, [result, influencingQuery, influencingSort, influencingCategory]);

  const influencingCategoryCounts = useMemo(() => {
    const list = result?.influencingSkills ?? [];
    const counts = new Map<InfluenceCategory, number>();
    for (const c of CATEGORY_ORDER) counts.set(c, 0);
    for (const s of list) {
      const cats = (
        s.categories?.length ? s.categories : ["Other"]
      ) as Array<InfluenceCategory>;
      for (const c of cats) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return counts;
  }, [result]);

  const canAnalyze =
    !!characterId && eft.trim().length > 0 && !analyze.isPending;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Fit Analysis</h1>
            <p className="text-sm text-foreground/70">
              Pick a character, import an EFT fit, and see missing + influencing
              skills.
            </p>
          </div>
        </div>
      </div>

      <Card className="border bg-card">
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Character Section */}
            <div className="md:col-span-3 space-y-1.5 md:pr-4 md:border-r border-border">
              <Label className="text-sm font-medium">Character</Label>
              <Select
                value={characterId ? String(characterId) : ""}
                onValueChange={(v) => setCharacterId(Number(v))}
                disabled={charsLoading || characters.length === 0}
              >
                <SelectTrigger className="h-10">
                  <SelectValue
                    placeholder={
                      charsLoading ? "Loading..." : "Select character"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.isPrimary ? " (Primary)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fit Section */}
            <div className="md:col-span-6 space-y-1.5 md:px-4 md:border-r border-border">
              <Label className="text-sm font-medium">Fit (EFT)</Label>
              <div className="flex items-center gap-3 rounded-md border bg-background/40 px-3 h-10">
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-sm leading-tight">
                    {fitLabel}
                  </div>
                  <div className="text-xs text-muted-foreground truncate leading-tight">
                    {fitSubLabel}
                    {eft === DEFAULT_EFT ? " • Sample" : ""}
                  </div>
                </div>
                <TooltipProvider>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Dialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Preview fit</TooltipContent>
                      </Tooltip>
                      <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>EFT Fit Preview</DialogTitle>
                          <DialogDescription>
                            Read-only view of your current fit.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="rounded-md border bg-muted/20 p-3">
                          <pre className="font-mono text-xs whitespace-pre-wrap break-all max-h-[400px] overflow-auto">
                            {eft}
                          </pre>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Close</Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={async () => {
                            await navigator.clipboard.writeText(eft);
                            toast("Copied", {
                              description: "Raw EFT copied to clipboard.",
                            });
                          }}
                        >
                          <ClipboardCopy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy to clipboard</TooltipContent>
                    </Tooltip>

                    <Dialog
                      onOpenChange={(open) => {
                        if (open) setEftDraft(eft);
                      }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <FileUp className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Import new fit</TooltipContent>
                      </Tooltip>
                      <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Import EFT fit</DialogTitle>
                          <DialogDescription>
                            Paste the EFT block here. We’ll store it locally and
                            only show the fit name on the page.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2">
                          <Textarea
                            value={eftDraft}
                            onChange={(e) => setEftDraft(e.target.value)}
                            rows={14}
                            className="font-mono text-xs"
                            placeholder='Paste EFT text like: "[Gila, Abyss]"'
                          />
                          <div className="flex items-center justify-between gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEftDraft(DEFAULT_EFT)}
                            >
                              Load sample
                            </Button>
                            <div className="text-xs text-foreground/70">
                              Tip: first line should be{" "}
                              <span className="font-mono">
                                [Hull, Fit Name]
                              </span>
                            </div>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEft(DEFAULT_EFT);
                              toast("Reset", {
                                description: "Sample EFT restored.",
                              });
                            }}
                          >
                            Reset to sample
                          </Button>
                          <DialogClose asChild>
                            <Button
                              onClick={() => {
                                setEft(eftDraft);
                                const h = parseEftHeader(eftDraft);
                                toast("Fit imported", {
                                  description: h?.fitName
                                    ? `Loaded “${h.fitName}”.`
                                    : "EFT loaded.",
                                });
                              }}
                            >
                              Use this fit
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </TooltipProvider>
              </div>
            </div>

            {/* Actions Section */}
            <div className="md:col-span-3 space-y-1.5 md:pl-4">
              <Label className="text-sm font-medium opacity-0">Actions</Label>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() =>
                    analyze.mutate({ characterId: characterId ?? 0, eft })
                  }
                  disabled={!canAnalyze}
                  className="flex-1 h-10"
                >
                  {analyze.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span className="ml-2">
                    {analyze.isPending ? "Analyzing…" : "Analyze"}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => {
                    setEft(DEFAULT_EFT);
                    toast("Reset", { description: "Sample EFT restored." });
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>

          {analyze.isPending ? (
            <div className="text-sm text-foreground/70">Analyzing…</div>
          ) : null}

          {analyze.error ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
              <p className="font-medium text-red-200">Analysis failed</p>
              <p className="text-red-200/80">
                {analyze.error instanceof Error
                  ? analyze.error.message
                  : "Unknown error"}
              </p>
            </div>
          ) : null}

          {!charsLoading && characters.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-foreground/70" />
                <div className="space-y-2">
                  <p className="font-medium">No linked characters</p>
                  <p className="text-foreground/70">
                    Link a character to compare required skills against your
                    pilot.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      const returnUrl =
                        typeof window !== "undefined"
                          ? window.location.href
                          : "/";
                      startUserLogin(returnUrl);
                    }}
                  >
                    Sign in / Link character
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Influencing (primary) */}
          <Card className="border bg-card lg:col-span-7">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Influencing skills</CardTitle>
              <p className="text-sm text-foreground/70">
                Where the value is: skills that can modify attributes present on
                this fit.
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
                      onChange={(e) => setInfluencingQuery(e.target.value)}
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
                    onValueChange={(v) =>
                      setInfluencingCategory(v as InfluenceCategory | "All")
                    }
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">
                        Category: All ({result.influencingSkills.length})
                      </SelectItem>
                      {CATEGORY_ORDER.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c} ({influencingCategoryCounts.get(c) ?? 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={influencingSort}
                    onValueChange={(v) =>
                      setInfluencingSort(v as "impact" | "name")
                    }
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
                    Showing: {influencingFiltered.length} /{" "}
                    {result.influencingSkills.length}
                  </Badge>
                  <Badge variant="outline">Default: Impact</Badge>
                </div>
              </div>

              <Separator />

              {influencingFiltered.length === 0 ? (
                <p className="text-sm text-foreground/70">
                  No influencing skills found (this likely means SDE effects
                  weren’t loaded).
                </p>
              ) : (
                <div className="space-y-2 max-h-[620px] overflow-auto pr-1">
                  {influencingFiltered.map((s) => {
                    const impactCount = s.modifiedAttributeIds?.length ?? 0;
                    const isHighImpact = impactCount >= 2;
                    return (
                      <div
                        key={s.skillId}
                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                          isHighImpact
                            ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                            : "bg-background/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => openSkill(s.skillId)}
                            className="truncate font-medium text-left hover:underline focus-visible:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                            title="Open skill details"
                          >
                            {s.skillName ?? `Skill #${s.skillId}`}
                          </button>
                          <div className="text-sm text-foreground/80">
                            Affects {impactCount} attribute
                            {impactCount === 1 ? "" : "s"}
                            {" • "}
                            {(s.categories?.length
                              ? s.categories.slice(0, 1)
                              : ["Other"]
                            ).map((c) => (
                              <Badge key={c} variant="outline" className="ml-1">
                                {c}
                              </Badge>
                            ))}
                            {s.categories && s.categories.length > 1 ? (
                              <Badge variant="outline" className="ml-1">
                                +{s.categories.length - 1}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            isHighImpact
                              ? "bg-primary/10 text-primary font-semibold"
                              : ""
                          }
                        >
                          {impactCount}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}

              {result.fit?.unresolvedTypeNames?.length ? (
                <>
                  <Separator />
                  <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-foreground/70" />
                      <p className="font-medium">Unresolved type names</p>
                      <Badge variant="outline">
                        {result.fit.unresolvedTypeNames.length}
                      </Badge>
                    </div>
                    <p className="text-foreground/70">
                      These names in the EFT didn’t resolve to SDE types.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {result.fit.unresolvedTypeNames
                        .slice(0, 18)
                        .map((n: string) => (
                          <Badge key={n} variant="outline">
                            {n}
                          </Badge>
                        ))}
                      {result.fit.unresolvedTypeNames.length > 18 ? (
                        <Badge variant="outline">
                          +{result.fit.unresolvedTypeNames.length - 18} more
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* Required (secondary) */}
          <Card className="border bg-card lg:col-span-5">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Required skills</CardTitle>
              <p className="text-sm text-foreground/70">Missing first.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">
                  Total: {result.requiredSkills.length}
                </Badge>
                <Badge variant="outline">
                  Missing:{" "}
                  {
                    result.requiredSkills.filter((s) => s.status === "missing")
                      .length
                  }
                </Badge>
                <Badge variant="outline">
                  Unknown:{" "}
                  {
                    result.requiredSkills.filter((s) => s.status === "unknown")
                      .length
                  }
                </Badge>
              </div>

              <Separator />

              {requiredSorted.length === 0 ? (
                <p className="text-sm text-foreground/70">
                  No required skills found (unexpected).
                </p>
              ) : null}

              {/* Default view: missing only */}
              {requiredMissing.length ? (
                <div className="space-y-2">
                  {requiredMissing.map((s) => (
                    <div
                      key={s.skillId}
                      className="flex items-center justify-between gap-3 rounded-md border bg-background/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openSkill(s.skillId)}
                          className="truncate font-medium text-left hover:underline focus-visible:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                          title="Open skill details"
                        >
                          {s.skillName ?? `Skill #${s.skillId}`}
                        </button>
                        <div className="text-sm text-foreground/80">
                          Need {s.requiredLevel} • You{" "}
                          {s.trainedLevel == null ? "?" : s.trainedLevel}
                        </div>
                      </div>
                      <Badge
                        className={levelPipColor(s.status)}
                        variant="outline"
                      >
                        MISSING
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border bg-muted/20 p-3 text-sm">
                  <p className="font-medium">No missing required skills</p>
                  <p className="text-foreground/70">
                    You meet all of the fit’s required skill checks.
                  </p>
                </div>
              )}

              {/* Hidden by default: met/unknown */}
              {requiredMetOrUnknown.length ? (
                <Collapsible
                  open={showMetRequired}
                  onOpenChange={setShowMetRequired}
                >
                  <div className="pt-1">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        <span>
                          Show met/unknown ({requiredMetOrUnknown.length})
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${showMetRequired ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3 space-y-2">
                        {requiredMetOrUnknown.map((s) => (
                          <div
                            key={s.skillId}
                            className="flex items-center justify-between gap-3 rounded-md border bg-background/30 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => openSkill(s.skillId)}
                                className="truncate font-medium text-left hover:underline focus-visible:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                                title="Open skill details"
                              >
                                {s.skillName ?? `Skill #${s.skillId}`}
                              </button>
                              <div className="text-sm text-foreground/80">
                                Need {s.requiredLevel} • You{" "}
                                {s.trainedLevel == null ? "?" : s.trainedLevel}
                              </div>
                            </div>
                            <Badge
                              className={levelPipColor(s.status)}
                              variant="outline"
                            >
                              {s.status.toUpperCase()}
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
        </div>
      ) : (
        <Card className="border bg-card">
          <CardContent className="pt-6">
            <Empty className="border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Sparkles />
                </EmptyMedia>
                <EmptyTitle>Run an analysis</EmptyTitle>
                <EmptyDescription>
                  Choose a character and import an EFT fit. We’ll surface
                  missing requirements and, most importantly, the skills that
                  influence the fit’s attributes.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}

      {selectedSkill ? (
        <SkillDetailModal
          skill={selectedSkill}
          open={skillModalOpen}
          onClose={() => setSkillModalOpen(false)}
          onSelectRelatedSkill={(skillId) => openSkill(skillId)}
        />
      ) : null}
    </div>
  );
}
