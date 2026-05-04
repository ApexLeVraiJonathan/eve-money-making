export interface CharacterSkillQueueEntry {
  skillId: number;
  queuePosition: number;
  startDate: string | null;
  finishDate: string | null;
  trainingStartSp: number | null;
  trainingEndSp: number | null;
  levelStart: number | null;
  levelEnd: number | null;
  skillName?: string | null;
}

export interface CharacterTrainingQueueSummary {
  characterId: number;
  isQueueEmpty: boolean;
  isTraining: boolean;
  isPaused: boolean;
  totalRemainingSeconds: number;
  activeEntry: CharacterSkillQueueEntry | null;
  entries: CharacterSkillQueueEntry[];
}

export interface CharacterSkill {
  skillId: number;
  skillpointsInSkill: number;
  trainedSkillLevel: number;
  activeSkillLevel: number | null;
}

export interface CharacterSkillsResponse {
  characterId: number;
  totalSp: number;
  unallocatedSp: number;
  skills: CharacterSkill[];
}

export interface CharacterAttributesResponse {
  characterId: number;
  intelligence: number;
  memory: number;
  charisma: number;
  perception: number;
  willpower: number;
  bonusRemaps: number | null;
  lastRemapDate: string | null;
  accruedRemapCooldownDate: string | null;
}

export interface SkillCatalogEntry {
  typeId: number;
  name: string;
  groupId: number;
  rank: number | null;
  primaryAttribute: string | null;
  secondaryAttribute: string | null;
}

export interface SkillPrerequisite {
  skillId: number;
  skillName: string;
  requiredLevel: number;
}

export interface SkillEncyclopediaEntry {
  skillId: number;
  name: string;
  description: string;
  primaryAttribute: string;
  secondaryAttribute: string;
  trainingMultiplier: number;
  spLevel1: number;
  spLevel2: number;
  spLevel3: number;
  spLevel4: number;
  spLevel5: number;
  prerequisites: SkillPrerequisite[];
  requiredBy?: SkillPrerequisite[];
  categoryId: number;
  categoryName: string;
  groupId: number;
  groupName: string;
  subGroupKey?: string | null;
  subGroupLabel?: string | null;
  published: boolean;
}

export interface SkillEncyclopediaResponse {
  categories: Array<{
    categoryId: number;
    categoryName: string;
    groups: Array<{ groupId: number; groupName: string; skillCount: number }>;
    totalSkillCount: number;
  }>;
  skills: SkillEncyclopediaEntry[];
}
