/**
 * API Hooks - Domain-Driven Organization
 *
 * This structure mirrors the backend domain organization:
 * - apps/api/src/cycles → api/cycles
 * - apps/api/src/characters → api/characters
 * - apps/api/src/market → api/market
 * - apps/api/src/wallet → api/wallet
 * - apps/api/src/game-data → api/game-data
 * - apps/api/src/jobs → api/jobs
 *
 * Usage:
 * ```ts
 * import { useCycles, useCreateCycle } from "@/app/tradecraft/api";
 * // or
 * import { useCycles } from "@/app/tradecraft/api/cycles";
 * ```
 */

// ============================================================================
// Cycles Domain
// ============================================================================
export * from "./cycles";

// ============================================================================
// Characters Domain (Auth & Users)
// ============================================================================
export * from "./characters";

// ============================================================================
// Market Domain (Arbitrage, Packages, Pricing, Tracked Stations, Participations)
// ============================================================================
export * from "./market";

// ============================================================================
// Wallet Domain
// ============================================================================
export * from "./wallet";

// ============================================================================
// Game Data Domain (Imports)
// ============================================================================
export * from "./game-data";

// ============================================================================
// Jobs Domain (Background Job Monitoring)
// ============================================================================
export * from "./jobs";

// ============================================================================
// ESI Domain (EVE Swagger Interface)
// ============================================================================
export * from "./esi";

// ============================================================================
// Parameter Profiles Domain
// ============================================================================
export * from "./parameter-profiles";
