/**
 * Frontend environment access helpers
 *
 * Provides typed access to environment variables for client-side code.
 * Backend should use AppConfig in apps/api/src/common/config.ts
 *
 * Note: Only NEXT_PUBLIC_* variables are accessible client-side in Next.js.
 */

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
}

export function getAdminApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:3002";
}

export function getWebBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WEB_BASE_URL ||
    process.env.WEB_BASE_URL ||
    "http://localhost:3001"
  );
}

export function getNextAuthUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3001";
}

export function getNodeEnv(): "development" | "production" | "test" {
  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "test") return "test";
  return "development";
}

export function isDev(): boolean {
  return getNodeEnv() === "development";
}

export function isProd(): boolean {
  return getNodeEnv() === "production";
}

export function isBrowser(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (
    typeof (globalThis as unknown as { window?: unknown }).window !==
    "undefined"
  );
}

export function isServer(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (
    typeof (globalThis as unknown as { window?: unknown }).window ===
    "undefined"
  );
}

/**
 * Object-based API for convenience (same as individual functions above)
 */
export const env = {
  apiUrl: getApiBaseUrl,
  adminApiUrl: getAdminApiBaseUrl,
  webBaseUrl: getWebBaseUrl,
  nextAuthUrl: getNextAuthUrl,
  nodeEnv: getNodeEnv,
  isDev,
  isProd,
  isBrowser,
  isServer,
} as const;
