export type FarmFilter = "all" | "active" | "ready" | "needs-work" | "candidates";
export type FarmSort = "status" | "name" | "sp";

export type RequirementSummary = {
  status: "pass" | "fail" | "warning";
  label: string;
  details?: string | null;
};

export type CharacterRequirements = {
  minSp: RequirementSummary;
  biology: RequirementSummary;
  cybernetics: RequirementSummary;
  remap: RequirementSummary;
  training: RequirementSummary;
  implants: RequirementSummary;
};

export type SkillFarmCharacter = {
  characterId: number;
  name: string;
  totalSp: number;
  nonExtractableSp: number;
  config: { isActive: boolean; isCandidate?: boolean };
  requirements: CharacterRequirements;
};

export type ComputedCharacter = {
  c: SkillFarmCharacter;
  isReady: boolean;
  isActive: boolean;
  isCandidate: boolean;
  blocking: RequirementSummary[];
  statusLabel: string;
  statusVariant: "default" | "secondary" | "outline";
};
