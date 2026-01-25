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

// Skill-Issue (Fit Skill Influence) contracts

export interface SkillIssueAnalyzeRequest {
  /**
   * One of the user's linked character IDs.
   */
  characterId: number;
  /**
   * EFT-format fit text (copied from in-game or tools).
   */
  eft: string;
}

export type SkillIssueSkillRequirementStatus = "met" | "missing" | "unknown";

export interface SkillIssueSkillRequirement {
  /**
   * Skill type ID (EVE type ID).
   */
  skillId: number;
  /**
   * Best-effort resolved name (from TypeId.name), null when unknown.
   */
  skillName: string | null;
  /**
   * Maximum required level across all items in the fit.
   */
  requiredLevel: number;
  /**
   * Character's trained level (0–5) when available.
   */
  trainedLevel: number | null;
  status: SkillIssueSkillRequirementStatus;
  /**
   * Type IDs in the fit that introduced this requirement (ship/modules/charges/etc).
   */
  requiredByTypeIds: number[];
}

export interface SkillIssueInfluencingSkill {
  /**
   * Skill type ID (EVE type ID).
   */
  skillId: number;
  /**
   * Best-effort resolved name (from TypeId.name), null when unknown.
   */
  skillName: string | null;
  /**
   * Dogma attribute IDs this skill can modify (superset; does not guarantee applicability).
   */
  modifiedAttributeIds: number[];
  /**
   * Coarse UI categories derived from modified dogma attribute names.
   * Intended for grouping in the Skill-Issue UI (MVP-A).
   */
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

export interface SkillIssueParsedFit {
  shipName: string | null;
  shipTypeId: number | null;
  /**
   * All raw type names extracted from the EFT text (ship/modules/charges/drones/cargo).
   */
  extractedTypeNames: string[];
  /**
   * Any extracted type names that could not be resolved to a type ID in our TypeId table.
   */
  unresolvedTypeNames: string[];
  /**
   * All resolved type IDs that are considered part of the fit.
   */
  fitTypeIds: number[];
}

export interface SkillIssueAnalyzeResponse {
  fit: SkillIssueParsedFit;
  requiredSkills: SkillIssueSkillRequirement[];
  influencingSkills: SkillIssueInfluencingSkill[];
}

// Skill Farm Assistant contracts

export type SkillFarmRequirementStatus = "pass" | "fail" | "warning";

export interface SkillFarmRequirementEntry {
  key: string;
  label: string;
  status: SkillFarmRequirementStatus;
  /**
   * Optional human-readable explanation for why this requirement
   * passed, failed, or is in a warning state.
   */
  details?: string | null;
}

/**
 * Per-character requirement summary and configuration used on the
 * Skill Farm requirements checker page.
 */
export interface SkillFarmCharacterStatus {
  characterId: number;
  name: string;
  portraitUrl?: string | null;
  /**
   * Total SP on the character.
   */
  totalSp: number;
  /**
   * Non-extractable SP (the first 5.0M SP).
   */
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

/**
 * User-level economic assumptions and defaults used by the Skill Farm planner.
 */
export interface SkillFarmSettings {
  plexPriceIsk: number | null;
  plexPerOmega: number | null;
  plexPerMct: number | null;
  extractorPriceIsk: number | null;
  injectorPriceIsk: number | null;
  boosterCostPerCycleIsk: number | null;
  /**
   * When true, include +12 training boosters in the math model.
   * Boosters are priced in PLEX (NES store) and prorated by time.
   */
  useBoosters: boolean;
  salesTaxPercent: number | null;
  brokerFeePercent: number | null;
  soldViaContracts: boolean;
  cycleDays: number | null;
  managementMinutesPerCycle: number | null;
  /**
   * Skill IDs (EVE type IDs) that the user wants to consider "farmable/extractable".
   * When empty, tracking treats all SP above the non-extractable floor as farmable.
   */
  extractionTargetSkillIds: number[];
  createdAt: string;
  updatedAt: string;
}

export type SkillFarmQueueStatus = "OK" | "WARNING" | "URGENT" | "EMPTY";

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
  /**
   * How the farmable skill set was derived for this character.
   * - ALL_ABOVE_FLOOR: no explicit targets; treat all SP above floor as farmable
   * - SETTINGS: global skill targets from SkillFarmSettings
   * - PLAN: per-character farm plan (SkillPlan) steps
   */
  targetSource: "ALL_ABOVE_FLOOR" | "SETTINGS" | "PLAN";
  /**
   * Active training info from the character's queue.
   */
  activeTrainingSkillId: number | null;
  activeTrainingSkillName: string | null;
  activeTrainingEndsAt: string | null;
  /**
   * Seconds until the next full extractor is expected, based on
   * current SP/hour. Null when already ready or cannot be estimated.
   */
  etaToNextExtractorSeconds: number | null;
  queueStatus: SkillFarmQueueStatus;
  queueSecondsRemaining: number;
}

export interface SkillFarmTrackingSnapshot {
  characters: SkillFarmTrackingEntry[];
  generatedAt: string;
}

export interface SkillFarmMathInputs {
  settings: SkillFarmSettings;
  /**
   * Total number of farm characters (across all accounts).
   * Preferred input for the per-injector model.
   */
  totalCharacters?: number;
  /**
   * Number of Omega subscriptions required for the farm (30d periods).
   */
  omegaRequired?: number;
  /**
   * Number of MCT subscriptions required for the farm (30d periods).
   */
  mctRequired?: number;
  /**
   * Number of EVE accounts participating in the farm.
   */
  accounts: number;
  /**
   * Number of farm characters per account.
   */
  farmCharactersPerAccount: number;
  /**
   * Account indices (0-based) that should ignore Omega cost because
   * they are already plexed for other activities.
   */
  ignoreOmegaCostAccountIndexes: number[];
  /**
   * Optional override for SP/minute per character when not derived from
   * actual characters.
   */
  spPerMinutePerCharacter?: number | null;
  /**
   * Deprecated: prefer `spPerMinutePerCharacter`.
   * Kept temporarily for backward compatibility.
   */
  spPerDayPerCharacter?: number | null;
}

export interface SkillFarmMathResultPerCharacter {
  /**
   * Training speed used for calculations.
   */
  spPerMinute: number;
  spPerDay: number;
  /**
   * Time required to train 500k SP at the configured training speed.
   */
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
  /**
   * Injectors produced per 30 days for a single character at the configured training speed.
   */
  injectorsPer30DaysPerCharacter: number;
  /**
   * Per-character economics for a representative farm character.
   */
  perCharacter: SkillFarmMathResultPerCharacter;
  /**
   * Aggregated economics per EVE account.
   */
  perAccount: SkillFarmMathResultPerCharacter[];
  /**
   * Aggregate totals across all farm characters/accounts.
   */
  total: SkillFarmMathResultPerCharacter;
  /**
   * ISK/hour for the entire farm based on the training time required
   * to produce 1 injector (500k SP) per character.
   */
  iskPerHour: number;
}

export type SkillFarmMarketPriceKey = "PLEX" | "EXTRACTOR" | "INJECTOR";

export interface SkillFarmMarketPriceEntry {
  key: SkillFarmMarketPriceKey;
  itemName: string;
  typeId: number | null;
  /**
   * Lowest sell order price at the selected hub/station.
   */
  lowestSell: number | null;
}

export interface SkillFarmMarketPricesSnapshot {
  /**
   * Station used for the market snapshot (defaults to the server's configured hub, e.g. Jita IV-4).
   */
  stationId: number;
  regionId: number | null;
  fetchedAt: string;
  items: SkillFarmMarketPriceEntry[];
}

/**
 * Configuration for a single skill farm character.
 *
 * This is a lightweight representation reused across several areas
 * (e.g., profiles and requirements views). Additional optional fields
 * are used by the Skill Farm Assistant flows.
 */
export interface SkillFarmCharacterConfig {
  characterId: number;
  name: string;
  implantSet?: string | null;
  trainingPlanName?: string | null;
  /**
   * Whether this character is currently part of the user's active farm.
   */
  isActive: boolean;
  /**
   * Whether the user has marked this character as a skill-farm
   * candidate (even if not yet fully ready).
   */
  isCandidate?: boolean;
  /**
   * Optional linked farm plan for defining farmable skills.
   */
  farmPlanId?: string | null;
  farmPlanName?: string | null;
  /**
   * Whether this character is included in skill-farm notifications.
   */
  includeInNotifications?: boolean;
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

// Tradecraft - Market trades imports

export interface ImportMarketTradesDaySuccess {
  ok: true;
  inserted: number;
  skipped: number;
  totalRows: number;
  batchSize: number;
}

export type ImportMarketTradesErrorStage = "initial" | "retryAfterTypeIds";

export interface ImportMarketTradesDayError {
  ok: false;
  error: string;
  stage: ImportMarketTradesErrorStage;
}

export type ImportMarketTradesDayResult =
  | ImportMarketTradesDaySuccess
  | ImportMarketTradesDayError;

export interface ImportMissingMarketTradesResponse {
  /**
   * Dates (YYYY-MM-DD) that were considered missing when the job started.
   */
  missing: string[];
  /**
   * Per-day results keyed by date. Some dates may fail while others
   * succeed; the job should continue processing remaining dates.
   */
  results: Record<string, ImportMarketTradesDayResult>;
}
