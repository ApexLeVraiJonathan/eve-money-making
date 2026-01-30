## Environment variables

Copy this file to `.env` and fill in the values you need. Only the **required** ones are necessary to start; the **optional** ones have sensible defaults in code.

---

### Backend (NestJS API – `apps/api`)

#### Required (API will fail fast if missing)

- **DATABASE_URL**: Prisma connection string to your Postgres database.
  - Example: `DATABASE_URL=postgresql://user:password@localhost:5432/eve_money?schema=public`
- **ENCRYPTION_KEY**: Secret used to derive the AES-GCM key for token encryption.
  - Example: `ENCRYPTION_KEY=please-use-a-long-random-secret`
- **NEXTAUTH_SECRET**: Shared secret used by both NextAuth and the API for session / token crypto.
  - Example: `NEXTAUTH_SECRET=your-random-secret-here`
- **ESI_SSO_CLIENT_ID**: Unified EVE SSO application client ID (used by the API for all SSO flows).
- **ESI_SSO_CLIENT_SECRET**: Unified EVE SSO application client secret.

> These required vars are enforced by `apps/api/src/common/env-validation.ts` and `apps/api/scripts/check-env.ts`.

#### Recommended / common backend vars

- **APP_ENV**: Logical environment used by the API (`dev | test | prod`). Default: from `NODE_ENV` (prod).
- **NODE_ENV**: Node environment (`development | production | test`). Affects logging and job defaults.
- **PORT**: Port for the API application. Default: `3000`.
  - Example: `PORT=3000`
- **API_BASE_URL**: Base URL of the API, used to construct OAuth callback URLs.
  - Dev: `API_BASE_URL=http://localhost:3000`
  - Prod: `API_BASE_URL=https://your-api-domain.railway.app`
- **WEB_BASE_URL**: Base URL of the web app, used for return URLs and CORS defaults.
  - Dev: `WEB_BASE_URL=http://localhost:3001`
  - Prod: `WEB_BASE_URL=https://yourdomain.com`
- **API_URL**: Public URL where the API is reachable from the web app and scripts.
  - Dev: `API_URL=http://localhost:3000`
  - Prod: `API_URL=https://your-api-domain.railway.app`
- **CORS_ORIGINS**: Comma-separated list of extra allowed origins for the API.
  - Example: `CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com`

#### Database (dev / test helpers)

- **DATABASE_URL_DEV**: Prisma URL for local dev DB (used when `APP_ENV` starts with `dev`).
  - Example: `DATABASE_URL_DEV=postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public`
- **DATABASE_URL_TEST**: Prisma URL base for tests (used when `APP_ENV` starts with `test`).
  - Example: `DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/eve_money_test?schema=public`

#### Security / JWT (optional, but strongly recommended for prod)

- **JWT_SECRET**: Secret for signing API JWTs.
  - Default (dev-only): `"dev-secret-change-in-production"`
- **JWT_EXPIRES_IN**: JWT expiry duration (e.g. `7d`, `24h`).
  - Default: `7d`

#### ESI HTTP client (backend)

- **ESI_USER_AGENT** (recommended): User-Agent string sent to EVE ESI per best practices.
  - Recommended format: `AppName/1.0.0 (contact@example.com; +https://github.com/you/repo)`
  - Example: `ESI_USER_AGENT=EveMoneyMaker/0.1.0 (you@example.com; +https://github.com/you/eve-money-making)`
- **ESI_BASE_URL**: Base URL for ESI.
  - Default: `https://esi.evetech.net`
- **ESI_TIMEOUT_MS**: Per-request timeout in milliseconds.
  - Default: `15000`
- **ESI_MAX_CONCURRENCY**: Max number of concurrent ESI calls.
  - Default: `4`
- **ESI_MIN_CONCURRENCY**: Minimum concurrency when backing off.
  - Default: `2`
- **ESI_MAX_RETRIES**: Max retry attempts for failed ESI calls.
  - Default: `3`
- **ESI_RETRY_BASE_DELAY_MS**: Base delay (ms) between retries.
  - Default: `400`
- **ESI_ERROR_SLOWDOWN_REMAIN_THRESHOLD**: Slow down when error budget remain is at/below this number.
  - Default: `5`
- **ESI_ERROR_SLOWDOWN_DELAY_MS**: Delay (ms) when slowing down.
  - Default: `500`
- **ESI_CONCURRENCY_DECAY**: Factor (0–1) controlling how quickly concurrency decays on errors.
  - Default: `0.5`
- **ESI_ERROR_LOG_THROTTLE_MS**: Throttle window (ms) for logging repeated ESI errors.
  - Default: `5000`
- **ESI_MEM_CACHE_MAX**: Max number of items in in-memory ESI cache.
  - Default: `5000`
- **ESI_MEM_CACHE_SWEEP_MS**: Sweep interval (ms) for in-memory ESI cache.
  - Default: `300000` (5 minutes)

#### ESI SSO (backend)

These control scopes and return URLs for the unified SSO app:

- **ESI_SSO_SCOPES**: Base comma-separated list of ESI scopes (optional).
- **ESI_SSO_SCOPES_ADMIN**: Scopes for admin flows. Default: falls back to `ESI_SSO_SCOPES`.
- **ESI_SSO_SCOPES_USER**: Scopes for regular user characters (optional, can be empty for auth-only).
- **ESI_SSO_SCOPES_SYSTEM**: Scopes for system characters (logistics / admin).
- **ESI_SSO_SCOPES_LOGIN**: Explicit scopes for login flows. Default: falls back to `ESI_SSO_SCOPES_USER` / `ESI_SSO_SCOPES`.
- **ESI_SSO_SCOPES_CHARACTER**: Explicit scopes for character-link flows. Default: falls back to `ESI_SSO_SCOPES_USER`.
- **ESI_SSO_RETURN_URL_ALLOWLIST**: Comma-separated list of allowed return URLs for SSO.
  - Default: `http://localhost:3001,http://127.0.0.1:3001` plus `WEB_BASE_URL` / `NEXT_PUBLIC_WEB_BASE_URL`.
- **ESI_SSO_DEFAULT_RETURN_URL**: Default return URL when no explicit returnUrl is provided (optional).

#### Legacy / dev ESI credentials (optional)

These are still supported for local/dev or migration scenarios:

- **ESI_CLIENT_ID_DEV**
- **ESI_CLIENT_SECRET_DEV**
- **ESI_REDIRECT_URI_DEV**
- **ESI_SSO_USER_AGENT** (alternative to `ESI_USER_AGENT`)

#### Jobs (optional toggles)

- **ENABLE_JOBS**: Enable all cron jobs.
  - Default: enabled when `NODE_ENV === "production"`, disabled otherwise.

Per-job flags (all default to **enabled** when the env var is **unset**):

- **JOB_MARKET_GATHERING_ENABLED**: Market gatherer (structure + NPC) runner (every 15 minutes).
  - Legacy alias: `JOB_MARKET_GATHER_ENABLED`
- **JOB_WALLET_IMPORTS_ENABLED**: Wallet imports + allocation (hourly).
  - Legacy alias: `JOB_WALLETS_ENABLED`
- **JOB_CAPITAL_RECOMPUTE_ENABLED**: Capital recompute for open cycles (hourly).
  - Legacy alias: `JOB_CAPITAL_ENABLED`
- **JOB_DAILY_IMPORTS_ENABLED**: Daily market import checks (daily @ 10:00).
- **JOB_SKILL_PLAN_NOTIFICATIONS_ENABLED**: Skill plan notifications (hourly).
- **JOB_SKILL_FARM_NOTIFICATIONS_ENABLED**: Skill farm notifications (hourly).
- **JOB_EXPIRY_NOTIFICATIONS_ENABLED**: PLEX/MCT/booster expiry summaries (daily @ 09:00).
- **JOB_ESI_CACHE_CLEANUP_ENABLED**: ESI cache cleanup (hourly).
  - Legacy alias: `JOB_CLEANUP_ENABLED`
- **JOB_OAUTH_STATE_CLEANUP_ENABLED**: OAuth-state cleanup (hourly).
  - Legacy alias: `JOB_CLEANUP_ENABLED`
- **JOB_SYSTEM_TOKENS_REFRESH_ENABLED**: Refresh SYSTEM character tokens (monthly @ 02:00 on day 1).
  - Legacy alias: `JOB_SYSTEM_TOKENS_ENABLED`

#### Market gatherer (cron runner)

The market gatherer cron is implemented in `apps/api` (NestJS Schedule). It is considered **active** only when all of these are true:

- `APP_ENV=prod` (the runner is intentionally disabled in `dev/test`)
- `ENABLE_JOBS=true` (or `NODE_ENV=production` when `ENABLE_JOBS` is not set)
- `JOB_MARKET_GATHERING_ENABLED=true`

Then each collector has its own enable flag:

**Structure self-market (C-N):**

- **MARKET_SELF_GATHER_ENABLED**: Master enable for structure collection.
- **MARKET_SELF_GATHER_STRUCTURE_ID**: Structure ID (bigint).
- **MARKET_SELF_GATHER_CHARACTER_ID**: Character ID used to call the structure market endpoint (must have structure market access).
- **Note**: there are no hardcoded defaults; when enabled you must set both IDs explicitly.
- **MARKET_SELF_GATHER_POLL_MINUTES**: Intended poll interval in minutes (UI only for now). Default: `15`.
- **MARKET_SELF_GATHER_EXPIRY_WINDOW_MINUTES**: Expiry window heuristic (upper-bound mode). Default: `360`.
- **MARKET_SELF_GATHER_NOTIFY_USER_ID**: Optional Discord userId to DM after repeated failures.

**NPC market (Rens, etc):**

- **MARKET_NPC_GATHER_ENABLED**: Master enable for NPC market collection (station/regional orders).
  - Default: `true`
- **MARKET_NPC_GATHER_STATION_ID**: Default stationId to collect (if not provided). Default: `60004588` (Rens).
- **MARKET_NPC_GATHER_POLL_MINUTES**: Intended poll interval in minutes. Default: `15`.
- **MARKET_NPC_GATHER_EXPIRY_WINDOW_MINUTES**: Expiry window heuristic (upper-bound mode). Default: `360`.
- **MARKET_NPC_GATHER_NOTIFY_USER_ID**: Optional Discord userId to DM after repeated failures.
- **MARKET_NPC_GATHER_TIMING_DEBUG**: Verbose timing logs (`true/false`). Default: `false`.

#### Cycle Accounting (optional tuning)

- **DEFAULT_SALES_TAX_PCT**: Sales tax percentage.
  - Default: `3.37`
- **DEFAULT_BROKER_FEE_PCT**: Broker fee percentage.
  - Default: `1.5`
- **DEFAULT_RELIST_FEE_PCT**: Relist fee percentage.
  - Default: `0.3`
- **WALLET_RESERVE_PER_CHAR**: ISK to reserve per character when calculating available capital.
  - Default: `100000000` (100M ISK)
- **DEFAULT_SOURCE_STATION_ID**, **DEFAULT_MAX_INVENTORY_DAYS**, **DEFAULT_MARGIN_VALIDATE_THRESHOLD**, **DEFAULT_MIN_TOTAL_PROFIT_ISK**, **DEFAULT_MIN_MARGIN_PERCENT**, **DEFAULT_STATION_CONCURRENCY**, **DEFAULT_ITEM_CONCURRENCY**: Advanced planner / tradecraft tuning (optional).

#### Discord Integration (optional)

These power Discord DM notifications and in-app support/feedback flows. All are **optional**; if omitted, the app degrades gracefully.

- **DISCORD_CLIENT_ID**: OAuth client ID for linking Discord accounts.
- **DISCORD_CLIENT_SECRET**: OAuth client secret for Discord.
- **DISCORD_REDIRECT_URI**: Redirect URL for Discord OAuth callback.
  - Default: `<API_BASE_URL>/notifications/discord/callback`
- **DISCORD_BOT_TOKEN**: Bot token used to send DMs.
- **DISCORD_GUILD_ID**: Guild/server ID for validation (optional).
- **DISCORD_SUPPORT_WEBHOOK_URL**: Discord webhook URL for support requests channel.
  - Optional: If not set, support requests will be accepted but not sent to Discord.
- **DISCORD_FEEDBACK_WEBHOOK_URL**: Discord webhook URL for feedback channel.
  - Optional: If not set, feedback will be accepted but not sent to Discord.

**Webhook setup (support/feedback):**

1. In your Discord server, go to _Server Settings → Integrations → Webhooks_.
2. Create separate webhooks for support and feedback channels.
3. Copy each webhook URL into `DISCORD_SUPPORT_WEBHOOK_URL` and `DISCORD_FEEDBACK_WEBHOOK_URL`.

---

### Frontend (Next.js web – `apps/web`)

The web app reads most of its configuration from the same `.env`, but only `NEXT_PUBLIC_*` vars are exposed to the browser.

#### Required for production

- **NEXTAUTH_URL**: Public URL of your Next.js application.
  - Dev: `NEXTAUTH_URL=http://localhost:3001`
  - Prod: `NEXTAUTH_URL=https://yourdomain.com`
- **NEXTAUTH_SECRET**: Same value as the backend; used by NextAuth.
- **NEXT_PUBLIC_API_URL**: Public URL of your NestJS API (used by browser and shared client).
  - Dev: `NEXT_PUBLIC_API_URL=http://localhost:3000`
  - Prod: `NEXT_PUBLIC_API_URL=https://your-api-domain.railway.app`
  - **Note**: Do **not** include `/api` suffix.
- **NEXT_PUBLIC_WEB_BASE_URL**: Public URL of your Next.js web application.
  - Dev: `NEXT_PUBLIC_WEB_BASE_URL=http://localhost:3001`
  - Prod: `NEXT_PUBLIC_WEB_BASE_URL=https://yourdomain.com`

#### Optional / advanced frontend vars

- **APP_ENV**: Logical environment (`dev | test | prod`) used to set `NEXT_PUBLIC_APP_ENV` at build time.
  - Default: `NODE_ENV` (mapped to `prod` / `dev`).
- **NEXT_PUBLIC_APP_ENV**: Exposed environment label for client-side code (normally derived from `APP_ENV`).
- **NEXT_PUBLIC_ADMIN_API_URL**: Base URL for any separate admin API, if used.
  - Default: `http://localhost:3002`
- **API_URL**: Internal URL where the NestJS API is accessible from Next.js API routes and NextAuth server code.
  - Dev: `API_URL=http://localhost:3000`
  - Prod: `API_URL=https://your-api-domain.railway.app`
  - Used by:
    - `apps/web/lib/auth.ts` (NextAuth → API)
    - `apps/web/app/api/*` proxy routes
- **API_BASE_URL** / **NEXT_PUBLIC_API_BASE**: Legacy/auxiliary base URLs used in `apps/web/app/auth/login/route.ts` (optional; can usually reuse `API_URL` / `NEXT_PUBLIC_API_URL`).

#### Frontend ESI / trading tweaks (optional)

These mirror backend defaults but are only used in specific UI helpers:

- **NEXT_PUBLIC_BROKER_FEE_PCT**: Broker fee percentage for UI tools (e.g., sell appraiser).
  - Default: `1.5`
- **NEXT_PUBLIC_BROKER_RELIST_PCT**: Relist fee percentage for UI tools.
  - Default: `0.3`

#### Shared helpers (packages/shared)

`packages/shared/src/env.ts` exposes:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_ADMIN_API_URL`
- `NEXT_PUBLIC_WEB_BASE_URL`
- `NEXTAUTH_URL`

These are already covered in the sections above.

---

### EVE SSO / Auth overview

The current implementation uses a **unified ESI SSO app** for the backend (`ESI_SSO_CLIENT_ID` / `ESI_SSO_CLIENT_SECRET`) plus NextAuth’s own app (`EVE_CLIENT_ID` / `EVE_CLIENT_SECRET`) for the initial login flow.

- **EVE_CLIENT_ID**: EVE SSO client ID for the NextAuth login provider (web).
- **EVE_CLIENT_SECRET**: EVE SSO client secret for the NextAuth login provider (web).

> Older envs like `EVE_CLIENT_ID_LINKING`, `EVE_CLIENT_SECRET_LINKING`, `EVE_CLIENT_ID_SYSTEM`, `EVE_CLIENT_SECRET_SYSTEM` are now considered **legacy**; the backend primarily uses the unified `ESI_SSO_CLIENT_ID` / `ESI_SSO_CLIENT_SECRET` plus the scope variables above. You can leave the legacy vars unset unless you rely on older flows.
