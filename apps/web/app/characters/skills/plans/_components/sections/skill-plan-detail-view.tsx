"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Separator,
  Skeleton,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from "@eve/ui";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  Rocket,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useApplyOptimization,
  useExportSkillPlanText,
  useImportSkillPlanIntoExisting,
  useImportSkillPlanPreview,
  useOptimizationPreview,
  useSkillPlan,
  useUpdateSkillPlan,
} from "../../../api";
import { useSkillEncyclopedia } from "../../../browser/api";
import { ImportDialog } from "../../components/ImportDialog";
import { PrerequisiteTree } from "../../components/PrerequisiteTree";
import { canMoveStep } from "../../utils/constraints";
import {
  enhanceStepsWithPrerequisites,
  type PlanStep,
} from "../../utils/prerequisites";
import { formatTrainingTime, romanNumerals } from "../../utils/trainingTime";
import { getRelativeTimeString } from "../lib/time";
import { SkillBrowserPanel } from "./skill-browser-panel";

type SkillPlanDetailViewProps = {
  planId: string | null;
  planQuery: ReturnType<typeof useSkillPlan>;
};

export function SkillPlanDetailView({ planId, planQuery }: SkillPlanDetailViewProps) {
  const { data: plan, isLoading } = planQuery;
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [stepsDraft, setStepsDraft] = useState<PlanStep[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [expandedPrerequisites, setExpandedPrerequisites] = useState<Set<number>>(
    new Set(),
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const updatePlan = useUpdateSkillPlan(planId ?? "");
  const exportText = useExportSkillPlanText(planId);
  const importPreview = useImportSkillPlanPreview();
  const importIntoPlan = useImportSkillPlanIntoExisting(planId ?? "");
  const optimizationPreview = useOptimizationPreview(planId ?? "");
  const applyOptimization = useApplyOptimization(planId ?? "");

  const { data: encyclopedia } = useSkillEncyclopedia();

  const skillNameById = useMemo(() => {
    const map = new Map<number, string>();
    if (!encyclopedia?.skills) return map;
    for (const skill of encyclopedia.skills) {
      map.set(skill.skillId, skill.name);
    }
    return map;
  }, [encyclopedia]);

  const enhancedSteps = useMemo(
    () => enhanceStepsWithPrerequisites(stepsDraft, encyclopedia),
    [stepsDraft, encyclopedia],
  );

  const totalTrainingTime = useMemo(
    () => enhancedSteps.reduce((sum, step) => sum + step.trainingTimeSeconds, 0),
    [enhancedSteps],
  );

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDescription(plan.description ?? "");
      setStepsDraft(
        plan.steps.map((s) => ({
          id: s.id,
          skillId: s.skillId,
          targetLevel: s.targetLevel,
          notes: s.notes ?? "",
        })),
      );
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date(plan.updatedAt));
    } else {
      setStepsDraft([]);
      setHasUnsavedChanges(false);
    }
  }, [plan]);

  const handleSave = async () => {
    if (!planId) return;
    try {
      await updatePlan.mutateAsync({
        name,
        description,
        steps: stepsDraft.map((s, idx) => ({
          skillId: s.skillId,
          targetLevel: s.targetLevel,
          order: idx,
          notes: s.notes,
        })),
      });
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      toast.success("Skill plan saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportText.mutateAsync();
      await navigator.clipboard.writeText(res.text);

      const filename =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "skill-plan";

      toast.success("Plan copied to clipboard!", {
        description: `Suggested filename: ${filename}.txt`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleImportFromDialog = async (text: string, replace: boolean) => {
    if (!planId) return;
    try {
      if (replace) {
        const result = await importIntoPlan.mutateAsync({
          text,
          format: "eve",
        });
        setStepsDraft(
          result.steps.map((s) => ({
            id: s.id,
            skillId: s.skillId,
            targetLevel: s.targetLevel,
            notes: s.notes ?? "",
          })),
        );
        toast.success("Plan replaced from imported text");
      } else {
        const result = await importPreview.mutateAsync({ text, format: "eve" });
        setStepsDraft(
          result.plan.steps.map((s) => ({
            id: s.id,
            skillId: s.skillId,
            targetLevel: s.targetLevel,
            notes: s.notes ?? "",
          })),
        );
        toast.success("Import preview loaded");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleOptimize = async () => {
    if (!planId) return;
    try {
      const preview = await optimizationPreview.mutateAsync({
        mode: "RESPECT_ORDER",
      });
      await applyOptimization.mutateAsync({
        mode: "RESPECT_ORDER",
      });
      const saved = preview.originalTotalSeconds - preview.optimizedTotalSeconds;
      const savedHours = Math.round(saved / 3600);
      toast.success(
        savedHours > 0
          ? `Optimization applied. Estimated time saved: ~${savedHours}h`
          : "Optimization applied.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAddSkillToPlan = (skillId: number, level = 1) => {
    setStepsDraft((prev) => {
      const existingIndex = prev.findIndex((s) => s.skillId === skillId);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          targetLevel: Math.max(next[existingIndex].targetLevel, level),
        };
        const skillName = skillNameById.get(skillId) || "Skill";
        toast.success(`${skillName} level increased to ${next[existingIndex].targetLevel}`);
        setHasUnsavedChanges(true);
        return next;
      }
      const skillName = skillNameById.get(skillId) || "Skill";
      toast.success(`${skillName} added to plan at level ${level}`);
      setHasUnsavedChanges(true);
      return [
        ...prev,
        {
          skillId,
          targetLevel: level,
        },
      ];
    });
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setStepsDraft((prev) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const enhanced = enhanceStepsWithPrerequisites(prev, encyclopedia);
      const validation = canMoveStep(enhanced, index, newIndex, encyclopedia);

      if (!validation.canMove) {
        toast.error(validation.reason || "Cannot move skill");
        return prev;
      }

      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(newIndex, 0, item);
      return next;
    });
  };

  const removeStep = (index: number) => {
    const step = enhancedSteps[index];
    if (!step.canRemove) {
      toast.error(
        "Cannot remove - this skill is required by other skills in the plan",
      );
      return;
    }
    const skillName = step.skillName;
    setStepsDraft((prev) => prev.filter((_, i) => i !== index));
    toast.success(`${skillName} removed from plan`);
  };

  const togglePrerequisites = (index: number) => {
    setExpandedPrerequisites((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const isSaving =
    updatePlan.isPending ||
    exportText.isPending ||
    importPreview.isPending ||
    importIntoPlan.isPending ||
    optimizationPreview.isPending ||
    applyOptimization.isPending;

  if (!planId) {
    return (
      <Card className="flex h-full flex-col items-center justify-center border bg-card">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Select a plan on the left or create a new one to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !plan) {
    return (
      <Card className="flex h-full flex-col border bg-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-base">Plan Details</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col border bg-card overflow-hidden">
      <CardContent className="flex-1 flex flex-col space-y-4 p-4 overflow-hidden">
        <div className="grid gap-4 lg:grid-cols-2 flex-shrink-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Plan Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Plan Name</label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="My Skill Plan"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
                <div>
                  <span className="text-muted-foreground font-medium">Created</span>
                  <br />
                  <span className="font-semibold text-foreground">
                    {new Date(plan.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Updated</span>
                  <br />
                  <span className="font-semibold text-foreground">
                    {new Date(plan.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Steps</span>
                  <br />
                  <span className="font-semibold text-foreground">{plan.steps.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Description & Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  rows={3}
                  placeholder="Optional notes about what this plan is for."
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {updatePlan.isPending ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </span>
                  ) : hasUnsavedChanges ? (
                    <span className="text-amber-500">Unsaved changes</span>
                  ) : lastSavedAt ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1.5 cursor-help">
                          <Check className="h-3 w-3 text-primary" />
                          Saved {getRelativeTimeString(lastSavedAt)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Last saved at {lastSavedAt.toLocaleTimeString()}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        Import/Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Import</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>From EVE Online</span>
                          <span className="text-[10px] text-muted-foreground">
                            Paste skill plan text
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Export</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={handleExport}
                        disabled={plan.steps.length === 0}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>As EVE Text</span>
                          <span className="text-[10px] text-muted-foreground">
                            Copy to clipboard
                          </span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOptimize}
                        disabled={isSaving || plan.steps.length === 0}
                        className="disabled:opacity-50"
                      >
                        {optimizationPreview.isPending || applyOptimization.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Rocket
                            className={cn(
                              "mr-2 h-4 w-4",
                              plan.steps.length === 0 && "opacity-40",
                            )}
                          />
                        )}
                        Optimize
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {plan.steps.length === 0
                          ? "Add skills to optimize plan"
                          : "Optimize training order and prerequisites"}
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving || !hasUnsavedChanges}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="flex-shrink-0" />

        <div className="grid gap-4 lg:grid-cols-2 flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col space-y-2 min-h-0">
            <label className="text-sm font-semibold">Plan steps</label>
            {stepsDraft.length === 0 ? (
              <div className="flex-1 rounded-md border border-dashed bg-muted/50 flex items-center justify-center p-6 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">No skills yet</h3>
                    <p className="text-xs text-muted-foreground max-w-[280px]">
                      Add skills from the browser on the right to get started
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] text-primary/80">
                    💡 Tip: Assigned plans can be queued directly for training
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 w-10 text-left">#</th>
                      <th className="px-2 py-1.5 text-left">Skill</th>
                      <th className="px-2 py-1.5 w-16 text-center">Level</th>
                      <th className="px-2 py-1.5 w-24 text-right">Time</th>
                      <th className="px-2 py-1.5 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enhancedSteps.map((step, idx) => {
                      const isExpanded = expandedPrerequisites.has(idx);
                      return (
                        <Fragment key={step.id ?? `${step.skillId}-${idx}`}>
                          <tr
                            className={cn(
                              "border-t transition-colors hover:bg-accent/50",
                              step.isPrerequisite && "bg-muted/40",
                            )}
                          >
                            <td className="px-2 py-1.5 font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            <td className="px-2 py-1.5">
                              <div
                                className={cn(
                                  "flex items-center gap-2",
                                  step.isPrerequisite && "pl-2",
                                )}
                              >
                                {step.isPrerequisite && (
                                  <span className="text-muted-foreground">⤷</span>
                                )}
                                <span className="font-medium">{step.skillName}</span>
                                {step.hasPrerequisites && (
                                  <button
                                    type="button"
                                    onClick={() => togglePrerequisites(idx)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <ChevronRight
                                      className={cn(
                                        "h-3 w-3 transition-transform",
                                        isExpanded && "rotate-90",
                                      )}
                                    />
                                  </button>
                                )}
                              </div>
                              {step.isPrerequisite && step.prerequisiteFor.length > 0 && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Required for {step.prerequisiteFor.length} skill
                                  {step.prerequisiteFor.length > 1 ? "s" : ""}
                                </div>
                              )}
                            </td>

                            <td className="px-2 py-1.5 text-center">
                              <Badge
                                variant="outline"
                                className="font-mono text-[10px] px-1"
                              >
                                {romanNumerals[step.targetLevel]}
                              </Badge>
                            </td>

                            <td className="px-2 py-1.5 text-right font-mono text-[11px] text-muted-foreground">
                              {formatTrainingTime(step.trainingTimeSeconds)}
                            </td>

                            <td className="px-2 py-1.5">
                              <div className="flex items-center justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => moveStep(idx, -1)}
                                      disabled={!step.canMoveUp}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent disabled:opacity-40"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {step.canMoveUp ? "Move up" : "Cannot move up"}
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => moveStep(idx, 1)}
                                      disabled={!step.canMoveDown}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent disabled:opacity-40"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {step.canMoveDown ? "Move down" : "Cannot move down"}
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => removeStep(idx)}
                                      disabled={!step.canRemove}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded text-destructive hover:bg-destructive/10 disabled:opacity-40"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {step.canRemove
                                      ? `Remove ${step.skillName}`
                                      : "Cannot remove - required by other skills"}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && step.hasPrerequisites && (
                            <tr className="border-t bg-muted/20">
                              <td colSpan={5} className="px-2 py-2">
                                <PrerequisiteTree
                                  skillId={step.skillId}
                                  encyclopedia={encyclopedia!}
                                  planSteps={enhancedSteps}
                                  onAddPrerequisite={handleAddSkillToPlan}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>

                  {stepsDraft.length > 0 && (
                    <tfoot className="bg-muted sticky bottom-0">
                      <tr>
                        <td colSpan={3} className="px-2 py-1.5 text-xs font-semibold">
                          Total Training Time:
                        </td>
                        <td
                          colSpan={2}
                          className="px-2 py-1.5 text-right text-xs font-mono font-semibold"
                        >
                          {formatTrainingTime(totalTrainingTime)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-2 border-l pl-4 min-h-0">
            <label className="text-sm font-semibold">Skill browser</label>
            <div className="flex-1 min-h-0 overflow-hidden">
              <SkillBrowserPanel
                encyclopedia={encyclopedia}
                onAddSkill={handleAddSkillToPlan}
                skillsInPlan={new Set(stepsDraft.map((s) => s.skillId))}
              />
            </div>
          </div>
        </div>

        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImport={handleImportFromDialog}
          isLoading={importIntoPlan.isPending || importPreview.isPending}
        />
      </CardContent>
    </Card>
  );
}
