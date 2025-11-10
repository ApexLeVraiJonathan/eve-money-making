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

**Three EVE SSO Applications Required:**

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

#### App 3: Admin System Characters (NestJS)

- EVE_CLIENT_ID_SYSTEM: Your THIRD EVE SSO application client ID for admin linking of system characters
  - Example: `EVE_CLIENT_ID_SYSTEM=jkl456mno789`
  - Callback URL: `http://localhost:3000/auth/admin/system-characters/callback`
- EVE_CLIENT_SECRET_SYSTEM: Your THIRD EVE SSO application client secret
  - Example: `EVE_CLIENT_SECRET_SYSTEM=your-system-secret-here`
- ESI_SSO_SCOPES_SYSTEM: Comma-separated list of ESI scopes for system characters
  - Example: `ESI_SSO_SCOPES_SYSTEM=esi-wallet.read_character_wallet.v1,esi-assets.read_assets.v1,esi-markets.read_character_orders.v1`
  - These scopes must be enabled in your App 3 EVE SSO application

#### NextAuth Configuration

- NEXTAUTH_URL: Public URL of your Next.js application
  - Dev: `NEXTAUTH_URL=http://localhost:3001`
  - Prod: `NEXTAUTH_URL=https://yourdomain.com`
- NEXTAUTH_SECRET: Secret for signing NextAuth session tokens
  - Generate with: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))` (PowerShell)
  - Example: `NEXTAUTH_SECRET=your-random-secret-here`

#### NestJS API Integration

- API_URL: Internal URL where NestJS API is accessible from Next.js server-side components
  - Dev: `API_URL=http://localhost:3000`
  - Prod: `API_URL=https://your-api-domain.railway.app`
  - **Note**: Do NOT include `/api` suffix - the backend routes handle the path
  - Used by server-side Next.js code to call the NestJS backend
- NEXT_PUBLIC_API_URL: Public URL of your NestJS API (used by browser clients)
  - Dev: `NEXT_PUBLIC_API_URL=http://localhost:3000`
  - Prod: `NEXT_PUBLIC_API_URL=https://your-api-domain.railway.app`
  - **Critical**: This must be accessible from the user's browser
  - **Note**: Do NOT include `/api` suffix
  - **Important**: This must match the callback URLs registered in your EVE SSO applications:
    - App 2 uses: `{NEXT_PUBLIC_API_URL}/auth/link-character/callback`
    - App 3 uses: `{NEXT_PUBLIC_API_URL}/auth/admin/system-characters/callback`
- NEXT_PUBLIC_WEB_BASE_URL: Public URL of your Next.js web application
  - Dev: `NEXT_PUBLIC_WEB_BASE_URL=http://localhost:3001`
  - Prod: `NEXT_PUBLIC_WEB_BASE_URL=https://yourdomain.com`
- ESI_SSO_SCOPES_USER: Comma-separated list of ESI scopes for user characters (optional, can be empty for auth-only)
  - Example: `ESI_SSO_SCOPES_USER=` (empty for authentication only)
  - With scopes: `ESI_SSO_SCOPES_USER=esi-wallet.read_character_wallet.v1,esi-assets.read_assets.v1`

**Authentication Model:**

The application uses a **dual authentication strategy**:

1. **Cookie-based sessions (primary)**: After logging in via NextAuth, users get an encrypted session cookie that's automatically sent with all requests (`credentials: 'include'`). This is the default authentication method.

2. **Bearer tokens (fallback)**: The API also accepts `Authorization: Bearer <token>` headers for programmatic access or when cookies are unavailable. NextAuth provides access tokens that can be used for server-side API calls.

The backend's `CompositeAuthGuard` tries cookie-based auth first, then falls back to Bearer token validation. This provides flexibility while maintaining security.

### Jobs (optional toggles)

- ENABLE_JOBS: Enable all cron jobs (default true in production). `true|false|1|0|yes|no`.
  - `ENABLE_JOBS=true`
- JOB_CLEANUP_ENABLED: Enable hourly ESI cache cleanup (default true).
- JOB_DAILY_IMPORTS_ENABLED: Enable daily market backfill check (default true).
- JOB_WALLETS_ENABLED: Enable hourly wallet import + reconciliation (default true).
- JOB_CAPITAL_ENABLED: Enable hourly capital recompute for open cycles (default true).
- JOB_SYSTEM_TOKENS_ENABLED: Enable monthly refresh of SYSTEM character tokens (default true).

### Cycle Accounting

- DEFAULT_SALES_TAX_PCT: Sales tax percentage (default 3.37).
  - `DEFAULT_SALES_TAX_PCT=3.37`
- DEFAULT_BROKER_FEE_PCT: Broker fee percentage (default 1.5).
  - `DEFAULT_BROKER_FEE_PCT=1.5`
- DEFAULT_RELIST_FEE_PCT: Relist fee percentage (default 0.3).
  - `DEFAULT_RELIST_FEE_PCT=0.3`
- WALLET_RESERVE_PER_CHAR: ISK to reserve per character when calculating available capital (default 100000000 = 100M ISK).
  - `WALLET_RESERVE_PER_CHAR=100000000`
