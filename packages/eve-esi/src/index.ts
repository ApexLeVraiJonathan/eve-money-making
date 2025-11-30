/**
 * @eve/eve-esi - ESI client types and adapter interface
 *
 * This package exposes framework-agnostic types for working with the
 * EVE Swagger Interface (ESI). Concrete implementations (e.g. NestJS
 * `EsiService`) should depend on these types rather than re-declaring
 * their own versions.
 */

export type EsiFetchMeta = {
  fromCache: boolean;
  etag?: string;
  expiresAt?: number;
  headers?: Record<string, string | undefined>;
};

export type EsiFetchOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  forceRefresh?: boolean;
  timeoutMs?: number;
  preferHeaders?: boolean;
  characterId?: number;
  reqId?: string;
};

export interface EsiClientAdapter {
  fetchJson<T>(
    path: string,
    opts?: EsiFetchOptions
  ): Promise<{ data: T; status: number; meta: EsiFetchMeta }>;
}

export const ESI_CLIENT_ADAPTER = Symbol("ESI_CLIENT_ADAPTER");
