"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { qk } from "@eve/api-client/queryKeys";
import type {
  SkillPlanSummary,
  SkillPlanDetail,
  SkillPlanExportTextResponse,
  AttributeSuggestionResponse,
  SkillCatalogEntry,
  SkillPlanImportResult,
  SkillPlanOptimizationPreviewResponse,
  SkillPlanProgress,
  SkillPlanAssignment,
} from "@eve/api-contracts";

export function useSkillPlans() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.skillPlans.list(),
    queryFn: async () => {
      return await client.get<SkillPlanSummary[]>("/skill-plans");
    },
    retry: false,
  });
}

export function useSkillPlan(planId: string | null) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    enabled: !!planId,
    queryKey: qk.skillPlans.byId(planId ?? "none"),
    queryFn: async () => {
      if (!planId) return null as SkillPlanDetail | null;
      return await client.get<SkillPlanDetail | null>(`/skill-plans/${planId}`);
    },
    retry: false,
  });
}

export function useCreateSkillPlan() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      client.post<SkillPlanSummary>("/skill-plans", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.skillPlans._root });
    },
  });
}

export function useUpdateSkillPlan(planId: string) {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name?: string;
      description?: string;
      steps?: {
        id?: string;
        skillId: number;
        targetLevel: number;
        order: number;
        notes?: string;
      }[];
    }) =>
      client.patch<SkillPlanDetail>(`/skill-plans/${planId}`, {
        name: input.name,
        description: input.description,
        steps: input.steps?.map((s) => ({
          skillId: s.skillId,
          targetLevel: s.targetLevel,
          order: s.order,
          notes: s.notes,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.skillPlans._root });
      qc.invalidateQueries({ queryKey: qk.skillPlans.byId(planId) });
    },
  });
}

export function useDeleteSkillPlan() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      client.delete<{ ok: boolean }>(`/skill-plans/${planId}`),
    onSuccess: (_, planId) => {
      qc.invalidateQueries({ queryKey: qk.skillPlans._root });
      qc.invalidateQueries({ queryKey: qk.skillPlans.byId(planId) });
    },
  });
}

export function useExportSkillPlanText(planId: string | null) {
  const client = useApiClient();
  return useMutation({
    mutationFn: async () => {
      if (!planId) return { text: "" } as SkillPlanExportTextResponse;
      return await client.post<SkillPlanExportTextResponse>(
        `/skill-plans/${planId}/export-text`,
      );
    },
  });
}

export function useAttributeSuggestion(planId: string | null) {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (params: { characterId?: number }) => {
      if (!planId) {
        return {
          recommendedAttributes: null,
          reasoning: "No plan selected",
          estimatedTrainingSecondsCurrent: null,
          estimatedTrainingSecondsRecommended: null,
        } satisfies AttributeSuggestionResponse;
      }
      return await client.post<AttributeSuggestionResponse>(
        `/skill-plans/${planId}/attribute-suggestion`,
        { characterId: params.characterId },
      );
    },
  });
}

export function useSkillCatalogSearch(query: string) {
  const client = useApiClient();
  const trimmed = query.trim();

  return useAuthenticatedQuery({
    enabled: trimmed.length >= 2,
    queryKey: qk.skillPlans.search(trimmed || "_"),
    queryFn: async () => {
      if (trimmed.length < 2) return [] as SkillCatalogEntry[];
      const params = new URLSearchParams({ q: trimmed, limit: "20" });
      return await client.get<SkillCatalogEntry[]>(
        `/skill-plans/catalog/search?${params.toString()}`,
      );
    },
    retry: false,
  });
}

export function useImportSkillPlanPreview() {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (params: {
      text: string;
      format: "eve" | "app";
      nameHint?: string;
    }) => {
      return await client.post<SkillPlanImportResult>("/skill-plans/import", {
        text: params.text,
        format: params.format,
        nameHint: params.nameHint,
      });
    },
  });
}

export function useImportSkillPlanIntoExisting(planId: string) {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      text: string;
      format: "eve" | "app";
      nameHint?: string;
    }) => {
      return await client.post<SkillPlanDetail & { issues: unknown[] }>(
        `/skill-plans/${planId}/import`,
        {
          text: params.text,
          format: params.format,
          nameHint: params.nameHint,
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.skillPlans._root });
      qc.invalidateQueries({ queryKey: qk.skillPlans.byId(planId) });
    },
  });
}

export function useOptimizationPreview(planId: string) {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (params: {
      mode?: "FULL" | "RESPECT_ORDER";
      maxRemaps?: number;
      characterId?: number;
      implantBonus?: number;
      boosterBonus?: number;
    }) => {
      return await client.post<SkillPlanOptimizationPreviewResponse>(
        `/skill-plans/${planId}/optimization/preview`,
        params,
      );
    },
  });
}

export function useApplyOptimization(planId: string) {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      mode?: "FULL" | "RESPECT_ORDER";
      maxRemaps?: number;
      characterId?: number;
      implantBonus?: number;
      boosterBonus?: number;
    }) => {
      return await client.post<SkillPlanOptimizationPreviewResponse>(
        `/skill-plans/${planId}/optimization/apply`,
        params,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.skillPlans._root });
      qc.invalidateQueries({ queryKey: qk.skillPlans.byId(planId) });
    },
  });
}

export function useSkillPlanProgress(
  planId: string | null,
  characterId: number | null,
) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    enabled: !!planId && !!characterId,
    queryKey:
      planId && characterId
        ? qk.skillPlans.progress(planId, characterId)
        : (["skillPlans", "progress", "none"] as const),
    queryFn: async () => {
      if (!planId || !characterId) return null as SkillPlanProgress | null;
      return await client.get<SkillPlanProgress | null>(
        `/skill-plans/${planId}/progress/${characterId}`,
      );
    },
    retry: false,
  });
}

export function useAssignSkillPlan() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { planId: string; characterId: number }) => {
      return await client.post<SkillPlanAssignment>(
        `/skill-plans/${params.planId}/assign`,
        { characterId: params.characterId },
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: qk.skillPlans._root });
      qc.invalidateQueries({ queryKey: qk.skillPlans.byId(vars.planId) });
    },
  });
}

export function useUnassignSkillPlan() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { planId: string; characterId: number }) => {
      return await client.delete<{ ok: boolean }>(
        `/skill-plans/${params.planId}/assign/${params.characterId}`,
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: qk.skillPlans._root });
      qc.invalidateQueries({ queryKey: qk.skillPlans.byId(vars.planId) });
    },
  });
}
