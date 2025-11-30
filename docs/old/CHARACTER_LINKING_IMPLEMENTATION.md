# Character Linking Implementation

## Overview

Implemented user-initiated character linking flow that allows authenticated users to link additional EVE Online characters to their account using a **single EVE SSO callback URL**.

## Key Constraint: Single Callback URL

EVE SSO applications only allow **ONE** callback URL. Therefore, all OAuth flows (initial login + character linking) go through the same NextAuth callback endpoint: `http://localhost:3001/api/auth/callback/eveonline`

## Implementation Details

### 1. Single Callback URL Strategy

**Problem**: Can't have separate callbacks for login vs. linking.

**Solution**: NextAuth callback detects if this is a linking flow by checking if the JWT already has a `characterId` that differs from the incoming character.

### 2. Backend Endpoints (`apps/api/src/auth/auth.controller.ts`)

#### `GET /auth/link-character/start`

- **Auth**: Requires valid EVE JWT Bearer token
- **Purpose**: Initiates character linking flow
- **Flow**:
  1. Validates user is authenticated via `@CurrentUser()` decorator
  2. Generates OAuth state and PKCE challenge
  3. Stores state, verifier, userId, and returnUrl in database
  4. Redirects to EVE SSO authorization URL

#### `GET /auth/link-character/callback`

- **Auth**: Public (no auth required - uses database state)
- **Purpose**: Handles OAuth callback from EVE SSO
- **Flow**:
  1. Retrieves and validates OAuth state from database
  2. Checks state expiration
  3. Deletes state (single-use)
  4. Exchanges authorization code for tokens
  5. Verifies token with EVE SSO
  6. Upserts character and token data
  7. Links character to user
  8. Redirects to returnUrl or shows success page

### 3. Frontend Integration (`apps/web/app/api/auth/link-character/start/route.ts`)

Next.js API route that bridges the gap between browser and NestJS:

**Flow**:

1. Gets user's NextAuth session
2. Extracts EVE access token
3. Makes server-side request to NestJS with Bearer token
4. Receives EVE SSO URL from NestJS
5. Redirects browser to EVE SSO

This approach works around the browser's inability to send Authorization headers during redirects.

### 5. Background Jobs

Not needed for character linking (NextAuth handles state management).

### 5. Environment Configuration (`env.example.md`)

Updated documentation to include:

- Required EVE SSO callback URLs (both NextAuth and character linking)
- `ESI_SSO_SCOPES_USER` for optional ESI scopes
- PowerShell command for generating `NEXTAUTH_SECRET`

**Required Callback URLs** in EVE Developer Portal:

- Initial login: `http://localhost:3001/api/auth/callback/eveonline`
- Character linking: `http://localhost:4000/auth/link-character/callback`

### 7. UI Enhancement (`apps/web/app/account-settings/page.tsx`)

Redesigned account settings page with:

- Clear visual hierarchy and card-based layout
- Character portraits from ESI Image Server
- Status badges (USER/ADMIN role, Primary character)
- Responsive design with mobile support
- Loading states and empty states
- Character management actions (Set Primary, Unlink)

## Security Features

1. **NextAuth state management**: OAuth state handled securely by NextAuth framework
2. **JWT validation**: All authenticated endpoints validate EVE JWT tokens via JWKS
3. **User association**: Characters can only be linked to authenticated user (validated via Bearer token)
4. **Session persistence**: User stays logged in as primary character during linking flow
5. **Encrypted tokens**: Refresh tokens encrypted using AES-GCM before storage

## User Flow

1. User logs in with their first EVE character

   - NextAuth creates session with that character
   - Backend creates User + links first character

2. User clicks "Link Character" on account settings
   - Redirects to `/api/auth/signin/eveonline`
   - EVE SSO authorization happens
3. EVE redirects to `/api/auth/callback/eveonline` (NextAuth)
   - NextAuth JWT callback detects this is a linking flow
   - Calls `/auth/link-additional-character` with EXISTING token
   - New character is linked to same user
   - User stays logged in as primary character
4. Account settings page refreshes and shows both characters

## Testing the Flow

1. Ensure both servers are running:

   - NestJS API: `http://localhost:4000`
   - Next.js Web: `http://localhost:3001`

2. Configure EVE SSO application with callback URLs (see Environment Configuration above)

3. Log in with EVE Online via NextAuth

4. Navigate to `/account-settings`

5. Click "Link Character" button

6. Authorize on EVE SSO

7. Verify character appears in "Linked Characters" list

## Notes & Future Work

### Existing Old Endpoints

The following endpoints still exist but use the old cookie-based session system:

- `GET /auth/login/user`
- `GET /auth/login/admin`
- `GET /auth/callback`

These may be useful for future SYSTEM character management but would need updates to work with the new JWT-based auth system.

### Admin System Characters

Not yet implemented (per plan):

- `POST /admin/system-characters/link/url` (ADMIN)
- `GET /admin/system-characters/callback` (ADMIN)

These would allow admins to link characters managed by the system (not tied to a user).

### ESI Token Refresh

The `EsiTokenService` is implemented but character token refresh for user-linked characters is not yet fully tested in production.

## Related Files

- `apps/web/app/api/auth/[...nextauth]/route.ts` - NextAuth config with flow detection
- `apps/api/src/auth/auth.controller.ts` - Link endpoints
- `apps/web/app/api/auth/link-character/start/route.ts` - Link initiation
- `apps/web/app/account-settings/page.tsx` - UI
- `env.example.md` - Configuration documentation

## Port Configuration

- NestJS API: `http://localhost:3000`
- Next.js Web: `http://localhost:3001`
