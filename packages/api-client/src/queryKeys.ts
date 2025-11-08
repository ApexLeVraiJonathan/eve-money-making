/**
 * Centralized TanStack Query key factories
 * 
 * Provides consistent query keys for all domains to prevent duplication
 * and ensure proper cache invalidation.
 */

export const qk = {
  users: {
    _root: ["users"] as const,
    list: () => ["users", "list"] as const,
    byId: (id: string) => ["users", "byId", id] as const,
    me: () => ["users", "me"] as const,
  },
  characters: {
    _root: ["characters"] as const,
    list: () => ["characters", "list"] as const,
    byId: (id: number) => ["characters", "byId", id] as const,
  },
  arbitrage: {
    _root: ["arbitrage"] as const,
    opportunities: (filters?: unknown) => ["arbitrage", "opportunities", filters] as const,
    myCommitments: () => ["arbitrage", "myCommitments"] as const,
  },
  cycles: {
    _root: ["cycles"] as const,
    list: () => ["cycles", "list"] as const,
    byId: (id: number) => ["cycles", "byId", id] as const,
    current: () => ["cycles", "current"] as const,
  },
  participations: {
    _root: ["participations"] as const,
    list: (cycleId?: number) => ["participations", "list", cycleId] as const,
    byId: (id: number) => ["participations", "byId", id] as const,
  },
  packages: {
    _root: ["packages"] as const,
    list: () => ["packages", "list"] as const,
    byId: (id: number) => ["packages", "byId", id] as const,
  },
  pricing: {
    _root: ["pricing"] as const,
    byTypeId: (typeId: number) => ["pricing", "byTypeId", typeId] as const,
  },
  ledger: {
    _root: ["ledger"] as const,
    cycles: () => ["ledger", "cycles"] as const,
    cycleLines: (cycleId: number) => ["ledger", "cycleLines", cycleId] as const,
  },
};

