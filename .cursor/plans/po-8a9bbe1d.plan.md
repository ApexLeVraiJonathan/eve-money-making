<!-- 8a9bbe1d-8c29-4efc-83f7-01730748f07f 7f3b08cd-e02c-4b47-8a9b-db9dd4a16f85 -->
# POC Hardening: Auth, API Routes, URLs, Prisma

## Goals

- Make cookie session the primary backend auth with Bearer fallback.
- Remove remaining Next.js API proxy routes; call the API directly from hooks using NextAuth tokens.
- Fix API base URL inconsistencies and ensure cookies flow where applicable.
- Eliminate duplicate Prisma schema and unused deps.
- Light API hardening (security headers, rate limit), keep Swagger.

## 1) Backend auth consolidation

- Create `CompositeAuthGuard` that:
  - Tries existing encrypted-cookie session (current `AuthGuard` logic)
  - If absent/invalid, attempts `passport` Eve JWT (`EveJwtStrategy`) and sets `req.user`
- Register it as a global guard (APP_GUARD) in `apps/api/src/app.module.ts` (or a dedicated `auth.module.ts` imported by `AppModule`).
- Keep `RolesGuard` as-is and apply per-controller where admin-only access is needed.
- Add `@ApiBearerAuth()` to all protected controllers (many already have it).

Essential snippet (guard registration):

```12:24:apps/api/src/app.module.ts
import { APP_GUARD } from '@nestjs/core';
import { CompositeAuthGuard } from './characters/guards/composite-auth.guard';
...
@Module({
  ...,
  providers: [Logger, { provide: APP_GUARD, useClass: CompositeAuthGuard }],
})
```

## 2) API hardening & infra polish

- Add `helmet` and a small rate limit (e.g., 100/min IP) in `apps/api/src/main.ts`.
- Confirm `CORS` covers web origin(s) and includes `Authorization, Content-Type, Cookie` (already present).
- Keep `BigIntSerializationInterceptor`, `HttpExceptionFilter`, and `LoggingInterceptor`.

## 3) Remove duplicate Prisma and unused deps

- Delete `apps/api/prisma/schema.prisma` and rely solely on `packages/prisma/*`.
- In `apps/api/package.json`, remove `zod` (no runtime usage in source), keep `class-validator` & `@nestjs/swagger`.
- Ensure prisma scripts all point to `@eve/prisma` (already mostly done).

## 4) Normalize API base URL + cookie behavior

- In `packages/api-client/src/index.ts`:
  - Set `BASES.api` default to `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"` (no trailing /api, since Nest controllers are at root).
  - Include `credentials: 'include'` in `fetch` so session cookies (when present) are sent.
- In `packages/shared/src/env.ts` ensure naming matches (`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WEB_BASE_URL`).
- In `apps/web/next.config.ts`, expose `NEXT_PUBLIC_API_URL` consistently.

Essential snippet (client):

```60:92:packages/api-client/src/index.ts
const BASES: Record<AppId, string> = {
  api: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  'web-portal': process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  'web-admin': process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:3002',
};
...
const res = await fetch(url, { credentials: 'include', ... })
```

## 5) Frontend: remove proxy routes and use authed client from NextAuth

- Delete all `apps/web/app/api/auth/*` routes EXCEPT `app/api/auth/[...nextauth]/route.ts`.
- Introduce a tiny helper to get an authed client in client components using NextAuth:
  - `apps/web/app/api-hooks/useApiClient.ts`:
    - `useSession()` to read `session.accessToken`
    - `return clientForApp('api', session?.accessToken)`
- Update hooks (e.g., `apps/web/app/api-hooks/users.ts`, arbitrage hooks already OK) to use that authed client for protected endpoints.
- Replace `startCharacterLink()` to call backend directly from the browser with `fetch(..., { headers: { Authorization: Bearer <token> }, redirect: 'manual' })`, then `window.location.href = location`.
- Replace the admin system-character link URL route with a function that fetches it directly with Authorization.

Essential snippet (client helper):

```1:40:apps/web/app/api-hooks/useApiClient.ts
"use client";
import { useSession } from 'next-auth/react';
import { clientForApp } from '@eve/api-client';

export function useApiClient() {
  const { data } = useSession();
  return clientForApp('api', data?.accessToken as string | undefined);
}
```

And use it:

```20:33:apps/web/app/api-hooks/users.ts
const client = useApiClient();
```

Essential snippet (link flow without proxy):

```85:105:apps/web/app/api-hooks/users.ts
export async function startCharacterLink(returnUrl?: string) {
  const token = (await import('next-auth/react')).getSession().then(s => s?.accessToken);
  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/auth/link-character/start`);
  if (returnUrl) url.searchParams.set('returnUrl', returnUrl);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${await token}` }, redirect: 'manual' });
  const location = res.headers.get('location');
  if (location) window.location.href = location;
}
```

## 6) Controller response consistency (incremental)

- Where feasible, prefer returning DTOs over manual `@Res()` (keep redirects in auth flows).
- Throw Nest HTTP exceptions instead of manual `res.status(...).json()` in non-redirect paths.

## 7) Tooling & CI

- Root `package.json`:
  - Add real `lint` and `test` scripts that run across workspaces.
- Optional: add a minimal CI (install + build + lint + test) using GitHub Actions/Railway.

## 8) Documentation

- Update `env.example.md` to use `NEXT_PUBLIC_API_URL` and clarify cookie vs Bearer behavior.
- Add a short `README` section explaining the new auth model and how hooks acquire tokens.

### To-dos

- [ ] Add CompositeAuthGuard (cookie primary, Eve JWT fallback) and register as APP_GUARD
- [ ] Add helmet and basic rate limiting in apps/api/src/main.ts
- [ ] Remove apps/api/prisma; keep packages/prisma only; verify scripts
- [ ] Normalize @eve/api-client BASES.api to NEXT_PUBLIC_API_URL; add credentials: include
- [ ] Align env helpers and next.config.ts to expose NEXT_PUBLIC_API_URL
- [ ] Create useApiClient() using NextAuth session for Bearer token
- [ ] Update web hooks to use authed client and remove direct proxy dependencies
- [ ] Delete apps/web/app/api/auth/* except [...nextauth]/route.ts
- [ ] Make startCharacterLink fetch backend and redirect without proxy
- [ ] Incrementally replace manual res.status with DTO returns, keep redirects
- [ ] Add real workspace lint/test scripts and minimal CI
- [ ] Update env and auth docs to reflect new model