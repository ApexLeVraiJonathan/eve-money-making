import { auth } from "@/auth";

/**
 * Helper to make authenticated API calls to NestJS with Bearer token from NextAuth session.
 */
export async function fetchWithAuth(
  endpoint: string,
  options?: RequestInit,
): Promise<Response> {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }

  const apiUrl = process.env.API_URL || "http://localhost:3000";
  const url = `${apiUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: options?.cache ?? "no-store",
  });
}

/**
 * Helper to make authenticated API calls and return JSON.
 */
export async function fetchWithAuthJson<T = unknown>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetchWithAuth(endpoint, options);

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new Error(error || `API error: ${response.status}`);
  }

  return response.json();
}
