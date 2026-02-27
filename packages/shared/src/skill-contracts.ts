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

export interface SkillPlanStep {
  id: string;
  skillId: number;
  targetLevel: number;
  order: number;
  notes?: string | null;
}

export interface SkillPlanSummary {
  id: string;
  name: string;
  description?: string | null;
  totalEstimatedTimeSeconds?: number | null;
  tags?: string[] | null;
  archivedAt?: string | null;
  stepsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillPlanDetail extends SkillPlanSummary {
  steps: SkillPlanStep[];
}

export interface SkillPlanExportTextResponse {
  text: string;
}

export type SkillPlanImportFormat = "eve" | "app";

export interface SkillPlanImportIssue {
  line: number;
  raw: string;
  error: string;
}

export interface SkillPlanImportResult {
  plan: SkillPlanDetail;
  issues: SkillPlanImportIssue[];
}

export interface SkillPlanAssignment {
  id: string;
  planId: string;
  characterId: number;
  characterName: string;
  settings?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface SkillPlanProgress {
  planId: string;
  characterId: number;
  completionPercent: number;
  totalPlanSp: number;
  trainedPlanSp: number;
  remainingSeconds: number;
  skills: Array<{
    skillId: number;
    targetLevel: number;
    trainedLevel: number;
    status: "complete" | "in_progress" | "not_started";
  }>;
  queueStatus: "MATCHED" | "PARTIAL" | "MISMATCHED";
  queueDifferences: {
    missingSkills: number[];
    underTrainedSkills: number[];
    extraSkills: number[];
    orderMismatches: Array<{
      skillId: number;
      expectedPosition: number;
      actualPosition: number;
    }>;
  };
  lastUpdated: string;
}

export interface SkillPlanOptimizationPreviewResponse {
  originalTotalSeconds: number;
  optimizedTotalSeconds: number;
  remapWindows: Array<{
    index: number;
    attributes: AttributeSuggestionAttributes;
    implantBonus: number;
    boosterBonus: number;
  }>;
  steps: Array<SkillPlanStep & { remapWindowIndex: number }>;
  generatedAt: string;
}

export interface AttributeSuggestionAttributes {
  intelligence: number;
  memory: number;
  charisma: number;
  perception: number;
  willpower: number;
}

export interface AttributeSuggestionResponse {
  recommendedAttributes: AttributeSuggestionAttributes | null;
  reasoning: string;
  estimatedTrainingSecondsCurrent: number | null;
  estimatedTrainingSecondsRecommended: number | null;
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

export interface SkillIssueAnalyzeRequest {
  characterId: number;
  eft: string;
}

export type SkillIssueSkillRequirementStatus = "met" | "missing" | "unknown";

export interface SkillIssueSkillRequirement {
  skillId: number;
  skillName: string | null;
  requiredLevel: number;
  trainedLevel: number | null;
  status: SkillIssueSkillRequirementStatus;
  requiredByTypeIds: number[];
}

export interface SkillIssueInfluencingSkill {
  skillId: number;
  skillName: string | null;
  modifiedAttributeIds: number[];
  categories: Array<
    | "Capacitor"
    | "Fitting Resources"
    | "Offense"
    | "Defense"
    | "Targeting"
    | "Navigation"
    | "Drones"
    | "Other"
  >;
}

export interface SkillIssueAnalyzeResponse {
  fit: {
    shipName: string | null;
    shipTypeId: number | null;
    extractedTypeNames: string[];
    unresolvedTypeNames: string[];
    fitTypeIds: number[];
  };
  requiredSkills: SkillIssueSkillRequirement[];
  influencingSkills: SkillIssueInfluencingSkill[];
}

export interface SkillFarmRequirementEntry {
  key: string;
  label: string;
  status: "pass" | "fail" | "warning";
  details?: string | null;
}

export interface SkillFarmCharacterConfig {
  characterId: number;
  name: string;
  implantSet?: string | null;
  trainingPlanName?: string | null;
  isActive: boolean;
  isCandidate?: boolean;
  farmPlanId?: string | null;
  farmPlanName?: string | null;
  includeInNotifications?: boolean;
}

export interface SkillFarmCharacterStatus {
  characterId: number;
  name: string;
  portraitUrl?: string | null;
  totalSp: number;
  nonExtractableSp: number;
  requirements: {
    minSp: SkillFarmRequirementEntry;
    biology: SkillFarmRequirementEntry;
    cybernetics: SkillFarmRequirementEntry;
    remap: SkillFarmRequirementEntry;
    training: SkillFarmRequirementEntry;
    implants: SkillFarmRequirementEntry;
  };
  config: SkillFarmCharacterConfig;
}

export interface SkillFarmSettings {
  plexPriceIsk: number | null;
  plexPerOmega: number | null;
  plexPerMct: number | null;
  extractorPriceIsk: number | null;
  injectorPriceIsk: number | null;
  boosterCostPerCycleIsk: number | null;
  useBoosters: boolean;
  salesTaxPercent: number | null;
  brokerFeePercent: number | null;
  soldViaContracts: boolean;
  cycleDays: number | null;
  managementMinutesPerCycle: number | null;
  extractionTargetSkillIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillFarmTrackingEntry {
  characterId: number;
  name: string;
  farmPlanId?: string | null;
  farmPlanName?: string | null;
  totalSp: number;
  nonExtractableSp: number;
  farmPlanSp: number;
  extractableSp: number;
  fullExtractorsReady: number;
  remainderSp: number;
  targetSource: "ALL_ABOVE_FLOOR" | "SETTINGS" | "PLAN";
  activeTrainingSkillId: number | null;
  activeTrainingSkillName: string | null;
  activeTrainingEndsAt: string | null;
  etaToNextExtractorSeconds: number | null;
  queueStatus: "OK" | "WARNING" | "URGENT" | "EMPTY";
  queueSecondsRemaining: number;
}

export interface SkillFarmTrackingSnapshot {
  characters: SkillFarmTrackingEntry[];
  generatedAt: string;
}

export interface SkillFarmMathInputs {
  settings: SkillFarmSettings;
  totalCharacters?: number;
  omegaRequired?: number;
  mctRequired?: number;
  accounts: number;
  farmCharactersPerAccount: number;
  ignoreOmegaCostAccountIndexes: number[];
  spPerMinutePerCharacter?: number | null;
  spPerDayPerCharacter?: number | null;
}

export interface SkillFarmMathResultPerCharacter {
  spPerMinute: number;
  spPerDay: number;
  daysPerInjector: number;
  spPerCycle: number;
  extractorsPerCycle: number;
  injectorsPerCycle: number;
  totalCostsIsk: number;
  grossRevenueIsk: number;
  netProfitIsk: number;
}

export interface SkillFarmMathResult {
  inputs: SkillFarmMathInputs;
  injectorsPer30DaysPerCharacter: number;
  perCharacter: SkillFarmMathResultPerCharacter;
  perAccount: SkillFarmMathResultPerCharacter[];
  total: SkillFarmMathResultPerCharacter;
  iskPerHour: number;
}

export type SkillFarmMarketPriceKey = "PLEX" | "EXTRACTOR" | "INJECTOR";

export interface SkillFarmMarketPriceEntry {
  key: SkillFarmMarketPriceKey;
  itemName: string;
  typeId: number | null;
  lowestSell: number | null;
}

export interface SkillFarmMarketPricesSnapshot {
  stationId: number;
  regionId: number | null;
  fetchedAt: string;
  items: SkillFarmMarketPriceEntry[];
}
