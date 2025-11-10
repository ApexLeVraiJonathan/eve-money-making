# Authentication & Authorization Architecture

## Overview

This application uses **NextAuth with EVE SSO** for authentication and **Bearer token-based** API authorization.

---

## 🔐 Authentication Flow (Complete)

### Step 1: Initial Login (EVE SSO via NextAuth)

```
User → Frontend → EVE SSO → Frontend → Backend
```

1. **User clicks "Sign in with EVE"**
   - Component calls: `signIn("eveonline")`
   - Location: `apps/web/components/sidebar/nav-user.tsx`

2. **NextAuth redirects to EVE SSO**
   - Provider: `EVEOnlineProvider` (App 1 - authentication only, no scopes)
   - Config: `apps/web/lib/auth.ts`
   - Callback URL: `http://localhost:3001/api/auth/callback/eveonline`

3. **User authorizes on EVE**
   - EVE returns: `code` → NextAuth exchanges for `access_token` + `refresh_token`

4. **NextAuth callback processes tokens**
   - Location: `apps/web/lib/auth.ts` → `jwt()` callback
   - Actions:
     - Stores `access_token` in NextAuth session (JWT cookie)
     - Calls backend: `POST /auth/link-character`
     - Backend creates/updates character + token in database
     - Stores `characterId`, `characterName`, `ownerHash` in session

5. **User is now logged in**
   - NextAuth session cookie: `next-auth.session-token` (JWT)
   - Contains: `accessToken`, `characterId`, `characterName`, `expiresAt`

---

### Step 2: Making Authenticated API Calls

```
Browser → API (with Bearer token) → EVE JWKS validation → DB lookup
```

1. **Frontend hook calls API**
   ```typescript
   const client = useApiClient(); // Gets token from session
   const { data } = useQuery({
     queryKey: ['users'],
     queryFn: () => client.get('/users')
   });
   ```

2. **useApiClient() injects Bearer token**
   - Location: `apps/web/app/api-hooks/useApiClient.ts`
   - Gets `session.accessToken` from NextAuth
   - Passes to `clientForApp("api", token)`

3. **API client adds Authorization header**
   - Location: `packages/api-client/src/index.ts`
   - Header: `Authorization: Bearer <eve_access_token>`
   - Also sends: `credentials: 'include'` (for any cookies)

4. **Backend guard validates token**
   - Location: `apps/api/src/characters/guards/composite-auth.guard.ts`
   - Uses: `EveAuthGuard` (extends Passport JWT)
   
5. **EveJwtStrategy validates with EVE**
   - Location: `apps/api/src/characters/guards/jwt.strategy.ts`
   - Verifies: RS256 signature against EVE's JWKS
   - Validates: `iss` (issuer), `exp` (expiry), `sub` (character ID)

6. **Strategy loads user from database**
   ```typescript
   // Looks up character by ID from token
   const character = await prisma.eveCharacter.findUnique({
     where: { id: characterId },
     include: { user: { select: { role, primaryCharacterId } } }
   });
   
   // Returns user object attached to request
   return {
     characterId,
     ownerHash,
     name,
     userId: character?.userId,
     role: character?.user?.role ?? 'USER',
     primaryCharacterId: character?.user?.primaryCharacterId
   };
   ```

7. **Controller receives authenticated user**
   ```typescript
   @Get('me')
   me(@CurrentUser() user: RequestUser) {
     // user is guaranteed to exist (guard passed)
     return { userId: user.userId, role: user.role, ... };
   }
   ```

---

## 🔑 Token Management

### Frontend (NextAuth)

**Token Storage:**
- JWT session cookie: `next-auth.session-token`
- Contains: EVE `access_token`, `refresh_token`, expiry

**Token Refresh:**
- Location: `apps/web/lib/auth.ts` → `jwt()` callback
- When: Token expires in <5 minutes
- How: Calls EVE SSO `/oauth/token` with `refresh_token`
- Updates: `access_token`, `expires_at` in session
- Automatic: Happens on every request that checks session

### Backend (Database)

**Token Storage:**
- Table: `character_tokens`
- Per character: `accessToken`, `refreshTokenEnc` (encrypted), `expiresAt`
- Used for: Backend jobs (wallet imports, ESI calls on behalf of users)

**Token Refresh:**
- Location: `apps/api/src/characters/services/esi-token.service.ts`
- When: Backend needs to call ESI on behalf of a character
- How: Decrypts `refreshTokenEnc`, calls EVE SSO
- Updates: Database with new tokens

---

## 🛡️ Authorization (Roles)

### Role Types

```typescript
enum UserRole {
  USER = "USER",       // Regular user
  ADMIN = "ADMIN"      // Administrator
}
```

### Role Enforcement

**Backend:**
```typescript
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Get('admin/users')
adminUsers() {
  // Only ADMIN role can access
}
```

**How it works:**
1. `CompositeAuthGuard` runs first → authenticates user
2. `RolesGuard` runs second → checks `user.role` matches `@Roles()`
3. If mismatch → 403 Forbidden

---

## 🔒 Security Features

### 1. **EVE Token Verification (RS256 + JWKS)**
- Tokens verified against EVE's public keys
- Prevents token forgery
- RS256 asymmetric encryption

### 2. **Owner Hash Validation**
- Each character has an `ownerHash` (EVE-provided, unique per account)
- If hash changes → character was sold/transferred
- Backend detects this and invalidates tokens
- Location: `apps/api/src/characters/guards/jwt.strategy.ts` lines 63-83

### 3. **Database-Backed User Association**
- EVE token only proves character identity
- Backend database maps character → user → role
- Enables multi-character support per user
- Enables role-based authorization

### 4. **Encrypted Refresh Tokens**
- Refresh tokens encrypted in database using AES-GCM
- Key derived from `ENCRYPTION_KEY` environment variable
- Location: `apps/api/src/common/crypto.util.ts`

### 5. **Rate Limiting**
- 100 requests/minute per IP
- Via `@nestjs/throttler`
- Global guard in `app.module.ts`

### 6. **Helmet Security Headers**
- CSP, XSS protection, HSTS, etc.
- Configured in `apps/api/src/main.ts`

---

## 🚫 What We Removed (Simplified)

### ❌ Cookie-Based Backend Sessions
**Before:** Backend tried to use its own encrypted session cookies  
**After:** Only use EVE Bearer tokens from NextAuth

**Why:** Simpler, single source of truth, no duplicate session management

### ❌ Dual Auth Strategies
**Before:** Try cookies first, fallback to Bearer  
**After:** Bearer tokens only

**Why:** Cleaner, more standard, easier to debug

---

## 📋 Public Endpoints

Only these endpoints bypass authentication:

```typescript
// Health check (monitoring)
GET /health

// OAuth callbacks (EVE SSO flow)
POST /auth/link-character              // Called by NextAuth
GET /auth/link-character/callback      // EVE SSO callback
GET /auth/admin/system-characters/callback

// Arbitrage (read-only public data)
POST /arbitrage/check
POST /arbitrage/plan-packages
GET /arbitrage/commits
```

**All other endpoints** require valid EVE Bearer token.

---

## 🧪 Testing Auth

### Test Unauthenticated Access
```bash
curl http://localhost:3000/auth/me
# Expected: 401 Unauthorized
```

### Test Authenticated Access
```bash
# Get token from NextAuth session (browser DevTools → Application → Cookies)
curl -H "Authorization: Bearer <eve_token>" http://localhost:3000/auth/me
# Expected: { userId, characterId, role, ... }
```

### Test Role-Based Access
```bash
# As regular user
curl -H "Authorization: Bearer <user_token>" http://localhost:3000/admin/users
# Expected: 403 Forbidden

# As admin
curl -H "Authorization: Bearer <admin_token>" http://localhost:3000/admin/users
# Expected: [...users]
```

---

## 🔄 Token Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ Initial Login (EVE SSO)                                     │
│ ↓                                                           │
│ NextAuth stores: access_token (20min), refresh_token (long)│
│ ↓                                                           │
│ Backend stores: same tokens in database per character      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Token Usage                                                 │
│                                                             │
│ Frontend: Uses access_token for API calls (Bearer header)  │
│ Backend: Uses access_token for ESI calls on behalf of user │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Token Expiry (<5min left)                                   │
│ ↓                                                           │
│ Frontend: NextAuth refreshes automatically via EVE SSO      │
│ Backend: Jobs refresh before ESI calls if needed            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Best Practices

### Frontend

✅ **Always use `useApiClient()`** in hooks
```typescript
export function useMyData() {
  const client = useApiClient(); // Gets token automatically
  return useQuery({
    queryKey: ['myData'],
    queryFn: () => client.get('/my-data')
  });
}
```

❌ **Never create static clients**
```typescript
const client = clientForApp("api"); // NO TOKEN!
```

✅ **Handle 401/403 as "not logged in"**
```typescript
try {
  return await client.get('/data');
} catch (e) {
  if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
    return null; // Not logged in
  }
  throw e; // Real error
}
```

### Backend

✅ **Use `@CurrentUser()` decorator**
```typescript
@Get('my-data')
getData(@CurrentUser() user: RequestUser) {
  // user is guaranteed to exist (guard passed)
  return this.service.findByUser(user.userId);
}
```

✅ **Use `@Public()` sparingly**
```typescript
@Public() // Only for health checks, public data
@Get('public-data')
```

✅ **Use `@Roles()` for admin endpoints**
```typescript
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Get('admin/sensitive-data')
```

---

## 🏗️ Architecture Summary

```
┌──────────────┐
│   Browser    │
│              │
│  NextAuth    │  JWT session cookie
│  Session     │  contains: access_token
└──────┬───────┘
       │ Authorization: Bearer <access_token>
       ↓
┌──────────────┐
│   NestJS     │
│   API        │
│              │
│  ┌────────┐  │
│  │ Guard  │  │  Validates token via EVE JWKS (RS256)
│  └───┬────┘  │
│      ↓       │
│  ┌────────┐  │
│  │Strategy│  │  Looks up character → user → role in DB
│  └───┬────┘  │
│      ↓       │
│  ┌────────┐  │
│  │Request │  │  Attaches user object to request
│  │  .user │  │
│  └───┬────┘  │
│      ↓       │
│  ┌────────┐  │
│  │Control │  │  Uses @CurrentUser() to access user
│  │  ler   │  │
│  └────────┘  │
└──────────────┘
```

**Key Points:**
- ✅ Single source of truth: NextAuth session
- ✅ EVE validates token authenticity
- ✅ Backend database provides user/role context
- ✅ No duplicate session management
- ✅ Automatic token refresh
- ✅ Owner hash validation prevents account transfers

---

## 🎉 Result

**Robust, Clean, Secure:**
- ✅ Standard OAuth2 + JWT pattern
- ✅ EVE-validated tokens (can't be forged)
- ✅ Database-backed authorization
- ✅ Automatic token refresh
- ✅ No custom session storage
- ✅ Clear separation of concerns

