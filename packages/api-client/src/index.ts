/**
 * @eve/api-client - Unified HTTP client for web apps
 * 
 * Provides a consistent client with multi-baseURL support and auto-injection
 * of Authorization headers from NextAuth/localStorage.
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
export type AppId = "web-portal" | "web-admin" | string;

type Options = Omit<RequestInit, "method" | "body" | "headers"> & {
  headers?: Record<string, string>;
};

const BASES: Record<AppId, string> = {
  "web-portal": process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000",
  "web-admin": process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? "http://localhost:3001",
};

function getBase(appId: AppId): string {
  return BASES[appId] ?? BASES["web-portal"];
}

function authHeader(): Record<string, string> {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  return {};
}

async function request<T>(
  base: string,
  path: string,
  method: HttpMethod,
  body?: unknown,
  opts: Options = {}
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(opts.headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    ...opts,
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  
  return res.status === 204 ? (undefined as T) : res.json();
}

export function clientForApp(appId: AppId) {
  const base = getBase(appId);
  return {
    get: <T>(p: string, o?: Options) =>
      request<T>(base, p, "GET", undefined, o),
    post: <T>(p: string, b?: unknown, o?: Options) =>
      request<T>(base, p, "POST", b, o),
    patch: <T>(p: string, b?: unknown, o?: Options) =>
      request<T>(base, p, "PATCH", b, o),
    put: <T>(p: string, b?: unknown, o?: Options) =>
      request<T>(base, p, "PUT", b, o),
    delete: <T>(p: string, o?: Options) =>
      request<T>(base, p, "DELETE", undefined, o),
  };
}

