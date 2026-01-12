/**
 * Centralized TanStack Query key factories for all API domains
 *
 * Provides consistent, type-safe query keys to:
 * - Prevent key duplication
 * - Enable proper cache invalidation
 * - Support granular refetching
 * - Maintain predictable cache structure
 *
 * Key Structure:
 * - _root: Base key for domain (use for invalidation)
 * - list/all: Collection endpoints
 * - byId/detail: Single resource endpoints
 * - Filtered queries include filter params in key
 *
 * @example
 * // Use in TanStack Query hooks
 * useQuery({ queryKey: qk.cycles.list(), queryFn: ... })
 *
 * // Invalidate all cycles queries
 * queryClient.invalidateQueries({ queryKey: qk.cycles._root })
 *
 * // Invalidate specific cycle
 * queryClient.invalidateQueries({ queryKey: qk.cycles.byId(cycleId) })
 */

export const qk = {
  /** User management & authentication */
  users: {
    _root: ["users"] as const,
    me: () => ["users", "me"] as const,
    features: () => ["users", "features"] as const,
    byId: (id: string) => ["users", "byId", id] as const,
    list: () => ["users", "list"] as const,
    tradecraft: (pagination?: { limit?: number; offset?: number }) =>
      ["users", "tradecraft", pagination] as const,
  },

  /** EVE characters & linking */
  characters: {
    _root: ["characters"] as const,
    list: () => ["characters", "list"] as const,
    byId: (id: number) => ["characters", "byId", id] as const,
    linked: () => ["characters", "linked"] as const,
  },

  /** Arbitrage opportunities & commitments */
  arbitrage: {
    _root: ["arbitrage"] as const,
    opportunities: (filters?: {
      minProfit?: number;
      minROI?: number;
      maxVolume?: number;
    }) => ["arbitrage", "opportunities", filters] as const,
    myCommitments: () => ["arbitrage", "myCommitments"] as const,
    commitSummary: (cycleId: string) =>
      ["arbitrage", "commitSummary", cycleId] as const,
  },

  /** Liquidity analysis */
  liquidity: {
    _root: ["liquidity"] as const,
    check: (items: Array<{ typeId: number; quantity: number }>) =>
      ["liquidity", "check", items] as const,
    history: (typeId: number, stationId: number) =>
      ["liquidity", "history", typeId, stationId] as const,
  },

  /** Package management */
  packages: {
    _root: ["packages"] as const,
    list: (filters?: { status?: string; cycleId?: string }) =>
      ["packages", "list", filters] as const,
    byId: (id: string) => ["packages", "byId", id] as const,
    active: () => ["packages", "active"] as const,
  },

  /** Pricing data */
  pricing: {
    _root: ["pricing"] as const,
    byTypeId: (typeId: number, stationId?: number) =>
      ["pricing", "byTypeId", typeId, stationId] as const,
    bulk: (typeIds: number[]) => ["pricing", "bulk", typeIds] as const,
    sellAppraise: (items: Array<{ typeId: number; quantity: number }>) =>
      ["pricing", "sellAppraise", items] as const,
  },

  /** Cycle management (ledger) */
  cycles: {
    _root: ["cycles"] as const,
    list: () => ["cycles", "list"] as const,
    byId: (id: string) => ["cycles", "byId", id] as const,
    current: () => ["cycles", "current"] as const,
    overview: () => ["cycles", "overview"] as const,
    entries: (
      cycleId: string,
      pagination?: { limit?: number; offset?: number }
    ) => ["cycles", "entries", cycleId, pagination] as const,
    capital: (cycleId: string, force?: boolean) =>
      ["cycles", "capital", cycleId, force] as const,
    nav: (cycleId: string) => ["cycles", "nav", cycleId] as const,
    profit: (cycleId: string) => ["cycles", "profit", cycleId] as const,
    estimatedProfit: (cycleId: string) =>
      ["cycles", "estimatedProfit", cycleId] as const,
    portfolioValue: (cycleId: string) =>
      ["cycles", "portfolioValue", cycleId] as const,
    snapshots: (cycleId: string) => ["cycles", "snapshots", cycleId] as const,
  },

  /** Cycle lines (item tracking within cycles) */
  cycleLines: {
    _root: ["cycleLines"] as const,
    list: (cycleId: string) => ["cycleLines", "list", cycleId] as const,
    byId: (lineId: string) => ["cycleLines", "byId", lineId] as const,
    unlisted: () => ["cycleLines", "unlisted"] as const,
    intel: (cycleId: string) => ["cycleLines", "intel", cycleId] as const,
  },

  /** Participation (investor investments) */
  participations: {
    _root: ["participations"] as const,
    all: () => ["participations", "all"] as const,
    list: (cycleId: string, status?: string) =>
      ["participations", "list", cycleId, status] as const,
    byId: (id: string) => ["participations", "byId", id] as const,
    me: (cycleId: string) => ["participations", "me", cycleId] as const,
    unmatchedDonations: () => ["participations", "unmatchedDonations"] as const,
    autoRolloverSettings: () =>
      ["participations", "autoRolloverSettings"] as const,
  },

  /** Payouts */
  payouts: {
    _root: ["payouts"] as const,
    suggest: (cycleId: string, profitSharePct?: number) =>
      ["payouts", "suggest", cycleId, profitSharePct] as const,
  },

  /** Fees */
  fees: {
    _root: ["fees"] as const,
    transport: (cycleId: string) => ["fees", "transport", cycleId] as const,
  },

  /** Wallet transactions */
  wallet: {
    _root: ["wallet"] as const,
    transactions: (characterId?: number) =>
      ["wallet", "transactions", characterId] as const,
    journal: (characterId?: number) =>
      ["wallet", "journal", characterId] as const,
  },

  /** Game data (EVE static data) */
  gameData: {
    _root: ["gameData"] as const,
    types: (typeIds: number[]) => ["gameData", "types", typeIds] as const,
    stations: (stationIds: number[]) =>
      ["gameData", "stations", stationIds] as const,
    trackedStations: () => ["gameData", "trackedStations"] as const,
  },

  /** ESI (EVE Swagger Interface) */
  esi: {
    _root: ["esi"] as const,
    character: (characterId: number) =>
      ["esi", "character", characterId] as const,
    wallet: (characterId: number) => ["esi", "wallet", characterId] as const,
    orders: (characterId: number) => ["esi", "orders", characterId] as const,
    assets: (characterId: number) => ["esi", "assets", characterId] as const,
  },

  /** Character management app (cross-account dashboards) */
  characterManagement: {
    _root: ["characterManagement"] as const,
    overview: () => ["characterManagement", "overview"] as const,
    accounts: () => ["characterManagement", "accounts"] as const,
    accountPlex: (accountId: string) =>
      ["characterManagement", "accountPlex", accountId] as const,
    characterBoosters: (characterId: number) =>
      ["characterManagement", "characterBoosters", characterId] as const,
    characterTrainingQueue: (characterId: number) =>
      ["characterManagement", "characterTrainingQueue", characterId] as const,
    characterSkills: (characterId: number) =>
      ["characterManagement", "characterSkills", characterId] as const,
    characterAttributes: (characterId: number) =>
      ["characterManagement", "characterAttributes", characterId] as const,
  },

  /** Skill farm planning & optimization */
  skillFarm: {
    _root: ["skillFarm"] as const,
    profiles: () => ["skillFarm", "profiles"] as const,
    profileById: (profileId: string) =>
      ["skillFarm", "profileById", profileId] as const,
    profitEstimate: (profileId: string, horizonDays: number) =>
      ["skillFarm", "profitEstimate", profileId, horizonDays] as const,
    /** Skill Farm Assistant: per-user settings */
    settings: () => ["skillFarm", "settings"] as const,
    /** Skill Farm Assistant: characters + requirement status */
    characters: () => ["skillFarm", "characters"] as const,
    /** Skill Farm Assistant: tracking snapshot for active farm characters */
    tracking: () => ["skillFarm", "tracking"] as const,
    /** Optional server-side math preview */
    mathPreview: () => ["skillFarm", "mathPreview"] as const,
  },

  /** User-owned skill plans */
  skillPlans: {
    _root: ["skillPlans"] as const,
    list: () => ["skillPlans", "list"] as const,
    byId: (planId: string) => ["skillPlans", "byId", planId] as const,
    search: (query: string) => ["skillPlans", "search", query] as const,
    encyclopedia: () => ["skillPlans", "encyclopedia"] as const,
    optimizationPreview: (planId: string) =>
      ["skillPlans", "optimizationPreview", planId] as const,
    progress: (planId: string, characterId: number) =>
      ["skillPlans", "progress", planId, characterId] as const,
  },

  /** Skill-Issue (fit analysis) */
  skillIssue: {
    _root: ["skillIssue"] as const,
    analyze: (characterId: number, eft: string) =>
      ["skillIssue", "analyze", characterId, eft] as const,
  },

  /** Notifications & preferences */
  notifications: {
    _root: ["notifications"] as const,
    discordAccount: () => ["notifications", "discordAccount"] as const,
    preferences: () => ["notifications", "preferences"] as const,
  },
};
