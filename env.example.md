## Environment variables

Copy this file to `.env` and fill in the values you need. Only the required ones are necessary to start; the optional ones have sensible defaults in code.

### Required

- ESI_USER_AGENT: User-Agent string sent to EVE ESI per best practices.
  - Recommended format: `AppName/1.0.0 (contact@example.com; +https://github.com/you/repo)`
  - Example:
    - `ESI_USER_AGENT=EveMoneyMaker/0.1.0 (you@example.com; +https://github.com/you/eve-money-making)`

### Optional (ESI client)

- ESI_BASE_URL: Base URL for ESI. Default: `https://esi.evetech.net`
  - `ESI_BASE_URL=https://esi.evetech.net`
- ESI_TIMEOUT_MS: Per-request timeout in milliseconds. Default: `15000`
  - `ESI_TIMEOUT_MS=15000`
- ESI_MAX_CONCURRENCY: Max number of concurrent ESI calls. Default: `4`
  - `ESI_MAX_CONCURRENCY=4`
- ESI_ERROR_SLOWDOWN_REMAIN_THRESHOLD: Slow down when error budget remain is at/below this number. Default: `5`
  - `ESI_ERROR_SLOWDOWN_REMAIN_THRESHOLD=5`
- ESI_ERROR_SLOWDOWN_DELAY_MS: Delay in ms when slowing down. Default: `500`
  - `ESI_ERROR_SLOWDOWN_DELAY_MS=500`

### Database

- DATABASE_URL: Prisma connection string to your Postgres database.
  - Example:
    - `DATABASE_URL=postgresql://user:password@localhost:5432/eve_money?schema=public`

#### Dev/Test presets (Docker Compose dev DB)

- DATABASE_URL_DEV: Prisma URL for local dev DB on port 5433.
  - `DATABASE_URL_DEV=postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public`
- DATABASE_URL_TEST: Prisma URL base for tests. We will append per-worker schemas.
  - `DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/eve_money_test?schema=public`

### API server

- PORT: Port for the API application. Default: `3000`
  - `PORT=3000`

Notes:

- ESI best practices: include a real contact in your User-Agent to help CCP identify and reach you if needed.
  - `AppName/semver (contact; +source-url)` is a good pattern.

### Security

- ENCRYPTION_KEY: Secret used to derive the AES-GCM key for token encryption.
  - Example:
    - `ENCRYPTION_KEY=please-use-a-long-random-secret`

### ESI (Dev/Test)

- ESI_CLIENT_ID_DEV: Dev ESI client id
- ESI_CLIENT_SECRET_DEV: Dev ESI client secret
- ESI_REDIRECT_URI_DEV: Dev redirect URI (e.g., `http://localhost:3000/api/auth/callback`)
- ESI_SSO_SCOPES_USER: Minimal scopes for end users (often empty)
- ESI_SSO_SCOPES_ADMIN: Full admin scopes for trading characters

Notes:

- In tests, ESI calls are mocked unless explicitly opted to hit dev credentials.

### NextAuth (Auth.js) & EVE SSO

**Two EVE SSO Applications Required:**

#### App 1: Initial Login (NextAuth)

- EVE_CLIENT_ID: Your EVE SSO application client ID for initial login
  - Example: `EVE_CLIENT_ID=abc123def456`
  - Callback URL: `http://localhost:3001/api/auth/callback/eveonline`
- EVE_CLIENT_SECRET: Your EVE SSO application client secret
  - Example: `EVE_CLIENT_SECRET=your-secret-here`

#### App 2: Character Linking (NestJS)

- EVE_CLIENT_ID_LINKING: Your SECOND EVE SSO application client ID for linking additional characters
  - Example: `EVE_CLIENT_ID_LINKING=xyz789ghi012`
  - Callback URL: `http://localhost:3000/auth/link-character/callback`
- EVE_CLIENT_SECRET_LINKING: Your SECOND EVE SSO application client secret
  - Example: `EVE_CLIENT_SECRET_LINKING=your-linking-secret-here`

#### NextAuth Configuration

- NEXTAUTH_URL: Public URL of your Next.js application
  - Dev: `NEXTAUTH_URL=http://localhost:3001`
  - Prod: `NEXTAUTH_URL=https://yourdomain.com`
- NEXTAUTH_SECRET: Secret for signing NextAuth session tokens
  - Generate with: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))` (PowerShell)
  - Example: `NEXTAUTH_SECRET=your-random-secret-here`

#### NestJS API Integration

- API_URL: Internal URL where NestJS API is accessible from Next.js
  - Dev: `API_URL=http://localhost:3000`
  - Prod: `API_URL=http://api:3000` (or your internal service URL)
- ESI_SSO_SCOPES_USER: Comma-separated list of ESI scopes for user characters (optional, can be empty for auth-only)
  - Example: `ESI_SSO_SCOPES_USER=` (empty for authentication only)
  - With scopes: `ESI_SSO_SCOPES_USER=esi-wallet.read_character_wallet.v1,esi-assets.read_assets.v1`

### Jobs (optional toggles)

- ENABLE_JOBS: Enable all cron jobs (default true in production). `true|false|1|0|yes|no`.
  - `ENABLE_JOBS=true`
- JOB_CLEANUP_ENABLED: Enable hourly ESI cache cleanup (default true).
- JOB_DAILY_IMPORTS_ENABLED: Enable daily market backfill check (default true).
- JOB_WALLETS_ENABLED: Enable hourly wallet import + reconciliation (default true).
- JOB_CAPITAL_ENABLED: Enable hourly capital recompute for open cycles (default true).
- JOB_SYSTEM_TOKENS_ENABLED: Enable monthly refresh of SYSTEM character tokens (default true).
