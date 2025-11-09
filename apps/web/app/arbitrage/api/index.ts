/**
 * Arbitrage API hooks
 *
 * Centralized exports for all TanStack Query hooks used in the arbitrage domain.
 * Uses @eve/api-client for direct API calls (no Next.js proxy routes).
 */

// Re-export all hooks
export * from "./cycles";
export * from "./participations";
export * from "./auth";
export * from "./pricing";
export * from "./packages";
export * from "./wallet";
export * from "./arbitrage";
export * from "./admin";
