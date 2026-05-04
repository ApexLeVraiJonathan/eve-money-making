# EVE Money Making

EVE Money Making is a small monorepo for EVE Online operations: Tradecraft investing and market tooling, character/account management, brokerage consignments, Discord notifications, and admin workflows around cycles, pricing, and market data.

## Stack

- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`)
- **API:** NestJS 11, Prisma 7, PostgreSQL, Swagger/OpenAPI, class-validator
- **Web:** Next.js 15 App Router, React 19, TanStack Query, Tailwind, `@eve/ui`
- **Shared packages:** `@eve/shared`, `@eve/api-client`, `@eve/prisma`, `@eve/ui`, `@eve/eve-core`, `@eve/eve-esi`, `@eve/api-contracts`

## Repository Layout

```text
apps/
  api/      NestJS backend API
  web/      Next.js web app and BFF route handlers
  e2e/      Playwright/API smoke tests
packages/
  api-client/     HTTP client and query keys
  api-contracts/  Runtime-schema/tooling placeholder, not app TS contracts
  eve-core/       Pure EVE/domain helpers
  eve-esi/        EVE ESI helpers
  prisma/         Prisma schema, migrations, generated client
  shared/         Cross-app request/response types and pure utilities
  ui/             Shared shadcn/Radix UI components
docs/
  README.md                  Documentation index
  RULES_COMPLIANCE_AUDIT.md  Active rule-refactor backlog
  old/                       Archived historical notes
```

## Architecture Notes

The browser calls Next route handlers under `apps/web/app/api/*`; those handlers proxy to the Nest API with server-only backend URLs. Shared request/response contracts used by both apps live in `packages/shared` and are imported through explicit subpath exports such as `@eve/shared/tradecraft-cycles`.

`packages/api-contracts` is intentionally reserved for future runtime contract artifacts. Do not add app-level TypeScript request/response contracts there.

## Setup

Prerequisites:

- Node.js 20+
- pnpm 10+
- PostgreSQL, usually via Docker
- EVE Online developer application credentials

Install dependencies and generate Prisma client:

```bash
pnpm install
pnpm db:generate
```

For environment variables, see [`env.example.md`](env.example.md). Local database helpers are available from the root scripts:

```bash
pnpm db:up
pnpm db:migrate:dev
```

Development servers are usually run in separate terminals:

```bash
pnpm dev:api
pnpm dev:web
```

## Common Commands

```bash
pnpm build
pnpm type-check
pnpm lint
pnpm test
pnpm test:api
pnpm test:web
```

## Feature Areas

- **Tradecraft:** cycle participation, capital accounting, payments, rollovers, JingleYield, arbitrage planning, packages, liquidity, self/NPC market collection, and pricing.
- **Characters:** EVE SSO login/linking, account grouping, token health, skill queues, skill browser, boosters, PLEX/MCT tracking, and Discord reminders.
- **Brokerage:** consignment workflows and reporting.
- **Support and notifications:** Discord account linking, support/feedback webhooks, notification preferences, and scheduled reminders.

## Documentation

Start with [`docs/README.md`](docs/README.md). The active rule-driven refactor tracker is [`docs/RULES_COMPLIANCE_AUDIT.md`](docs/RULES_COMPLIANCE_AUDIT.md). Historical phase docs live under [`docs/old`](docs/old) and should be treated as archive/reference material, not current architecture.

## Development Conventions

- Keep API code feature-first: controller, service, module, and DTOs stay near the feature they serve.
- Keep `page.tsx` files small and composition-only. Route-specific UI belongs in `app/<route>/_components/*`.
- Use `packages/shared` for cross-app contracts, with package subpath exports. Avoid deep source imports and barrel files unless explicitly approved.
- Keep Prisma schema and migrations in `packages/prisma`; do not edit applied migrations.
- Keep changes small and update docs/Notion when a meaningful refactor slice lands.
