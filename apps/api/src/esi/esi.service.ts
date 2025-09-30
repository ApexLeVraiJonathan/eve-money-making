import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { PrismaService } from '../prisma/prisma.service';

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
};

@Injectable()
export class EsiService {
  private readonly baseUrl =
    process.env.ESI_BASE_URL ?? 'https://esi.evetech.net';
  private readonly userAgent = process.env.ESI_USER_AGENT ?? '';
  private readonly defaultTimeoutMs = Number(
    process.env.ESI_TIMEOUT_MS ?? 15000,
  );
  private readonly slowDownRemainThreshold = Number(
    process.env.ESI_ERROR_SLOWDOWN_REMAIN_THRESHOLD ?? 5,
  );
  private readonly slowDownDelayMs = Number(
    process.env.ESI_ERROR_SLOWDOWN_DELAY_MS ?? 500,
  );
  private readonly maxConcurrency = Number(
    process.env.ESI_MAX_CONCURRENCY ?? 4,
  );
  private readonly maxRetries = Number(process.env.ESI_MAX_RETRIES ?? 3);
  private readonly retryBaseDelayMs = Number(
    process.env.ESI_RETRY_BASE_DELAY_MS ?? 400,
  );

  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  // Simple semaphore
  private active = 0;
  private waiters: Array<() => void> = [];
  private effectiveMaxConcurrency: number = this.maxConcurrency;
  private readonly minConcurrency: number = Number(
    process.env.ESI_MIN_CONCURRENCY ?? 2,
  );
  private readonly concurrencyDecayFactor: number = Number(
    process.env.ESI_CONCURRENCY_DECAY ?? 0.5,
  );

  // Error budget
  private errorRemain: number | null = null;
  private errorResetAt: number | null = null; // epoch ms
  private haltUntil: number | null = null; // epoch ms
  private lastHaltUntilLogged: number | null = null;
  private lastWaitLogTs: number | null = null;
  private readonly errorLogThrottleMs: number = Number(
    process.env.ESI_ERROR_LOG_THROTTLE_MS ?? 5000,
  );
  private lastErrorLogAt: Map<string, number> = new Map();

  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
  ) {}

  private async acquire(): Promise<void> {
    if (this.active < this.effectiveMaxConcurrency) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active++;
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
    if (!this.userAgent) {
      this.logger.warn(
        'ESI_USER_AGENT not set; please configure per ESI best practices',
      );
    }

    const url = this.buildUrl(path, opts.query);
    const key = this.cacheKey(url);
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
      await this.respectErrorBudget();
      await this.acquire();
      try {
        const headers: Record<string, string> = {
          'User-Agent': this.userAgent,
          ...(opts.headers ?? {}),
        };
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
            const resHeaders = Object.fromEntries(
              Object.entries(res.headers).map(([k, v]) => [
                k.toLowerCase(),
                Array.isArray(v) ? v.join(',') : String(v),
              ]),
            ) as Record<string, string | undefined>;

            this.updateErrorBudget(resHeaders);

            // 304: use cache, but still use headers for metadata (including Expires/X-Pages)
            if (res.status === 304 && cached && cached.data !== undefined) {
              const newExpires =
                this.parseExpires(resHeaders) ?? cached.expiresAt;
              cached.expiresAt = newExpires;
              this.cache.set(key, cached);
              // Persist extended expiry
              if (newExpires) {
                await this.prisma.esiCacheEntry
                  .update({
                    where: { key },
                    data: { expiresAt: new Date(newExpires) },
                  })
                  .catch(() => undefined);
              }
              return {
                data: cached.data as T,
                status: cached.status ?? 200,
                meta: {
                  fromCache: true,
                  etag: cached.etag,
                  expiresAt: cached.expiresAt,
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
          } catch (err: unknown) {
            const status =
              typeof err === 'object' && err !== null && 'response' in err
                ? (err as { response?: { status?: number; headers?: any } })
                    .response?.status
                : undefined;
            const headersRaw =
              typeof err === 'object' && err !== null && 'response' in err
                ? (err as { response?: { headers?: any } }).response?.headers
                : undefined;

            // Handle ESI 420: update error budget and wait until reset before retrying
            if (status === 420 && headersRaw) {
              const resHeaders = Object.fromEntries(
                Object.entries(headersRaw).map(([k, v]) => [
                  k.toLowerCase(),
                  Array.isArray(v) ? v.join(',') : v ? String(v) : undefined,
                ]),
              ) as Record<string, string | undefined>;
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
                  `ESI: 420 received; reducing concurrency to ${this.effectiveMaxConcurrency}`,
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
                  `ESI 420 rate limit for ${u.pathname}${
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
              const resHeaders = Object.fromEntries(
                Object.entries(headersRaw).map(([k, v]) => [
                  k.toLowerCase(),
                  Array.isArray(v) ? v.join(',') : v ? String(v) : undefined,
                ]),
              ) as Record<string, string | undefined>;
              this.updateErrorBudget(resHeaders);
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
                  `ESI ${status ?? 'ERR'} for ${u.pathname}${
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
