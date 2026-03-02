export type SkillPlanSummary = {
  id: string;
  name: string;
  description?: string | null;
  totalEstimatedTimeSeconds?: number | null;
  stepsCount: number;
  createdAt: string;
  updatedAt: string;
};
