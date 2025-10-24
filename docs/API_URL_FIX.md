# API_URL Environment Variable Fix

## Issue

The arbitrage planning functionality (and other API proxies) was not working in production because Next.js API routes were incorrectly using `NEXT_PUBLIC_API_URL` instead of `API_URL`.

### Symptoms

- Dev environment: Arbitrage planning works fine
- Production: Arbitrage planning fails silently or returns errors
- The issue affects any Next.js API route that proxies to the NestJS backend

## Root Cause

Next.js API routes are **server-side** code, but many were configured to use `NEXT_PUBLIC_API_URL`, which is a **client-side** environment variable. In production deployments (like Railway), `NEXT_PUBLIC_API_URL` is typically not set for the web app because:

1. It's meant for client-side code (browser)
2. Server-side code should use `API_URL` to communicate with the backend internally

When `NEXT_PUBLIC_API_URL` is not set, these routes fall back to `http://localhost:3000`, which doesn't work in production.

## Solution

Changed all Next.js API proxy routes to use `API_URL` instead of `NEXT_PUBLIC_API_URL`:

```typescript
// ❌ WRONG (client-side env var in server-side code)
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// ✅ CORRECT (server-side env var in server-side code)
const API_URL = process.env.API_URL ?? "http://localhost:3000";
```

## Fixed Files

The following API route files were updated:

1. `apps/web/app/api/plan-packages/route.ts` - **Main culprit for arbitrage planning**
2. `apps/web/app/api/wallet/import-all/route.ts`
3. `apps/web/app/api/ledger/participations/match/route.ts`
4. `apps/web/app/api/ledger/participations/all/route.ts`
5. `apps/web/app/api/ledger/participations/[id]/mark-payout-sent/route.ts`
6. `apps/web/app/api/ledger/participations/unmatched-donations/route.ts`
7. `apps/web/app/api/admin/users/[id]/characters/[characterId]/route.ts`
8. `apps/web/app/api/admin/users/route.ts`
9. `apps/web/app/api/wallet-import/transactions/route.ts`
10. `apps/web/app/api/recon/commits/[id]/status/route.ts`
11. `apps/web/app/api/arbitrage/commits/route.ts`
12. `apps/web/app/api/arbitrage/commit/route.ts`
13. `apps/web/app/api/ledger/participations/[id]/validate/route.ts`
14. `apps/web/app/api/ledger/participations/[id]/refund/route.ts`
15. `apps/web/app/api/ledger/participations/[id]/opt-out/route.ts`
16. `apps/web/app/api/ledger/cycles/[id]/participations/me/route.ts`

## Deployment Requirements

For production deployments, ensure **both** web and API services have the correct environment variables:

### Web App (Next.js) Service

```bash
API_URL=https://your-api-domain.railway.app
NEXTAUTH_URL=https://your-web-domain.railway.app
NEXTAUTH_SECRET=your-secret-here
EVE_CLIENT_ID=your-app1-client-id
EVE_CLIENT_SECRET=your-app1-client-secret
```

### API (NestJS) Service

```bash
API_BASE_URL=https://your-api-domain.railway.app
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=your-encryption-key
EVE_CLIENT_ID_LINKING=your-app2-client-id
EVE_CLIENT_SECRET_LINKING=your-app2-client-secret
EVE_CLIENT_ID_SYSTEM=your-app3-client-id
EVE_CLIENT_SECRET_SYSTEM=your-app3-client-secret
# ... other API env vars
```

## Key Takeaway

- **`API_URL`**: Server-side only, used by Next.js to communicate with NestJS backend
- **`NEXT_PUBLIC_API_URL`**: Client-side only, used by browser JavaScript (not needed if all API calls go through Next.js routes)
- **`API_BASE_URL`**: Used by NestJS for OAuth redirect URIs

Always use the correct environment variable for the context (server vs client).

