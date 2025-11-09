<!-- b0ca0b88-ebd2-45f5-bf58-c04b85ac104f 70da761c-abdb-4e38-9a25-754e50b1d5e1 -->
# POC → Production Polish Plan (Track A & Track B)

## Goals

- Align with monorepo rules, NestJS/Next.js best practices, and your two prior plans.
- Track A: Minimal, high‑impact hardening to stabilize the POC.
- Track B: Production polish (testing, DX, UI structure, CI/CD, and security).

---

## Track A — Minimal Hardening (1–2 days)

### A1) Consolidate backend auth and register globally

- Create `apps/api/src/characters/guards/composite-auth.guard.ts` that:
  - Tries encrypted cookie session (current `AuthGuard`)
  - Falls back to `EveAuthGuard` (passport JWT) on miss
- Register as global guard in `apps/api/src/app.module.ts`.

Essential registration:

```12:24:apps/api/src/app.module.ts
import { APP_GUARD } from '@nestjs/core';
import { CompositeAuthGuard } from './characters/guards/composite-auth.guard';

@Module({
  // ...
  providers: [Logger, { provide: APP_GUARD, useClass: CompositeAuthGuard }],
})
```

### A2) Security middleware

- Add `helmet()` in `apps/api/src/main.ts`.
- Add simple rate limiting (e.g., `@nestjs/throttler`: 100 req/minute per IP) for public endpoints.

### A3) Prisma consolidation

- Delete duplicate schema at `apps/api/prisma/schema.prisma`; keep only `packages/prisma/*`.

### A4) API client + env normalization

- In `packages/api-client/src/index.ts`:
  - Set base to `NEXT_PUBLIC_API_URL` without trailing `/api`:
    - `api: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'`
  - Send cookies when present: add `credentials: 'include'` to `fetch` options.

Essential tweak:

```83:92:packages/api-client/src/index.ts
const res = await fetch(url, {
  method,
  headers,
  credentials: 'include',
  body: body ? JSON.stringify(body) : undefined,
  ...fetchOpts,
});
```

- In `apps/web/next.config.ts`, expose `NEXT_PUBLIC_API_URL` (and `NEXT_PUBLIC_WEB_BASE_URL` if needed).
- In `packages/shared/src/env.ts`, use `NEXT_PUBLIC_API_URL` consistently (rename any `*_BASE_URL`).

### A5) Frontend client helper + proxy removal

- Add `apps/web/app/api-hooks/useApiClient.ts`:
```1:20:apps/web/app/api-hooks/useApiClient.ts
"use client";
import { useSession } from 'next-auth/react';
import { clientForApp } from '@eve/api-client';

export function useApiClient() {
  const { data } = useSession();
  return clientForApp('api', data?.accessToken as string | undefined);
}
```

- Migrate remaining calls to use this helper.
- Remove redundant `apps/web/app/api/auth/*` proxy routes once flows are migrated; keep only `app/api/auth/[...nextauth]/route.ts`.

### A6) Docs

- Update `env.example.md` and READMEs to reflect `NEXT_PUBLIC_API_URL`, cookie vs Bearer behavior, and new client usage.

---

## Track B — Production Polish (1–2 weeks)

### B1) Complete API hooks and admin migrations

- Finish remaining hooks for admin/ops flows and migrate any direct `fetch` usage to hooks.
- Create `apps/web/app/arbitrage/admin/_components/admin-layout.tsx` and extract large pages into subcomponents for SRP.
- Add a reusable `DataTable` to `packages/ui/src/data-table.tsx` (sorting, pagination, skeleton, empty state).

### B2) Testing foundation

- Backend: add unit tests for critical services (profit, participation, payout, arbitrage, allocation).
- Frontend: set up Vitest + RTL + MSW with test utils; write tests for critical hooks/pages.
- E2E: extend scenarios for cycle lifecycle, arbitrage→packages→commit, character linking→wallet→allocation.

### B3) Error handling & DX

- Standardize error shape (e.g., `ApiError`) and ensure global filter returns it consistently.
- Enhance request logging with timing and user id; mask sensitive fields.
- Add React Query DevTools in `apps/web/components/query-provider.tsx` (dev only).

### B4) DB performance and logging

- Add composite indexes for hot paths (wallet transactions, cycle lines, participations) in `packages/prisma/schema.prisma` and generate a migration.
- Add slow query logging (>500ms) via `PrismaService.$on('query', ...)` in dev.

### B5) CI/CD & automation

- Root scripts: lint, type-check, test, build across workspaces.
- GitHub Actions: install + build + lint + tests on PRs and main.
- Pre-commit: husky + lint-staged.

### B6) Security

- Add startup env validation (required keys) and audit guards on sensitive endpoints.

---

## Acceptance criteria

- Track A
  - Global composite auth works (cookie or Bearer) and controllers remain protected.
  - Security headers present; rate limiting active for public routes.
  - Single Prisma schema in `packages/prisma`; migrations work.
  - API client uses `NEXT_PUBLIC_API_URL`, includes cookies; web envs consistent.
  - Frontend uses `useApiClient`; auth proxies removed (except `[...nextauth]`).
- Track B
  - Hooks cover admin flows; large pages decomposed; shared DataTable in use.
  - Tests in place for critical flows; CI runs build/lint/tests.
  - DB indexes added and slow queries logged in dev.
  - Consistent error responses; improved request logging.

---

## Notes

- Keep `@ApiBearerAuth()` on protected controllers.
- Prefer DTOs and `ValidationPipe` already in place; keep redirects in auth flows.
- Document any endpoint response shape updates in Swagger.

### To-dos

- [ ] Add CompositeAuthGuard and register as APP_GUARD
- [ ] Add helmet and rate limiting in API main and module
- [ ] Remove apps/api/prisma and verify Prisma package
- [ ] Normalize API client base to NEXT_PUBLIC_API_URL
- [ ] Add credentials: include to client fetch
- [ ] Align env helpers and next.config.ts variables
- [ ] Create useApiClient() and update web hooks
- [ ] Delete redundant web auth API routes (keep nextauth)
- [ ] Update env and auth docs for new model
- [ ] Create remaining API hooks for admin/ops flows
- [ ] Create AdminPageLayout and extract large pages
- [ ] Add reusable DataTable in packages/ui
- [ ] Add unit tests for critical backend services
- [ ] Setup Vitest+RTL+MSW and write hook/page tests
- [ ] Extend e2e scenarios for critical paths
- [ ] Add missing DB indexes and migration
- [ ] Add slow query logging in PrismaService (dev)
- [ ] Standardize ApiError and global filter
- [ ] Enhance request logging with timing and userId
- [ ] Add React Query DevTools in QueryProvider
- [ ] Add root lint/type-check/test/build scripts
- [ ] Create GitHub Actions CI workflow
- [ ] Setup husky and lint-staged pre-commit
- [ ] Add startup environment validation
- [ ] Audit API endpoints for proper guards