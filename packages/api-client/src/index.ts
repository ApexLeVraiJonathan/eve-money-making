/**
 * @eve/api-client - Unified HTTP client for web apps
 * 
 * Provides a consistent client with multi-baseURL support and auto-injection
 * of Authorization headers from NextAuth sessions or localStorage.
 * 
 * Features:
 * - Multi-app support with different base URLs
 * - Automatic auth token injection (NextAuth or localStorage)
 * - Type-safe request/response handling
 * - Consistent error handling
 * - Support for both client and server components
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
export type AppId = "api" | "web-portal" | "web-admin" | string;

export type ApiClientOptions = Omit<RequestInit, "method" | "body" | "headers"> & {
  headers?: Record<string, string>;
  token?: string; // Manual token override (for server components with NextAuth)
};

/**
 * API client error with response details
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Base URL configuration per app
 * Note: NEXT_PUBLIC_API_URL should NOT include /api suffix - it's added by the backend routes
 */
const BASES: Record<AppId, string> = {
  api: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  "web-portal": process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  "web-admin": process.env.NEXT_PUBLIC_ADMIN_API_URL || "http://localhost:3002",
};

/**
 * Get base URL for an app
 */
function getBase(appId: AppId): string {
  return BASES[appId] ?? BASES["api"];
}

/**
 * Get authorization header from localStorage (client-side only)
 */
function authHeaderFromStorage(): Record<string, string> {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  return {};
}

/**
 * Make an HTTP request with automatic token injection
 */
async function request<T>(
  base: string,
  path: string,
  method: HttpMethod,
  body?: unknown,
  opts: ApiClientOptions = {}
): Promise<T> {
  const { token, headers: customHeaders, ...fetchOpts } = opts;

  // Build headers with priority: manual token > custom headers > localStorage
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : authHeaderFromStorage()),
    ...(customHeaders ?? {}),
  };

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      credentials: "include", // Send cookies with requests for session-based auth
      body: body ? JSON.stringify(body) : undefined,
      ...fetchOpts,
    });

    // Handle 204 No Content
    if (res.status === 204) {
      return undefined as T;
    }

    // Try to parse response body
    let responseData: unknown;
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      responseData = await res.json();
    } else {
      responseData = await res.text();
    }

    // Handle error responses
    if (!res.ok) {
      const message = typeof responseData === "string" 
        ? responseData 
        : (responseData as any)?.message ?? `HTTP ${res.status}`;
      throw new ApiError(message, res.status, responseData);
    }

    return responseData as T;
  } catch (error) {
    // Re-throw ApiError as-is
    if (error instanceof ApiError) {
      throw error;
    }
    // Wrap other errors
    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
      0,
      error
    );
  }
}

/**
 * API client instance with HTTP methods
 */
export interface ApiClient {
  get: <T>(path: string, opts?: ApiClientOptions) => Promise<T>;
  post: <T>(path: string, body?: unknown, opts?: ApiClientOptions) => Promise<T>;
  patch: <T>(path: string, body?: unknown, opts?: ApiClientOptions) => Promise<T>;
  put: <T>(path: string, body?: unknown, opts?: ApiClientOptions) => Promise<T>;
  delete: <T>(path: string, opts?: ApiClientOptions) => Promise<T>;
}

/**
 * Create an API client for a specific app with optional token injection.
 * 
 * Usage (Client Component):
 * ```ts
 * const client = clientForApp("api");
 * const data = await client.get<User[]>("/users");
 * ```
 * 
 * Usage (Server Component with NextAuth):
 * ```ts
 * import { auth } from "@/auth";
 * const session = await auth();
 * const client = clientForApp("api", session?.accessToken);
 * const data = await client.get<User[]>("/users");
 * ```
 * 
 * @param appId - App identifier for base URL selection
 * @param token - Optional auth token (for server components)
 * @returns API client instance
 */
export function clientForApp(appId: AppId = "api", token?: string): ApiClient {
  const base = getBase(appId);
  const tokenOpt = token ? { token } : {};

  return {
    get: <T>(path: string, opts?: ApiClientOptions) =>
      request<T>(base, path, "GET", undefined, { ...tokenOpt, ...opts }),
    post: <T>(path: string, body?: unknown, opts?: ApiClientOptions) =>
      request<T>(base, path, "POST", body, { ...tokenOpt, ...opts }),
    patch: <T>(path: string, body?: unknown, opts?: ApiClientOptions) =>
      request<T>(base, path, "PATCH", body, { ...tokenOpt, ...opts }),
    put: <T>(path: string, body?: unknown, opts?: ApiClientOptions) =>
      request<T>(base, path, "PUT", body, { ...tokenOpt, ...opts }),
    delete: <T>(path: string, opts?: ApiClientOptions) =>
      request<T>(base, path, "DELETE", undefined, { ...tokenOpt, ...opts }),
  };
}

