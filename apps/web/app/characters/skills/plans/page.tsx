"use client";

import React, { useMemo, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
  Textarea,
  Separator,
  Skeleton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eve/ui";
import { toast } from "@eve/ui";
import {
  BookOpen,
  Plus,
  Rocket,
  Loader2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  X,
  ChevronRight,
  Check,
  Sparkles,
  Download,
  Upload,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSkillPlans,
  useSkillPlan,
  useCreateSkillPlan,
  useUpdateSkillPlan,
  useDeleteSkillPlan,
  useExportSkillPlanText,
  useImportSkillPlanPreview,
  useImportSkillPlanIntoExisting,
  useOptimizationPreview,
  useApplyOptimization,
} from "../api";
import { useSkillEncyclopedia } from "../browser/api";
import { ImportDialog } from "./components/ImportDialog";
import { PrerequisiteTree } from "./components/PrerequisiteTree";
import {
  enhanceStepsWithPrerequisites,
  type PlanStep,
} from "./utils/prerequisites";
import { formatTrainingTime, romanNumerals } from "./utils/trainingTime";
import { canMoveStep } from "./utils/constraints";

// Helper function for relative time
function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 10) return "just now";
  if (diffSecs < 60) return `${diffSecs} seconds ago`;
  if (diffMins < 60)
    return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
  if (diffHours < 24)
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;

  // For older dates, return formatted date
  return date.toLocaleDateString();
}

export default function SkillPlansPage() {
  const { data: plans = [], isLoading } = useSkillPlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const selectedPlan = useSkillPlan(selectedPlanId);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Skill Plans</h1>
            <p className="text-xs text-muted-foreground">
              Create reusable training plans and assign them to your characters.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] flex-1 min-h-0">
        <div className="col-span-1 flex flex-col min-h-0">
          <SkillPlanList
            loading={isLoading}
            plans={plans}
            selectedPlanId={selectedPlanId}
            onSelectPlan={handleSelectPlan}
          />
        </div>
        <div className="col-span-1 flex flex-col min-h-0">
          <SkillPlanDetailView
            planId={selectedPlanId}
            planQuery={selectedPlan}
          />
        </div>
      </div>
    </div>
  );
}

function SkillPlanList({
  loading,
  plans,
  selectedPlanId,
  onSelectPlan,
}: {
  loading: boolean;
  plans: {
    id: string;
    name: string;
    description?: string | null;
    totalEstimatedTimeSeconds?: number | null;
    stepsCount: number;
    createdAt: string;
    updatedAt: string;
  }[];
  selectedPlanId: string | null;
  onSelectPlan: (id: string) => void;
}) {
  const createPlan = useCreateSkillPlan();
  const deletePlan = useDeleteSkillPlan();

  const handleCreate = async () => {
    const name = prompt("Enter a name for the new skill plan:");
    if (!name) return;
    try {
      const plan = await createPlan.mutateAsync({ name, description: "" });
      onSelectPlan(plan.id);
      toast.success("Skill plan created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (planId: string) => {
    setDeleteConfirmId(planId);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      await deletePlan.mutateAsync(deleteConfirmId);
      toast.success("Skill plan deleted");
      setDeleteConfirmId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setDeleteConfirmId(null);
    }
  };

  return (
    <Card className="flex h-full flex-col border bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3">
        <CardTitle className="text-base">My Skill Plans</CardTitle>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={createPlan.isPending}
          className="h-8 gap-1.5"
        >
          {createPlan.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          New Plan
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any skill plans yet.
            </p>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create first plan
            </Button>
          </div>
        ) : (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
              <span>{plans.length} plan(s)</span>
            </div>
            <div className="flex-1 overflow-auto">
              <ul className="divide-y">
                {plans.map((plan) => {
                  const isSelected = plan.id === selectedPlanId;
                  return (
                    <li
                      key={plan.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                        isSelected ? "bg-accent/60" : "hover:bg-accent/40"
                      }`}
                      onClick={() => onSelectPlan(plan.id)}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium truncate">
                              {plan.name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{plan.name}</p>
                          </TooltipContent>
                        </Tooltip>
                        {plan.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {plan.description}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            plan.stepsCount === 0 ? "secondary" : "outline"
                          }
                          className="text-xs font-mono px-1.5"
                        >
                          {plan.stepsCount}{" "}
                          {plan.stepsCount === 1 ? "step" : "steps"}
                        </Badge>
                        {plan.stepsCount === 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This plan has no skills yet</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(plan.id);
                              }}
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete plan (cannot be undone)</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Skill Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              skill plan and all its training steps.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletePlan.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Plan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SkillPlanDetailView({
  planId,
  planQuery,
}: {
  planId: string | null;
  planQuery: ReturnType<typeof useSkillPlan>;
}) {
  const { data: plan, isLoading } = planQuery;
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [stepsDraft, setStepsDraft] = useState<PlanStep[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [expandedPrerequisites, setExpandedPrerequisites] = useState<
    Set<number>
  >(new Set());
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
    for (const s of encyclopedia.skills) {
      map.set(s.skillId, s.name);
    }
    return map;
  }, [encyclopedia]);

  const enhancedSteps = useMemo(
    () => enhanceStepsWithPrerequisites(stepsDraft, encyclopedia),
    [stepsDraft, encyclopedia],
  );

  const totalTrainingTime = useMemo(
    () => enhancedSteps.reduce((sum, s) => sum + s.trainingTimeSeconds, 0),
    [enhancedSteps],
  );

  React.useEffect(() => {
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

      // Generate a filename suggestion from plan name
      const filename =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "skill-plan";

      toast.success(`Plan copied to clipboard!`, {
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
      // For now we don't change ordering, but show the improvement and apply settings.
      await applyOptimization.mutateAsync({
        mode: "RESPECT_ORDER",
      });
      const saved =
        preview.originalTotalSeconds - preview.optimizedTotalSeconds;
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

  const handleAddSkillToPlan = (skillId: number, level: number = 1) => {
    setStepsDraft((prev) => {
      const existingIndex = prev.findIndex((s) => s.skillId === skillId);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          targetLevel: Math.max(next[existingIndex].targetLevel, level),
        };
        const skillName = skillNameById.get(skillId) || "Skill";
        toast.success(
          `${skillName} level increased to ${next[existingIndex].targetLevel}`,
        );
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

      // Validate constraints
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
        {/* Header: 2-Card Layout */}
        <div className="grid gap-4 lg:grid-cols-2 flex-shrink-0">
          {/* Card 1: Plan Information */}
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
                  <span className="text-muted-foreground font-medium">
                    Created
                  </span>
                  <br />
                  <span className="font-semibold text-foreground">
                    {new Date(plan.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">
                    Updated
                  </span>
                  <br />
                  <span className="font-semibold text-foreground">
                    {new Date(plan.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">
                    Steps
                  </span>
                  <br />
                  <span className="font-semibold text-foreground">
                    {plan.steps.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Description & Actions */}
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
                {/* Save Status Indicator */}
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
                  {/* Import/Export Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        Import/Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Import</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => setImportDialogOpen(true)}
                      >
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

                  {/* Optimize Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOptimize}
                        disabled={isSaving || plan.steps.length === 0}
                        className="disabled:opacity-50"
                      >
                        {optimizationPreview.isPending ||
                        applyOptimization.isPending ? (
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

                  {/* Save Button */}
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

        {/* Plan steps editor + skill browser side by side */}
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
                    <h3 className="text-sm font-semibold text-foreground">
                      No skills yet
                    </h3>
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
                        <React.Fragment
                          key={step.id ?? `${step.skillId}-${idx}`}
                        >
                          {/* Main skill row */}
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
                                  <span className="text-muted-foreground">
                                    ⤷
                                  </span>
                                )}
                                <span className="font-medium">
                                  {step.skillName}
                                </span>
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
                              {step.isPrerequisite &&
                                step.prerequisiteFor.length > 0 && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    Required for {step.prerequisiteFor.length}{" "}
                                    skill
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
                                    {step.canMoveUp
                                      ? "Move up"
                                      : "Cannot move up"}
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
                                    {step.canMoveDown
                                      ? "Move down"
                                      : "Cannot move down"}
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

                          {/* Prerequisite rows (if expanded) */}
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
                        </React.Fragment>
                      );
                    })}
                  </tbody>

                  {/* Footer with totals */}
                  {stepsDraft.length > 0 && (
                    <tfoot className="bg-muted sticky bottom-0">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-2 py-1.5 text-xs font-semibold"
                        >
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

        {/* Import Dialog */}
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

type SkillBrowserPanelProps = {
  encyclopedia: ReturnType<typeof useSkillEncyclopedia>["data"];
  onAddSkill: (skillId: number, level: number) => void;
  skillsInPlan: Set<number>;
};

function SkillBrowserPanel({
  encyclopedia,
  onAddSkill,
  skillsInPlan,
}: SkillBrowserPanelProps) {
  const [query, setQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Stable skills reference for memoized computations
  const skills = useMemo(
    () => encyclopedia?.skills ?? [],
    [encyclopedia?.skills],
  );

  const groupedSkills = useMemo(() => {
    const groups = new Map<string, typeof skills>();
    for (const skill of skills) {
      const groupName = skill.groupName || "Other";
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(skill);
    }
    return Array.from(groups.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [skills]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return null;
    }
    return skills
      .filter((s) => {
        const name = s.name.toLowerCase();
        const id = String(s.skillId);
        const group = s.groupName.toLowerCase();
        return name.includes(q) || id.includes(q) || group.includes(q);
      })
      .slice(0, 150);
  }, [skills, query]);

  if (!encyclopedia) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Skill browser
        </label>
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const totalFiltered = filtered ? filtered.length : skills.length;

  return (
    <div className="flex flex-col space-y-2 h-full">
      <div className="flex items-center justify-between">
        {filtered && (
          <span className="text-[11px] text-muted-foreground">
            {totalFiltered} skill{totalFiltered !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, ID, or group..."
        className="h-8 text-xs"
      />
      <div className="flex-1 overflow-auto rounded-md border bg-card min-h-0">
        {filtered !== null ? (
          // Search results - flat list
          filtered.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No skills match your search.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((skill) => (
                <li
                  key={skill.skillId}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[13px]">
                      {skill.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                      <span>• {skill.groupName}</span>
                      {skill.trainingMultiplier && (
                        <span>• x{skill.trainingMultiplier}</span>
                      )}
                    </div>
                  </div>
                  <SkillAddButton
                    skillId={skill.skillId}
                    skillName={skill.name}
                    isInPlan={skillsInPlan.has(skill.skillId)}
                    onAdd={onAddSkill}
                  />
                </li>
              ))}
            </ul>
          )
        ) : (
          // No search - grouped view
          <div className="divide-y">
            {groupedSkills.map(([groupName, groupSkills]) => {
              const isExpanded = expandedGroups.has(groupName);
              return (
                <div key={groupName}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(groupName)) {
                          next.delete(groupName);
                        } else {
                          next.add(groupName);
                        }
                        return next;
                      });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                      <span>{groupName}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {groupSkills.length}
                    </Badge>
                  </button>
                  {isExpanded && (
                    <ul className="divide-y border-t bg-muted/20">
                      {groupSkills.map((skill) => (
                        <li
                          key={skill.skillId}
                          className="flex items-center justify-between gap-2 px-3 py-2 pl-8 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[13px]">
                              {skill.name}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                              {skill.trainingMultiplier && (
                                <span>x{skill.trainingMultiplier}</span>
                              )}
                            </div>
                          </div>
                          <SkillAddButton
                            skillId={skill.skillId}
                            skillName={skill.name}
                            isInPlan={skillsInPlan.has(skill.skillId)}
                            onAdd={onAddSkill}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillAddButton({
  skillId,
  skillName,
  isInPlan,
  onAdd,
}: {
  skillId: number;
  skillName: string;
  isInPlan: boolean;
  onAdd: (skillId: number, level: number) => void;
}) {
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  if (isInPlan) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-[11px] whitespace-nowrap"
        disabled
      >
        <Check className="mr-1.5 h-3 w-3" />
        Added
      </Button>
    );
  }

  if (showLevelSelect) {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <Tooltip key={level}>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 font-mono text-[10px]"
                onClick={() => {
                  onAdd(skillId, level);
                  setShowLevelSelect(false);
                }}
              >
                {romanNumerals[level]}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Add {skillName} Level {level}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => setShowLevelSelect(false)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2 text-[11px] whitespace-nowrap"
      onClick={() => setShowLevelSelect(true)}
    >
      <Plus className="mr-1.5 h-3 w-3" />
      Add
    </Button>
  );
}
