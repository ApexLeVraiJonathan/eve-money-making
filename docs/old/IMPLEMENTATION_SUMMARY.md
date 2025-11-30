# EVE SSO Multi-Character Authentication - Implementation Summary

## Completed Implementation

This document summarizes the authentication and authorization system refactor that transitions the application to use NextAuth (Auth.js) for user sign-in with EVE Online SSO, while NestJS handles EVE Bearer token validation, character linking, and token management.

## What Has Been Implemented

### 1. Database Schema Changes ✅

**File**: `apps/api/prisma/schema.prisma`

- Added `CharacterManagedBy` enum with `USER` and `SYSTEM` values
- Added to `EveCharacter` model:
  - `managedBy: CharacterManagedBy @default(USER)` - Distinguishes user vs system characters
  - `notes: String?` - Optional notes for character management
- Added to `CharacterToken` model:
  - `lastRefreshAt: DateTime?` - Timestamp of last successful token refresh
  - `refreshFailAt: DateTime?` - Timestamp of last failed refresh attempt
  - `refreshFailMsg: String?` - Error message from last failed refresh

**Migration**: `20251013020355_system_characters_and_token_health`

### 2. Environment Configuration ✅

**File**: `env.example.md`

Added documentation for:

- `EVE_CLIENT_ID` - EVE SSO application client ID
- `EVE_CLIENT_SECRET` - EVE SSO application client secret (secret)
- `NEXTAUTH_URL` - Public URL of Next.js application
- `NEXTAUTH_SECRET` - Secret for signing NextAuth session tokens
- `API_URL` - Internal URL where NestJS API is accessible from Next.js
- `JOB_SYSTEM_TOKENS_ENABLED` - Enable monthly SYSTEM character token refresh

### 3. Next.js Authentication (Auth.js) ✅

**Files Created**:

- `apps/web/app/api/auth/[...nextauth]/route.ts` - NextAuth configuration
- `apps/web/auth.ts` - Auth helper for server-side usage

**Features**:

- EVE Online OAuth provider configured
- JWT session strategy
- Access token and character info stored in session
- Ready for use in server components and API routes

**Dependencies Added**:

- `next-auth@4.24.11`

### 4. NestJS JWT Strategy & Guards ✅

**Files Created**:

- `apps/api/src/auth/jwt.strategy.ts` - Passport JWT strategy for EVE tokens
- `apps/api/src/auth/eve-auth.guard.ts` - Auth guard using passport
- `apps/api/src/auth/esi-token.service.ts` - Token refresh service

**Files Modified**:

- `apps/api/src/auth/auth.module.ts` - Registered strategy and services
- `apps/api/src/auth/current-user.decorator.ts` - Updated RequestUser type
- `apps/api/src/auth/roles.guard.ts` - Updated to use passport user from req.user
- `apps/api/src/main.ts` - Enabled CORS with Authorization header

**Features**:

- Validates EVE Bearer tokens using CCP's JWKS endpoint
- Automatically looks up character in DB to get user association
- Detects owner hash changes and revokes tokens
- Sets req.user with full context (userId, role, characterId, etc.)
- Public routes marked with `@Public()` decorator skip auth

**Dependencies Added**:

- `@nestjs/passport@11.0.5`
- `passport@0.7.0`
- `passport-jwt@4.0.1`
- `jwks-rsa@3.2.0`
- `@types/passport-jwt@4.0.1` (dev)

### 5. ESI Token Refresh Service ✅

**File**: `apps/api/src/auth/esi-token.service.ts`

**Features**:

- `getAccessToken(characterId)` - Returns valid access token, refreshing if needed
- `checkOwnerHashAndRevoke(characterId, currentOwnerHash)` - Validates owner hash
- Automatically updates token health fields (`lastRefreshAt`, `refreshFailAt`, `refreshFailMsg`)
- Handles token rotation when CCP provides new refresh tokens
- Comprehensive error logging and tracking

### 6. API Endpoints ✅

**File**: `apps/api/src/auth/auth.controller.ts`

**Updated Endpoints**:

- `GET /auth/me` - Returns current user from validated EVE Bearer token
  - Now uses `@CurrentUser()` decorator
  - Returns: `{ userId, characterId, characterName, role, primaryCharacterId }`

**New Admin Endpoints**:

- `GET /admin/characters/:id/token/status` - View token health/metadata
- `DELETE /admin/characters/:id/token` - Manually revoke a character's token

**Existing Endpoints** (maintained for backward compatibility):

- `GET /auth/characters` - List all linked characters (ADMIN)
- `POST /auth/refresh` - Force token refresh (ADMIN)
- Character linking and management endpoints

### 7. Background Jobs ✅

**Files Modified**:

- `apps/api/src/jobs/jobs.module.ts` - Added AuthModule import
- `apps/api/src/jobs/jobs.service.ts` - Added token refresh job

**New Job**:

- `refreshSystemCharacterTokens()` - Runs monthly (1st @ 2 AM)
  - Refreshes all `managedBy=SYSTEM` character tokens
  - Logs success/failure for each character
  - Controlled by `JOB_SYSTEM_TOKENS_ENABLED` flag

### 8. CORS Configuration ✅

**File**: `apps/api/src/main.ts`

**Configuration**:

- Allows Next.js origins (localhost:3000, localhost:3001, NEXTAUTH_URL)
- Allows `Authorization` header for Bearer tokens
- Enables credentials and standard HTTP methods

## How It Works

### User Authentication Flow

1. User clicks "Sign in with EVE Online" in Next.js app
2. NextAuth redirects to EVE SSO OAuth flow
3. EVE redirects back with authorization code
4. NextAuth exchanges code for access token
5. NextAuth stores access token in JWT session
6. Next.js makes API calls with `Authorization: Bearer <eve_access_token>`

### API Request Flow

1. Request hits NestJS with `Authorization: Bearer <token>` header
2. `EveAuthGuard` (using `EveJwtStrategy`) validates token against CCP's JWKS
3. Strategy decodes token to get character ID and owner hash
4. Strategy looks up character in DB to get user association
5. Strategy checks owner hash; revokes if changed
6. Strategy sets `req.user` with full context
7. `RolesGuard` checks user role if route requires specific role (e.g., `@Roles('ADMIN')`)
8. Request proceeds to controller with `@CurrentUser()` decorator available

### Token Refresh Flow

1. Before ESI calls, code calls `esiTokenService.getAccessToken(characterId)`
2. Service checks if current access token is valid (> 60s remaining)
3. If expired, service uses refresh token to get new access token from CCP
4. Service updates DB with new tokens and health fields
5. Service returns valid access token for ESI call

### Owner Hash Change Detection

1. JWT validation or token refresh receives new owner hash from CCP
2. Service compares with stored `EveCharacter.ownerHash`
3. If different, token is revoked and marked with `refreshFailMsg = "owner_hash_changed"`
4. User must re-link character to continue

## What Still Needs to be Done

### 1. Character Linking Endpoints

The existing endpoints need updating to work with the new auth:

- Keep `/auth/link-character/start` and `/auth/link-character/callback`
- Update callback to identify current user from EVE Bearer token (not cookie)
- Add admin endpoints for linking SYSTEM characters

### 2. Frontend Updates

- Remove old cookie-based login flows
- Update API calls to forward NextAuth session token as Bearer header
- Update character management UI to use new endpoints
- Add UI for viewing token health status

### 3. Tests

Write E2E tests for:

- Unauthenticated request → 401
- Valid EVE Bearer token → 200
- Character linking flow
- Token refresh updates health fields
- Owner hash change revokes token

### 4. Migration Strategy

Plan for transitioning existing users:

- Existing cookie-based sessions should be phased out
- Users will need to sign in again with NextAuth
- Existing character tokens in DB will continue to work
- Consider adding a banner prompting users to re-authenticate

## Security Considerations

✅ **Implemented**:

- Refresh tokens encrypted with `CryptoUtil` (AES-GCM)
- JWTs validated against CCP's official JWKS endpoint
- Owner hash changes detected and tokens revoked
- HTTPS required for production (via sameSite/secure cookies)
- CORS restricted to known Next.js origins
- Admin endpoints protected by role guard

⚠️ **Recommended**:

- Store `EVE_CLIENT_SECRET` in secret manager (not .env)
- Rotate client secret if compromised
- Monitor `refreshFailAt` for unusual patterns
- Set up alerts for repeated token refresh failures
- Consider rate limiting on auth endpoints

## Configuration Checklist

Before deploying, ensure these environment variables are set:

### Required

- ✅ `EVE_CLIENT_ID`
- ✅ `EVE_CLIENT_SECRET` (in secret manager)
- ✅ `NEXTAUTH_URL`
- ✅ `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
- ✅ `API_URL`
- ✅ `ENCRYPTION_KEY` (for token encryption)

### Optional (defaults exist)

- `JOB_SYSTEM_TOKENS_ENABLED` (default: true)
- `ENABLE_JOBS` (default: true in production)

## Architecture Benefits

1. **Separation of Concerns**: NextAuth handles user sign-in; NestJS handles API auth
2. **Stateless API**: No session cookies; JWT Bearer tokens only
3. **Multi-Character Support**: Users can link multiple EVE characters
4. **System Characters**: Backend can manage characters not tied to users
5. **Token Health**: Visibility into refresh failures and owner changes
6. **Scalability**: JWT validation is fast and doesn't require DB lookup per request (only character association)
7. **Security**: Owner hash validation prevents token hijacking

## Next Steps

1. Update character linking endpoints for new auth
2. Update Next.js API routes to forward Bearer tokens
3. Update frontend UI for new auth flow
4. Write E2E tests
5. Create migration guide for existing users
6. Deploy and monitor token refresh failures

## Files Modified/Created Summary

### Created

- `apps/api/src/auth/jwt.strategy.ts`
- `apps/api/src/auth/eve-auth.guard.ts`
- `apps/api/src/auth/esi-token.service.ts`
- `apps/web/app/api/auth/[...nextauth]/route.ts`
- `apps/web/auth.ts`
- `apps/api/prisma/migrations/20251013020355_system_characters_and_token_health/`

### Modified

- `apps/api/prisma/schema.prisma`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/current-user.decorator.ts`
- `apps/api/src/auth/roles.guard.ts`
- `apps/api/src/main.ts`
- `apps/api/src/jobs/jobs.module.ts`
- `apps/api/src/jobs/jobs.service.ts`
- `env.example.md`
- `apps/web/package.json`
- `apps/api/package.json`

## Dependencies Added

### Next.js

- `next-auth@4.24.11`

### NestJS

- `@nestjs/passport@11.0.5`
- `passport@0.7.0`
- `passport-jwt@4.0.1`
- `jwks-rsa@3.2.0`
- `@types/passport-jwt@4.0.1` (dev)
