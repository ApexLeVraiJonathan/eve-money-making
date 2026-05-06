import { auth } from "@/auth";
import {
  buildServerApiUrl,
  getServerApiTimeoutMs,
} from "@/lib/server-api-config";

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

  const url = buildServerApiUrl(endpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getServerApiTimeoutMs());

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: options?.cache ?? "no-store",
      signal: options?.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new Error(error || `API error: ${response.status}`);
  }

  return response.json();
}
