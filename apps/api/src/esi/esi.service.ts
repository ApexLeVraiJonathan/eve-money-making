import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeHeaders } from '../common/http';
import { TokenService } from '../auth/token.service';
import { AppConfig } from '../common/config';

type CacheEntry = {
  etag?: string;
  lastModified?: string;
  expiresAt?: number;
  data?: unknown;
  status?: number;
};

type FetchMeta = {
  fromCache: boolean;
  etag?: string;
  expiresAt?: number;
  headers?: Record<string, string | undefined>;
};

type FetchOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  forceRefresh?: boolean;
  timeoutMs?: number;
  // When true, bypass in-memory/DB cached short-circuit to perform a conditional
  // request (with If-None-Match) to obtain fresh response headers (e.g. X-Pages).
  // This still respects caching (likely returns 304) but gives us headers.
  preferHeaders?: boolean;
  // Optional characterId to call authed endpoints. If present, we add Authorization and auto-refresh when needed.
  characterId?: number;
  // Optional request correlation id for structured logs
  reqId?: string;
};

@Injectable()
export class EsiService {
  private readonly config = AppConfig.esi();
  private readonly baseUrl = this.config.baseUrl;
  private readonly userAgent = this.config.userAgent;
  private readonly defaultTimeoutMs = this.config.timeoutMs;
  private readonly slowDownRemainThreshold = this.config.errorSlowdownRemainThreshold;
  private readonly slowDownDelayMs = this.config.errorSlowdownDelayMs;
  private readonly maxConcurrency = this.config.maxConcurrency;
  private readonly maxRetries = this.config.maxRetries;
  private readonly retryBaseDelayMs = this.config.retryBaseDelayMs;

  private readonly cache = new Map<string, CacheEntry>();
  private readonly memCacheMax = this.config.memCacheMax;
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly metrics = {
    cacheHitMem: 0,
    cacheHitDb: 0,
    cacheMiss: 0,
    http200: 0,
    http304: 0,
    http401: 0,
    http420: 0,
  } as const satisfies Record<string, number> as unknown as {
    cacheHitMem: number;
    cacheHitDb: number;
    cacheMiss: number;
    http200: number;
    http304: number;
    http401: number;
    http420: number;
  };

  // Simple semaphore
  private active = 0;
  private waiters: Array<() => void> = [];
  private effectiveMaxConcurrency: number = this.maxConcurrency;
  private readonly minConcurrency: number = this.config.minConcurrency;
  private readonly concurrencyDecayFactor: number = this.config.concurrencyDecayFactor;

  // Error budget
  private errorRemain: number | null = null;
  private errorResetAt: number | null = null; // epoch ms
  private haltUntil: number | null = null; // epoch ms
  private lastHaltUntilLogged: number | null = null;
  private lastWaitLogTs: number | null = null;
  private readonly errorLogThrottleMs: number = this.config.errorLogThrottleMs;
  private lastErrorLogAt: Map<string, number> = new Map();

  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {
    const intervalMs = this.config.memCacheSweepMs;
    if (intervalMs > 0) {
      setInterval(() => this.sweepExpiredFromMemCache(), intervalMs).unref?.();
    }
  }

  getMetricsSnapshot(): {
    cacheHitMem: number;
    cacheHitDb: number;
    cacheMiss: number;
    http200: number;
    http304: number;
    http401: number;
    http420: number;
    memCacheSize: number;
    inflightSize: number;
    effectiveMaxConcurrency: number;
    errorRemain: number | null;
    errorResetAt: number | null;
  } {
    return {
      cacheHitMem: this.metrics.cacheHitMem,
      cacheHitDb: this.metrics.cacheHitDb,
      cacheMiss: this.metrics.cacheMiss,
      http200: this.metrics.http200,
      http304: this.metrics.http304,
      http401: this.metrics.http401,
      http420: this.metrics.http420,
      memCacheSize: this.cache.size,
      inflightSize: this.inflight.size,
      effectiveMaxConcurrency: this.effectiveMaxConcurrency,
      errorRemain: this.errorRemain,
      errorResetAt: this.errorResetAt,
    };
  }

  private async getValidAccessToken(
    characterId: number,
  ): Promise<string | null> {
    return await this.tokens.getValidAccessToken(characterId);
  }

  private async forceRotateAccessToken(
    characterId: number,
  ): Promise<string | null> {
    try {
      return await this.tokens.forceRotateAccessToken(characterId);
    } catch {
      return null;
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.effectiveMaxConcurrency) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active++;
  }

  /**
   * Fetch a single page and expose total pages via X-Pages header when present.
   */
  async fetchPaged<T>(
    path: string,
    opts: FetchOptions & { page: number },
  ): Promise<{ data: T; totalPages: number | null; meta: FetchMeta }> {
    const { data, meta } = await this.fetchJson<T>(path, {
      ...opts,
      query: { ...(opts.query ?? {}), page: opts.page },
      preferHeaders: true,
    });
    let totalPages: number | null = null;
    const xp = meta.headers?.['x-pages'];
    if (typeof xp === 'string') {
      const n = Number(xp);
      if (!Number.isNaN(n) && n > 0) totalPages = n;
    }
    return { data, totalPages, meta };
  }

  private pruneMemCacheIfNeeded(): void {
    const overBy = this.cache.size - this.memCacheMax;
    if (overBy <= 0) return;
    // Drop oldest entries by insertion order (Map preserves insertion order)
    let toDrop = overBy;
    for (const k of this.cache.keys()) {
      this.cache.delete(k);
      toDrop--;
      if (toDrop <= 0) break;
    }
  }

  private sweepExpiredFromMemCache(): void {
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (typeof v.expiresAt === 'number' && v.expiresAt <= now) {
        this.cache.delete(k);
      }
    }
  }

  private release(): void {
    this.active--;
    const next = this.waiters.shift();
    if (next) next();
  }

  private buildUrl(path: string, query?: FetchOptions['query']): string {
    const url = new URL(
      path.startsWith('http') ? path : `${this.baseUrl}${path}`,
    );
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private cacheKey(url: string): string {
    return url;
  }

  private parseExpires(
    headers: Record<string, string | undefined>,
  ): number | undefined {
    const exp = headers['expires'];
    if (!exp) return undefined;
    const t = Date.parse(exp);
    return Number.isNaN(t) ? undefined : t;
  }

  // Normalize various header shapes (arrays, numbers, booleans) into strings.

  private updateErrorBudget(headers: Record<string, string | undefined>): void {
    const remainStr = headers['x-esi-error-limit-remain'];
    const resetStr = headers['x-esi-error-limit-reset'];
    if (remainStr) this.errorRemain = Number(remainStr);
    if (resetStr) {
      const sec = Number(resetStr);
      if (!Number.isNaN(sec)) this.errorResetAt = Date.now() + sec * 1000;
    }
    // Adaptive concurrency: if budget low, scale down effective concurrency
    if (
      this.errorRemain !== null &&
      this.errorRemain <= this.slowDownRemainThreshold &&
      this.effectiveMaxConcurrency > this.minConcurrency
    ) {
      const newConc = Math.max(
        this.minConcurrency,
        Math.floor(
          this.effectiveMaxConcurrency * this.concurrencyDecayFactor,
        ) || this.minConcurrency,
      );
      if (newConc < this.effectiveMaxConcurrency) {
        this.effectiveMaxConcurrency = newConc;
        this.logger.warn(
          `ESI: reducing concurrency to ${this.effectiveMaxConcurrency} due to low error budget (remain=${this.errorRemain})`,
        );
      }
    }
    if (
      this.errorRemain !== null &&
      this.errorRemain <= 0 &&
      this.errorResetAt
    ) {
      this.haltUntil = this.errorResetAt;
      if (this.lastHaltUntilLogged !== this.haltUntil) {
        this.logger.warn(
          `ESI error limit reached. Halting until ${new Date(
            this.haltUntil,
          ).toISOString()}`,
        );
        this.lastHaltUntilLogged = this.haltUntil;
      }
      // Drop to minimum concurrency when halted
      if (this.effectiveMaxConcurrency > this.minConcurrency) {
        this.effectiveMaxConcurrency = this.minConcurrency;
      }
    }
  }

  private async respectErrorBudget(): Promise<void> {
    const now = Date.now();
    if (this.haltUntil && now < this.haltUntil) {
      const waitMs = this.haltUntil - now;
      if (!this.lastWaitLogTs || now - this.lastWaitLogTs > 1000) {
        this.logger.warn(`Waiting ${waitMs}ms for ESI error limit reset`);
        this.lastWaitLogTs = now;
      }
      await new Promise((r) => setTimeout(r, waitMs));
    }
    if (
      this.errorRemain !== null &&
      this.errorRemain <= this.slowDownRemainThreshold
    ) {
      await new Promise((r) => setTimeout(r, this.slowDownDelayMs));
    }
  }

  private logErrorOnce(key: string, message: string): void {
    const now = Date.now();
    const last = this.lastErrorLogAt.get(key) ?? 0;
    if (now - last >= this.errorLogThrottleMs) {
      this.logger.warn(message);
      this.lastErrorLogAt.set(key, now);
    }
  }

  async fetchJson<T>(
    path: string,
    opts: FetchOptions = {},
  ): Promise<{ data: T; status: number; meta: FetchMeta }> {
    const pfx = opts.reqId ? `[reqId=${opts.reqId}] ` : '';
    if (!this.userAgent) {
      this.logger.warn(
        `${pfx}ESI_USER_AGENT not set; please configure per ESI best practices`,
      );
    }

    const url = this.buildUrl(path, opts.query);
    // Token-aware cache key for authed endpoints to avoid cross-character leakage
    const key = this.cacheKey(
      opts.characterId ? `${url}#c=${opts.characterId}` : url,
    );
    const cached = this.cache.get(key);
    const now = Date.now();

    if (
      cached &&
      cached.data !== undefined &&
      cached.expiresAt &&
      now < cached.expiresAt &&
      !opts.forceRefresh &&
      !opts.preferHeaders
    ) {
      this.metrics.cacheHitMem++;
      return {
        data: cached.data as T,
        status: cached.status ?? 200,
        meta: {
          fromCache: true,
          etag: cached.etag,
          expiresAt: cached.expiresAt,
        },
      };
    }

    // Check DB cache if memory cache miss or expired
    const dbEntry = await this.prisma.esiCacheEntry.findUnique({
      where: { key },
      select: {
        etag: true,
        lastModified: true,
        expiresAt: true,
        status: true,
        body: true,
      },
    });
    if (
      dbEntry &&
      dbEntry.body !== undefined &&
      dbEntry.expiresAt &&
      now < dbEntry.expiresAt.getTime() &&
      !opts.forceRefresh &&
      !opts.preferHeaders
    ) {
      this.metrics.cacheHitDb++;
      const mem: CacheEntry = {
        etag: dbEntry.etag ?? undefined,
        lastModified: dbEntry.lastModified ?? undefined,
        expiresAt: dbEntry.expiresAt.getTime(),
        data: dbEntry.body as unknown,
        status: dbEntry.status ?? undefined,
      };
      this.cache.set(key, mem);
      return {
        data: dbEntry.body as T,
        status: dbEntry.status ?? 200,
        meta: {
          fromCache: true,
          etag: dbEntry.etag ?? undefined,
          expiresAt: dbEntry.expiresAt.getTime(),
        },
      };
    }

    if (this.inflight.has(key)) {
      const p = this.inflight.get(key) as Promise<{
        data: T;
        status: number;
        meta: FetchMeta;
      }>;
      return await p;
    }

    const run = async () => {
      this.metrics.cacheMiss++;
      await this.respectErrorBudget();
      await this.acquire();
      try {
        const headers: Record<string, string> = {
          'User-Agent': this.userAgent,
          ...(opts.headers ?? {}),
        };
        // Inject bearer token for authed endpoints
        if (opts.characterId && !headers['Authorization']) {
          const bearer = await this.getValidAccessToken(opts.characterId);
          if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
        }
        const etagForRequest = cached?.etag ?? dbEntry?.etag ?? undefined;
        if (etagForRequest) headers['If-None-Match'] = etagForRequest;

        const config: AxiosRequestConfig = {
          url,
          method: 'GET',
          headers,
          timeout: opts.timeoutMs ?? this.defaultTimeoutMs,
          validateStatus: (s) => (s >= 200 && s < 300) || s === 304,
        };

        let attempt = 0;
        // retry loop for transient/network errors, respecting validateStatus

        while (true) {
          try {
            const res = await axios.request(config);
            if (opts.reqId) {
              this.logger.debug(
                `[reqId=${opts.reqId}] ESI ${config.method?.toString().toUpperCase()} ${url} -> ${res.status}`,
              );
            }
            const resHeaders = normalizeHeaders(res.headers);

            this.updateErrorBudget(resHeaders);

            // 304: no body returned. Use cached body from memory or DB; update headers/expiry.
            if (res.status === 304) {
              this.metrics.http304++;
              const dbBody = dbEntry?.body as object | undefined;
              const bodyFromCache =
                cached?.data !== undefined ? cached.data : dbBody;
              const currentStatus = cached?.status ?? dbEntry?.status ?? 200;
              const etag =
                resHeaders['etag'] ??
                cached?.etag ??
                dbEntry?.etag ??
                undefined;
              const lastModified =
                resHeaders['last-modified'] ??
                cached?.lastModified ??
                dbEntry?.lastModified ??
                undefined;
              const newExpires =
                this.parseExpires(resHeaders) ??
                cached?.expiresAt ??
                (dbEntry?.expiresAt ? dbEntry.expiresAt.getTime() : undefined);

              // If we have no body anywhere, do a one-off unconditional fetch to populate body
              if (bodyFromCache === undefined) {
                const unconditionalHeaders: Record<string, string> = {
                  'User-Agent': this.userAgent,
                  ...(opts.headers ?? {}),
                };
                if (
                  opts.characterId &&
                  !unconditionalHeaders['Authorization']
                ) {
                  const bearer = await this.getValidAccessToken(
                    opts.characterId,
                  );
                  if (bearer)
                    unconditionalHeaders['Authorization'] = `Bearer ${bearer}`;
                }
                const unconditionalRes = await axios.request({
                  ...config,
                  headers: unconditionalHeaders, // no If-None-Match
                });
                const unconditionalResHeaders = normalizeHeaders(
                  unconditionalRes.headers,
                );
                this.updateErrorBudget(unconditionalResHeaders);
                const unconditionalEtag =
                  unconditionalResHeaders['etag'] ?? etag;
                const unconditionalLastModified =
                  unconditionalResHeaders['last-modified'] ?? lastModified;
                const unconditionalExpires =
                  this.parseExpires(unconditionalResHeaders) ?? newExpires;
                const entry: CacheEntry = {
                  etag: unconditionalEtag,
                  lastModified: unconditionalLastModified,
                  expiresAt: unconditionalExpires,
                  data: unconditionalRes.data as T,
                  status: unconditionalRes.status,
                };
                this.cache.set(key, entry);
                this.pruneMemCacheIfNeeded();
                await this.prisma.esiCacheEntry
                  .upsert({
                    where: { key },
                    create: {
                      key,
                      etag: entry.etag ?? null,
                      lastModified: entry.lastModified ?? null,
                      expiresAt: entry.expiresAt
                        ? new Date(entry.expiresAt)
                        : null,
                      status: entry.status ?? null,
                      body: entry.data as object,
                    },
                    update: {
                      etag: entry.etag ?? null,
                      lastModified: entry.lastModified ?? null,
                      expiresAt: entry.expiresAt
                        ? new Date(entry.expiresAt)
                        : null,
                      status: entry.status ?? null,
                      body: entry.data as object,
                    },
                  })
                  .catch(() => undefined);
                if (
                  unconditionalRes.status >= 200 &&
                  unconditionalRes.status < 300
                )
                  this.metrics.http200++;
                return {
                  data: unconditionalRes.data as T,
                  status: unconditionalRes.status,
                  meta: {
                    fromCache: false,
                    etag: entry.etag,
                    expiresAt: entry.expiresAt,
                    headers: unconditionalResHeaders,
                  },
                };
              }

              // We do have a body from mem or DB; refresh mem cache and extend DB expiry
              const entry: CacheEntry = {
                etag,
                lastModified,
                expiresAt: newExpires,
                data: bodyFromCache,
                status: currentStatus,
              };
              this.cache.set(key, entry);
              this.pruneMemCacheIfNeeded();
              if (newExpires) {
                await this.prisma.esiCacheEntry
                  .upsert({
                    where: { key },
                    create: {
                      key,
                      etag: entry.etag ?? null,
                      lastModified: entry.lastModified ?? null,
                      expiresAt: entry.expiresAt
                        ? new Date(entry.expiresAt)
                        : null,
                      status: entry.status ?? null,
                      body: entry.data as object,
                    },
                    update: {
                      etag: entry.etag ?? null,
                      lastModified: entry.lastModified ?? null,
                      expiresAt: entry.expiresAt
                        ? new Date(entry.expiresAt)
                        : null,
                      status: entry.status ?? null,
                      body: entry.data as object,
                    },
                  })
                  .catch(() => undefined);
              }
              return {
                data: entry.data as T,
                status: entry.status ?? 200,
                meta: {
                  fromCache: true,
                  etag: entry.etag,
                  expiresAt: entry.expiresAt,
                  headers: resHeaders,
                },
              };
            }

            const etag = resHeaders['etag'];
            const lastModified = resHeaders['last-modified'];
            const expiresAt = this.parseExpires(resHeaders);

            const entry: CacheEntry = {
              etag: etag ?? cached?.etag,
              lastModified: lastModified ?? cached?.lastModified,
              expiresAt: expiresAt ?? cached?.expiresAt,
              data: res.data as T,
              status: res.status,
            };
            this.cache.set(key, entry);
            this.pruneMemCacheIfNeeded();

            // Persist in DB
            await this.prisma.esiCacheEntry
              .upsert({
                where: { key },
                create: {
                  key,
                  etag: entry.etag ?? null,
                  lastModified: entry.lastModified ?? null,
                  expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
                  status: entry.status ?? null,
                  body: entry.data as object,
                },
                update: {
                  etag: entry.etag ?? null,
                  lastModified: entry.lastModified ?? null,
                  expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
                  status: entry.status ?? null,
                  body: entry.data as object,
                },
              })
              .catch(() => undefined);

            if (res.status >= 200 && res.status < 300) this.metrics.http200++;
            return {
              data: res.data as T,
              status: res.status,
              meta: {
                fromCache: false,
                etag: entry.etag,
                expiresAt: entry.expiresAt,
                headers: resHeaders,
              },
            };
          } catch (err) {
            const status =
              typeof err === 'object' && err !== null && 'response' in err
                ? (err as { response?: { status?: number; headers?: any } })
                    .response?.status
                : undefined;
            const headersRaw =
              typeof err === 'object' && err !== null && 'response' in err
                ? (err as { response?: { headers?: unknown } }).response
                    ?.headers
                : undefined;

            // Handle ESI 420: update error budget and wait until reset before retrying
            if (status === 420 && headersRaw) {
              this.metrics.http420++;
              const resHeaders = normalizeHeaders(headersRaw);
              this.updateErrorBudget(resHeaders);
              // Aggressively reduce concurrency on 420
              if (this.effectiveMaxConcurrency > this.minConcurrency) {
                this.effectiveMaxConcurrency = Math.max(
                  this.minConcurrency,
                  Math.floor(
                    this.effectiveMaxConcurrency * this.concurrencyDecayFactor,
                  ) || this.minConcurrency,
                );
                this.logger.warn(
                  `${pfx}ESI: 420 received; reducing concurrency to ${this.effectiveMaxConcurrency}`,
                );
              }
              // Log diagnostic once per URL+status
              try {
                const u = new URL(url);
                const page = u.searchParams.get('page');
                const remain = resHeaders['x-esi-error-limit-remain'];
                const reset = resHeaders['x-esi-error-limit-reset'];
                const key = `420:${u.pathname}`;
                this.logErrorOnce(
                  key,
                  `${pfx}ESI 420 rate limit for ${u.pathname}${
                    page ? `?page=${page}` : ''
                  } (remain=${remain}, reset=${reset}s)`,
                );
              } catch {
                // ignore URL parse errors
              }
              await this.respectErrorBudget();
              continue;
            }

            // For other HTTP statuses with headers, still update error budget if present
            if (headersRaw) {
              const resHeaders = normalizeHeaders(headersRaw);
              this.updateErrorBudget(resHeaders);
              if (status === 401) this.metrics.http401++;
              if (status === 401 && opts.characterId) {
                const www = resHeaders['www-authenticate'];
                if (www) {
                  this.logger.warn(`${pfx}ESI 401 WWW-Authenticate: ${www}`);
                }
                // Attempt a one-time refresh and retry the same request with new token
                const newToken = await this.forceRotateAccessToken(
                  opts.characterId,
                );
                if (newToken) {
                  const retryHeaders = {
                    ...headers,
                    Authorization: `Bearer ${newToken}`,
                  } as Record<string, string>;
                  const retryRes = await axios.request({
                    ...config,
                    headers: retryHeaders,
                  });
                  if (opts.reqId) {
                    this.logger.debug(
                      `[reqId=${opts.reqId}] ESI RETRY ${config.method?.toString().toUpperCase()} ${url} -> ${retryRes.status}`,
                    );
                  }
                  const retryResHeaders = normalizeHeaders(retryRes.headers);
                  this.updateErrorBudget(retryResHeaders);
                  if (retryRes.status === 304) {
                    this.metrics.http304++;
                    const dbBody = dbEntry?.body as object | undefined;
                    const bodyFromCache =
                      cached?.data !== undefined ? cached.data : dbBody;
                    const currentStatus =
                      cached?.status ?? dbEntry?.status ?? 200;
                    const etag =
                      retryResHeaders['etag'] ??
                      cached?.etag ??
                      dbEntry?.etag ??
                      undefined;
                    const lastModified =
                      retryResHeaders['last-modified'] ??
                      cached?.lastModified ??
                      dbEntry?.lastModified ??
                      undefined;
                    const newExpires =
                      this.parseExpires(retryResHeaders) ??
                      cached?.expiresAt ??
                      (dbEntry?.expiresAt
                        ? dbEntry.expiresAt.getTime()
                        : undefined);

                    if (bodyFromCache === undefined) {
                      const unconditionalHeaders: Record<string, string> = {
                        'User-Agent': this.userAgent,
                        ...(opts.headers ?? {}),
                      };
                      const unconditionalRes = await axios.request({
                        ...config,
                        headers: unconditionalHeaders, // no If-None-Match
                      });
                      const unconditionalResHeaders = normalizeHeaders(
                        unconditionalRes.headers,
                      );
                      this.updateErrorBudget(unconditionalResHeaders);
                      const entry: CacheEntry = {
                        etag: unconditionalResHeaders['etag'] ?? etag,
                        lastModified:
                          unconditionalResHeaders['last-modified'] ??
                          lastModified,
                        expiresAt:
                          this.parseExpires(unconditionalResHeaders) ??
                          newExpires,
                        data: unconditionalRes.data as T,
                        status: unconditionalRes.status,
                      };
                      this.cache.set(key, entry);
                      this.pruneMemCacheIfNeeded();
                      await this.prisma.esiCacheEntry
                        .upsert({
                          where: { key },
                          create: {
                            key,
                            etag: entry.etag ?? null,
                            lastModified: entry.lastModified ?? null,
                            expiresAt: entry.expiresAt
                              ? new Date(entry.expiresAt)
                              : null,
                            status: entry.status ?? null,
                            body: entry.data as object,
                          },
                          update: {
                            etag: entry.etag ?? null,
                            lastModified: entry.lastModified ?? null,
                            expiresAt: entry.expiresAt
                              ? new Date(entry.expiresAt)
                              : null,
                            status: entry.status ?? null,
                            body: entry.data as object,
                          },
                        })
                        .catch(() => undefined);
                      if (
                        unconditionalRes.status >= 200 &&
                        unconditionalRes.status < 300
                      )
                        this.metrics.http200++;
                      return {
                        data: unconditionalRes.data as T,
                        status: unconditionalRes.status,
                        meta: {
                          fromCache: false,
                          etag: entry.etag,
                          expiresAt: entry.expiresAt,
                          headers: unconditionalResHeaders,
                        },
                      };
                    }

                    const entry: CacheEntry = {
                      etag,
                      lastModified,
                      expiresAt: newExpires,
                      data: bodyFromCache,
                      status: currentStatus,
                    };
                    this.cache.set(key, entry);
                    this.pruneMemCacheIfNeeded();
                    if (newExpires) {
                      await this.prisma.esiCacheEntry
                        .upsert({
                          where: { key },
                          create: {
                            key,
                            etag: entry.etag ?? null,
                            lastModified: entry.lastModified ?? null,
                            expiresAt: entry.expiresAt
                              ? new Date(entry.expiresAt)
                              : null,
                            status: entry.status ?? null,
                            body: entry.data as object,
                          },
                          update: {
                            etag: entry.etag ?? null,
                            lastModified: entry.lastModified ?? null,
                            expiresAt: entry.expiresAt
                              ? new Date(entry.expiresAt)
                              : null,
                            status: entry.status ?? null,
                            body: entry.data as object,
                          },
                        })
                        .catch(() => undefined);
                    }
                    return {
                      data: entry.data as T,
                      status: entry.status ?? 200,
                      meta: {
                        fromCache: true,
                        etag: entry.etag,
                        expiresAt: entry.expiresAt,
                        headers: retryResHeaders,
                      },
                    };
                  }
                  const etag = retryResHeaders['etag'];
                  const lastModified = retryResHeaders['last-modified'];
                  const expiresAt = this.parseExpires(retryResHeaders);
                  const entry: CacheEntry = {
                    etag: etag ?? cached?.etag,
                    lastModified: lastModified ?? cached?.lastModified,
                    expiresAt: expiresAt ?? cached?.expiresAt,
                    data: retryRes.data as T,
                    status: retryRes.status,
                  };
                  this.cache.set(key, entry);
                  this.pruneMemCacheIfNeeded();
                  await this.prisma.esiCacheEntry
                    .upsert({
                      where: { key },
                      create: {
                        key,
                        etag: entry.etag ?? null,
                        lastModified: entry.lastModified ?? null,
                        expiresAt: entry.expiresAt
                          ? new Date(entry.expiresAt)
                          : null,
                        status: entry.status ?? null,
                        body: entry.data as object,
                      },
                      update: {
                        etag: entry.etag ?? null,
                        lastModified: entry.lastModified ?? null,
                        expiresAt: entry.expiresAt
                          ? new Date(entry.expiresAt)
                          : null,
                        status: entry.status ?? null,
                        body: entry.data as object,
                      },
                    })
                    .catch(() => undefined);
                  if (retryRes.status >= 200 && retryRes.status < 300)
                    this.metrics.http200++;
                  return {
                    data: retryRes.data as T,
                    status: retryRes.status,
                    meta: {
                      fromCache: false,
                      etag: entry.etag,
                      expiresAt: entry.expiresAt,
                      headers: retryResHeaders,
                    },
                  };
                }
              }
              try {
                const u = new URL(url);
                const page = u.searchParams.get('page');
                const remain = resHeaders['x-esi-error-limit-remain'];
                const reset = resHeaders['x-esi-error-limit-reset'];
                const key = `${status ?? 0}:${u.pathname}`;
                const note =
                  status === 404 && u.pathname.includes('/markets/')
                    ? ' (page may not exist)'
                    : '';
                this.logErrorOnce(
                  key,
                  `${pfx}ESI ${status ?? 'ERR'} for ${u.pathname}${
                    page ? `?page=${page}` : ''
                  }${note} (remain=${remain}, reset=${reset}s)`,
                );
              } catch {
                // ignore URL parse errors
              }
            }

            attempt++;
            // Retry only for network/5xx-like errors
            const isRetryable =
              status === undefined || (status >= 500 && status < 600);
            if (!isRetryable || attempt >= this.maxRetries) {
              throw err;
            }
            // exponential backoff with jitter
            const backoff =
              this.retryBaseDelayMs * Math.pow(2, attempt - 1) +
              Math.floor(Math.random() * 200);
            await new Promise((r) => setTimeout(r, backoff));
            // loop and retry
          }
        }
      } finally {
        this.release();
      }
    };

    const p = run()
      .catch((err) => {
        // Basic retry/backoff could be added here later
        throw err;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, p);
    return (await p) as { data: T; status: number; meta: FetchMeta };
  }

  async withMaxConcurrency<T>(
    maxConcurrency: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const prev = this.effectiveMaxConcurrency;
    this.effectiveMaxConcurrency = Math.max(1, Math.floor(maxConcurrency));
    try {
      return await fn();
    } finally {
      this.effectiveMaxConcurrency = prev;
    }
  }
}
