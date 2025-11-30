/**
 * @eve/api-contracts - OpenAPI/Zod contracts
 *
 * (Future) This package will contain OpenAPI/Zod contracts and generated
 * TypeScript types shared between frontend and backend.
 *
 * This will be populated during Phase 2 when Swagger is implemented.
 */

// Support & Feedback contracts

export interface CreateSupportRequest {
  category: string;
  subject: string;
  description: string;
  context?: {
    url?: string;
    userAgent?: string;
  };
}

export interface CreateFeedbackRequest {
  feedbackType: string;
  subject: string;
  message: string;
  rating?: number;
}

export interface SupportFeedbackResponse {
  success: boolean;
  message?: string;
}

// Character Management & Skill Farm (planned)

/**
 * High-level summary of a linked EVE character for dashboards.
 */
export interface CharacterSummary {
  id: number;
  name: string;
  corporationName?: string;
  allianceName?: string;
  role?: string | null;
  location?: string | null;
  skillPoints?: number;
  walletBalanceIsk?: number;
}

/**
 * Response shape for the character management overview endpoint.
 */
export interface CharacterOverviewResponse {
  characters: CharacterSummary[];
  updatedAt: string;
}

/**
 * One entry in a character's training queue.
 */
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

/**
 * Training queue summary for a character, including active/paused state.
 */
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

// Skill plan contracts

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
  /**
   * Optional free-form tags for organizing plans (stored as string array in the app).
   */
  tags?: string[] | null;
  /**
   * When set, the plan is considered archived and should be hidden from default lists.
   */
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

export interface SkillPlanImportRequest {
  /**
   * Raw copied text from EVE client or another user's exported plan.
   */
  text: string;
  /**
   * Format of the imported text. "eve" is the in-game compatible format,
   * "app" is the richer app-specific format with metadata.
   */
  format: SkillPlanImportFormat;
}

export interface SkillPlanImportIssue {
  line: number;
  raw: string;
  error: string;
}

export interface SkillPlanImportResult {
  /**
   * Parsed and normalised plan representation (not necessarily yet persisted).
   */
  plan: SkillPlanDetail;
  /**
   * Any issues encountered while parsing individual lines.
   */
  issues: SkillPlanImportIssue[];
}

export type SkillPlanQueueStatus = "MATCHED" | "PARTIAL" | "MISMATCHED";

export interface SkillPlanAssignment {
  id: string;
  planId: string;
  characterId: number;
  characterName: string;
  /**
   * Optional JSON-serialisable per-assignment settings
   * (e.g., implants/boosters assumptions, notification overrides).
   */
  settings?: unknown;
  createdAt: string;
  updatedAt: string;
}

export type SkillPlanSkillProgressStatus =
  | "complete"
  | "in_progress"
  | "not_started";

export interface SkillPlanSkillProgress {
  skillId: number;
  targetLevel: number;
  trainedLevel: number;
  status: SkillPlanSkillProgressStatus;
}

export interface SkillPlanQueueDifferences {
  missingSkills: number[];
  underTrainedSkills: number[];
  extraSkills: number[];
  orderMismatches: Array<{
    skillId: number;
    expectedPosition: number;
    actualPosition: number;
  }>;
}

export interface SkillPlanProgress {
  planId: string;
  characterId: number;
  /**
   * Percentage of plan completion by SP (0–100).
   */
  completionPercent: number;
  totalPlanSp: number;
  trainedPlanSp: number;
  remainingSeconds: number;
  skills: SkillPlanSkillProgress[];
  queueStatus: SkillPlanQueueStatus;
  queueDifferences: SkillPlanQueueDifferences;
  lastUpdated: string;
}

export type SkillPlanOptimizationMode = "FULL" | "RESPECT_ORDER";

export interface SkillPlanOptimizationOptions {
  mode: SkillPlanOptimizationMode;
  /**
   * Optional maximum number of remaps to use for this optimisation run.
   */
  maxRemaps?: number;
  /**
   * If provided, use this character's current attributes/implants as the base.
   */
  characterId?: number;
  /**
   * When no character is provided, an explicit attribute set can be supplied.
   */
  baseAttributes?: AttributeSuggestionAttributes;
  /**
   * Implant training bonus to assume (0–5).
   */
  implantBonus?: number;
  /**
   * Booster modifier level to assume (0,2,4,6,8,10,12).
   */
  boosterBonus?: number;
}

export interface SkillPlanOptimizationPreviewRequest {
  options: SkillPlanOptimizationOptions;
}

export interface SkillPlanOptimizedStep extends SkillPlanStep {
  /**
   * Index of the remap window this step belongs to (0-based).
   */
  remapWindowIndex: number;
}

export interface SkillPlanRemapWindow {
  index: number;
  attributes: AttributeSuggestionAttributes;
  implantBonus: number;
  boosterBonus: number;
}

export interface SkillPlanOptimizationPreviewResponse {
  originalTotalSeconds: number;
  optimizedTotalSeconds: number;
  remapWindows: SkillPlanRemapWindow[];
  steps: SkillPlanOptimizedStep[];
  /**
   * ISO timestamp when this preview was generated.
   */
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

// Skill Encyclopedia contracts

export interface SkillPrerequisite {
  skillId: number;
  skillName: string;
  requiredLevel: number;
}

export interface SkillEncyclopediaEntry {
  skillId: number;
  name: string;
  description: string;

  // Training attributes
  primaryAttribute: string;
  secondaryAttribute: string;
  trainingMultiplier: number; // rank

  // SP requirements per level (cumulative from level 0)
  spLevel1: number;
  spLevel2: number;
  spLevel3: number;
  spLevel4: number;
  spLevel5: number;

  // Dependencies
  prerequisites: SkillPrerequisite[];
  /**
   * Reverse dependencies: skills that require this skill as a prerequisite.
   */
  requiredBy?: SkillPrerequisite[];

  // Categorization
  categoryId: number;
  categoryName: string;
  groupId: number;
  groupName: string;

  // Optional sub-grouping within a group, for UI sectioning (e.g. Small/Medium/Large)
  subGroupKey?: string | null;
  subGroupLabel?: string | null;

  // Metadata
  published: boolean;
}

export interface SkillGroupSummary {
  groupId: number;
  groupName: string;
  skillCount: number;
}

export interface SkillCategorySummary {
  categoryId: number;
  categoryName: string;
  groups: SkillGroupSummary[];
  totalSkillCount: number;
}

export interface SkillEncyclopediaResponse {
  categories: SkillCategorySummary[];
  skills: SkillEncyclopediaEntry[];
}

/**
 * Configuration for a single skill farm character.
 */
export interface SkillFarmCharacterConfig {
  characterId: number;
  name: string;
  implantSet?: string | null;
  trainingPlanName?: string | null;
  isActive: boolean;
}

/**
 * A skill farm profile groups a set of characters and assumptions
 * for SP/ISK calculations.
 */
export interface SkillFarmProfile {
  id: string;
  name: string;
  description?: string;
  characters: SkillFarmCharacterConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillFarmProfitEstimateRequest {
  profileId: string;
  horizonDays: number;
  injectorSellPriceIsk: number;
  extractorBuyPriceIsk: number;
}

export interface SkillFarmProfitEstimateResponse {
  profile: SkillFarmProfile;
  horizonDays: number;
  totalSpGained: number;
  totalInjectorsProduced: number;
  grossRevenueIsk: number;
  totalCostsIsk: number;
  netProfitIsk: number;
  profitPerDayIsk: number;
}
