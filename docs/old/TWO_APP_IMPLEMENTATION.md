# Two EVE SSO App Implementation

## Overview

This implementation uses **two separate EVE SSO applications** to cleanly separate initial login from character linking flows, working around EVE SSO's single-callback-URL constraint.

## Why Two Apps?

EVE SSO applications only allow **ONE** callback URL per application. By using two apps, we get:

- ✅ Direct EVE SSO redirects (no intermediate pages)
- ✅ Clear separation of concerns (login vs linking)
- ✅ Simpler, more maintainable code
- ✅ Better user experience

## Architecture

### App 1: Initial Login (NextAuth)

- **Purpose**: User's first login, creates account
- **Handler**: NextAuth (Auth.js)
- **Callback**: `http://localhost:3001/api/auth/callback/eveonline`
- **Env Vars**: `EVE_CLIENT_ID`, `EVE_CLIENT_SECRET`
- **Flow**: NextAuth → EVE SSO → NextAuth callback → NestJS `/auth/link-character`

### App 2: Character Linking (NestJS)

- **Purpose**: Adding additional characters to existing account
- **Handler**: NestJS direct OAuth with database state
- **Callback**: `http://localhost:3000/auth/link-character/callback`
- **Env Vars**: `EVE_CLIENT_ID_LINKING`, `EVE_CLIENT_SECRET_LINKING`
- **Flow**: NestJS start → EVE SSO → NestJS callback → Links to existing user

## Required Configuration

### 1. Create Two EVE SSO Applications

Visit https://developers.eveonline.com and create:

#### App 1: Initial Login

- Name: `YourApp - Login`
- Callback URL: `http://localhost:3001/api/auth/callback/eveonline`
- Scopes: None (authentication only)

#### App 2: Character Linking

- Name: `YourApp - Character Linking`
- Callback URL: `http://localhost:3000/auth/link-character/callback`
- Scopes: None (or add if you need ESI access)

### 2. Environment Variables

Add to your `.env` files:

```bash
# App 1: Initial Login (NextAuth)
EVE_CLIENT_ID=your-app1-client-id
EVE_CLIENT_SECRET=your-app1-secret

# App 2: Character Linking (NestJS)
EVE_CLIENT_ID_LINKING=your-app2-client-id
EVE_CLIENT_SECRET_LINKING=your-app2-secret

# Other required vars
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-random-secret
API_URL=http://localhost:3000
ESI_SSO_SCOPES_USER=
```

## Implementation Details

### Initial Login Flow (App 1)

1. User clicks "Sign in with EVE" in sidebar
2. NextAuth redirects to EVE SSO (App 1)
3. User authorizes
4. EVE redirects to `/api/auth/callback/eveonline`
5. NextAuth JWT callback:
   - Stores access token in JWT session
   - Calls `POST /auth/link-character` on NestJS
   - NestJS creates User + links first character
6. User is logged in

**Files:**

- `apps/web/app/api/auth/[...nextauth]/route.ts` - NextAuth config
- `apps/web/components/sidebar/nav-user.tsx` - Sign in button

### Character Linking Flow (App 2)

1. User clicks "Link Character" on account settings (while logged in)
2. Frontend calls `/api/auth/link-character/start`
3. Next.js API route:
   - Gets user's session + access token
   - Calls NestJS `GET /auth/link-character/start` with Bearer token
   - NestJS stores OAuth state in database (with userId)
   - Returns EVE SSO URL (App 2)
   - Redirects browser to EVE SSO
4. User authorizes with a different EVE character
5. EVE redirects to `GET /auth/link-character/callback` (NestJS)
6. NestJS callback:
   - Validates OAuth state from database
   - Exchanges code for tokens (using App 2 credentials)
   - Links new character to existing user
   - Redirects back to account settings
7. User sees both characters listed

**Files:**

- `apps/web/app/api/auth/link-character/start/route.ts` - Frontend proxy
- `apps/api/src/auth/auth.controller.ts` - NestJS OAuth endpoints
- `apps/api/src/auth/auth.service.ts` - OAuth methods with App 2 credentials
- `apps/web/app/account-settings/page.tsx` - Link button UI

### Database Schema

**OAuthState** table for secure state management:

```prisma
model OAuthState {
  id           String    @id @default(uuid())
  state        String    @unique
  codeVerifier String
  userId       String?
  returnUrl    String?
  createdAt    DateTime  @default(now())
  expiresAt    DateTime
}
```

### Auth Service Methods

**For App 1 (existing):**

- `getAuthorizeUrl()` - Initial login OAuth URL
- `exchangeCodeForToken()` - Exchange code with App 1

**For App 2 (new):**

- `getAuthorizeLinkingUrl()` - Character linking OAuth URL
- `exchangeCodeForTokenLinking()` - Exchange code with App 2

## Security Features

1. **JWT Bearer validation**: All authenticated endpoints use EVE JWT validation
2. **Database-backed state**: OAuth state stored in database, not cookies
3. **Single-use state**: State deleted immediately after use
4. **State expiration**: 10-minute timeout
5. **User association**: Characters can only be linked to authenticated user
6. **Encrypted tokens**: Refresh tokens encrypted with AES-GCM

## Testing

### Initial Login

1. Go to `http://localhost:3001`
2. Click "Sign in with EVE"
3. Authorize with your first EVE character
4. You should be logged in and see your character in sidebar

### Character Linking

1. While logged in, go to `/account-settings`
2. Click "Link Character" button
3. You should be redirected DIRECTLY to EVE SSO (no intermediate page)
4. Authorize with a DIFFERENT EVE character
5. You should be redirected back to account settings
6. Both characters should appear in "Linked Characters" list
7. You should still be logged in as your primary character

## Cleanup

The following endpoint is no longer needed and can be removed:

- `POST /auth/link-additional-character` (from the single-callback attempt)

The background job for OAuth state cleanup should remain:

- `runOAuthStateCleanup()` in `jobs.service.ts` - cleans expired states hourly

## Port Configuration

- **NestJS API**: `http://localhost:3000`
- **Next.js Web**: `http://localhost:3001`

## Related Files

### Backend (NestJS)

- `apps/api/src/auth/auth.service.ts` - OAuth methods for both apps
- `apps/api/src/auth/auth.controller.ts` - Link endpoints
- `apps/api/prisma/schema.prisma` - OAuthState model
- `apps/api/src/jobs/jobs.service.ts` - Cleanup job

### Frontend (Next.js)

- `apps/web/app/api/auth/[...nextauth]/route.ts` - NextAuth config (App 1)
- `apps/web/app/api/auth/link-character/start/route.ts` - Link initiator
- `apps/web/app/account-settings/page.tsx` - UI
- `apps/web/components/sidebar/nav-user.tsx` - Sign in button

### Documentation

- `env.example.md` - Environment variables
- `CHARACTER_LINKING_IMPLEMENTATION.md` - Previous implementation (outdated)
- `TWO_APP_IMPLEMENTATION.md` - This document
