import { auth } from "@/auth";

/**
 * Server-side helper to make authenticated API calls to NestJS backend.
 * Used only in server components and API routes.
 *
 * For client components, use @eve/api-client instead.
 */
export async function fetchWithAuthJson<T = unknown>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }

  const apiUrl = process.env.API_URL || "http://localhost:3001";
  const url = `${apiUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: options?.cache ?? "no-store",
  });

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new Error(error || `API error: ${response.status}`);
  }

  return response.json();
}
