import type { APIRequestContext } from "@playwright/test";
import { envOr, requireEnv } from "./env";

export type ApiCall = <T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown
) => Promise<T>;

export function createApiCall(request: APIRequestContext): ApiCall {
  const apiUrl = envOr("API_URL", "http://localhost:3000");
  const apiKey = requireEnv("E2E_API_KEY");

  return async function apiCall(method, path, body) {
    const res = await request.fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      data: body,
    });

    const text = await res.text();
    if (!res.ok()) {
      throw new Error(
        `API ${method} ${path} failed: ${res.status()} ${res.statusText()}\n${text}`
      );
    }
    return text ? (JSON.parse(text) as any) : (undefined as any);
  };
}
