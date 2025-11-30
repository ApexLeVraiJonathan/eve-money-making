/**
 * @eve/eve-core - EVE domain primitives and pure utilities
 *
 * This package is the home for:
 * - Pure TypeScript types for EVE entities (characters, skills, wallets, etc.)
 * - Math and ISK helpers used across multiple apps
 * - Pure calculation logic (no NestJS, no HTTP, no env access)
 *
 * NOTE: keep this package framework-agnostic so it can be reused by
 * backend services, frontend apps, and tools.
 */

export * from "./money.js";
