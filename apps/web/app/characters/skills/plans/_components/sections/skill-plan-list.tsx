"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from "@eve/ui";
import { AlertTriangle, Loader2, Plus, X } from "lucide-react";
import { useCreateSkillPlan, useDeleteSkillPlan } from "../../../api";
import type { SkillPlanSummary } from "../lib/types";

type SkillPlanListProps = {
  loading: boolean;
  plans: SkillPlanSummary[];
  selectedPlanId: string | null;
  onSelectPlan: (id: string) => void;
};

export function SkillPlanList({
  loading,
  plans,
  selectedPlanId,
  onSelectPlan,
}: SkillPlanListProps) {
  const createPlan = useCreateSkillPlan();
  const deletePlan = useDeleteSkillPlan();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
                          variant={plan.stepsCount === 0 ? "secondary" : "outline"}
                          className="text-xs font-mono px-1.5"
                        >
                          {plan.stepsCount} {plan.stepsCount === 1 ? "step" : "steps"}
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
                                setDeleteConfirmId(plan.id);
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
