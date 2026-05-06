const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_API_TIMEOUT_MS = 30_000;

export function getServerApiBaseUrl(): string {
  return process.env.API_URL || process.env.API_BASE_URL || DEFAULT_API_URL;
}

export function getServerApiTimeoutMs(): number {
  return DEFAULT_API_TIMEOUT_MS;
}

export function buildServerApiUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  return `${getServerApiBaseUrl().replace(/\/+$/, "")}${normalizedEndpoint}`;
}
