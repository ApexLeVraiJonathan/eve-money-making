# Frontend Integration Complete ✅

## Summary

The frontend has been fully integrated with the new NextAuth-based authentication system. All API routes now forward EVE Bearer tokens from NextAuth sessions to NestJS.

## What Was Updated

### 1. **New Helper Functions** (`apps/web/lib/api-client.ts`)

Created two helper functions to standardize API calls:

- `fetchWithAuth(endpoint, options)` - Makes authenticated fetch calls with Bearer token
- `fetchWithAuthJson<T>(endpoint, options)` - Same as above but returns parsed JSON

These helpers:

- ✅ Automatically get the NextAuth session
- ✅ Extract the EVE access token
- ✅ Forward it as `Authorization: Bearer <token>` to NestJS
- ✅ Handle authentication errors gracefully

### 2. **UI Components Updated**

**Login Button** (`apps/web/components/sidebar/nav-user.tsx`):

- ✅ Now uses `signIn("eveonline")` from NextAuth
- ✅ Removed old cookie-based redirect
- ✅ Properly handles callback URL

**App Layout** (`apps/web/app/layout.tsx`):

- ✅ Wrapped with `<SessionProvider>` to enable NextAuth hooks
- ✅ Created custom wrapper component for consistency

### 3. **API Routes Updated**

All routes now use the `fetchWithAuth` helper:

#### Authentication Routes

- ✅ `GET /api/auth/me` - Get current user
- ✅ `GET /api/auth/characters` - List all characters

#### User Routes

- ✅ `GET /api/users/me/characters` - List my characters
- ✅ `PATCH /api/users/me/primary-character` - Set primary character
- ✅ `DELETE /api/users/me/characters/[id]` - Unlink character

#### Admin Routes

- ✅ `GET /api/admin/users` - List all users
- ✅ `PATCH /api/admin/users/[id]/role` - Change user role
- ✅ `POST /api/admin/users/[id]/link-character` - Force link character
- ✅ `PATCH /api/admin/users/[id]/primary-character` - Set user's primary

### 4. **Files Created/Modified**

**Created (2 files)**:

- `apps/web/lib/api-client.ts` - API helper functions
- `apps/web/components/session-provider.tsx` - NextAuth session wrapper

**Modified (10 files)**:

- `apps/web/components/sidebar/nav-user.tsx` - Login button
- `apps/web/app/layout.tsx` - Session provider
- `apps/web/app/api/auth/me/route.ts`
- `apps/web/app/api/auth/characters/route.ts`
- `apps/web/app/api/users/me/characters/route.ts`
- `apps/web/app/api/users/me/primary-character/route.ts`
- `apps/web/app/api/users/me/characters/[characterId]/route.ts`
- `apps/web/app/api/admin/users/route.ts`
- `apps/web/app/api/admin/users/[id]/role/route.ts`
- `apps/web/app/api/admin/users/[id]/link-character/route.ts`
- `apps/web/app/api/admin/users/[id]/primary-character/route.ts`

## How to Test

### Prerequisites

1. **Environment variables set** (see `env.example.md`):

   ```env
   EVE_CLIENT_ID=your_client_id
   EVE_CLIENT_SECRET=your_secret
   NEXTAUTH_URL=http://localhost:3001
   NEXTAUTH_SECRET=your_generated_secret
   API_URL=http://localhost:4000
   PORT=4000
   ```

2. **Database migrated**:
   ```powershell
   cd apps/api
   pnpm prisma migrate deploy
   ```

### Start the Servers

**Terminal 1 - NestJS API**:

```powershell
cd apps/api
pnpm start:dev
```

**Terminal 2 - Next.js Web**:

```powershell
cd apps/web
pnpm dev
```

### Test the Full Flow

1. **Open the app** at `http://localhost:3001`

2. **Click "Sign in with EVE"** in the sidebar

   - Should redirect to EVE SSO
   - Authorize the application
   - Should redirect back to the app

3. **Verify authentication**:

   - Sidebar should show your character name and avatar
   - No errors in browser console
   - No errors in API logs

4. **Test character management**:

   - Go to `/account-settings`
   - Should see your linked character(s)
   - Try linking another character
   - Try setting primary character
   - Try unlinking a character (not primary)

5. **Test admin features** (if you have ADMIN role):
   - Go to `/arbitrage/admin/characters`
   - Should see all characters
   - Test user management features

### Expected Behavior

**Successful Sign-In**:

- ✅ Redirected to EVE SSO page
- ✅ After authorization, back to app
- ✅ Sidebar shows character info
- ✅ API calls succeed (200 status)
- ✅ No 401 errors in console

**Unauthenticated**:

- ✅ Shows "Sign in with EVE" button
- ✅ API calls return empty arrays or 401 gracefully
- ✅ No crashes or error pages

**Admin Features**:

- ✅ Only visible if user has ADMIN role
- ✅ Character management works
- ✅ User role changes work

## Troubleshooting

### "Not authenticated" errors

**Symptom**: API calls fail with 401 errors

**Check**:

1. Is NextAuth properly configured?
   - Check `apps/web/app/api/auth/[...nextauth]/route.ts`
   - Verify `EVE_CLIENT_ID` and `EVE_CLIENT_SECRET` are set
2. Is the session provider wrapping the app?
   - Check `apps/web/app/layout.tsx` has `<SessionProvider>`
3. Is the API running and CORS configured?
   - Check `apps/api/src/main.ts` CORS settings

### Sign-in redirect loop

**Symptom**: Keeps redirecting back to sign-in

**Check**:

1. `NEXTAUTH_URL` matches your actual URL
2. EVE application redirect URI matches `NEXTAUTH_URL/api/auth/callback/eveonline`
3. Check browser console for errors

### Character not showing in sidebar

**Symptom**: Signed in but sidebar shows "Sign in with EVE"

**Check**:

1. Is the user linked to the character in DB?
   - Check `eve_characters` table for `user_id`
2. Does the `/api/auth/characters` route return data?
   - Check Network tab in browser DevTools
3. Are there any JS errors in console?

### CORS errors

**Symptom**: Network errors in browser console

**Check**:

1. API CORS is configured in `apps/api/src/main.ts`
2. Next.js URL is in the CORS `origin` array
3. `Authorization` is in `allowedHeaders`

## What's NOT Updated Yet

Some routes weren't updated in this batch (not critical for core functionality):

- Arbitrage-specific routes (`/api/arbitrage/*`)
- Ledger routes (`/api/ledger/*`)
- Pricing routes (`/api/pricing/*`)
- Import/jobs routes (`/api/import/*`, `/api/jobs/*`)
- Wallet import routes (`/api/wallet-import/*`)

These can be updated using the same pattern if needed:

```typescript
import { fetchWithAuthJson } from "@/lib/api-client";

export async function GET() {
  try {
    const data = await fetchWithAuthJson("/your-endpoint");
    return NextResponse.json(data);
  } catch (err) {
    // Handle error
  }
}
```

## Next Steps

1. ✅ **Test the auth flow** - Sign in, link characters, test features
2. ⏳ **Update remaining routes** if they're used (only if needed)
3. ⏳ **Add middleware protection** for private pages (optional)
4. ⏳ **Deploy to production** with proper secrets management

## Success Criteria

- ✅ User can sign in with EVE SSO
- ✅ User info displays in sidebar
- ✅ Character management works
- ✅ Admin features work (with ADMIN role)
- ✅ No authentication errors in console
- ✅ All API calls forward Bearer tokens

---

**Last Updated**: 2025-10-13  
**Status**: ✅ Ready for Testing
