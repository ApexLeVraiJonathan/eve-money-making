/**
 * Frontend environment access helpers
 * 
 * Provides typed access to environment variables for client-side code.
 * Backend should use AppConfig in apps/api/src/common/config.ts
 */

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
}

export function getAdminApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? 'http://localhost:3001';
}

// Add more environment helpers as needed during migration

