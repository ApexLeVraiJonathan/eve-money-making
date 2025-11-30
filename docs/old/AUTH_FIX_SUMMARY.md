# Authentication Race Condition Fix

**Date**: November 9, 2025  
**Status**: ✅ RESOLVED

## Problem

After implementing Bearer-only JWT authentication, users experienced **intermittent login failures**:
- Login would work sometimes, but not consistently
- After logout → re-login, character info wouldn't display
- 401 Unauthorized errors on `/auth/me` and `/users/me/characters`

## Root Cause

**Race Condition**: API hooks (`useCurrentUser`, `useMyCharacters`) were executing **before** the NextAuth session was fully initialized:

1. Page loads → React components mount
2. API hooks execute immediately (no token yet)
3. Queries get 401 responses
4. React Query **caches** these failed responses
5. NextAuth session loads (token available)
6. Queries **don't re-run** because React Query thinks it has the data

## Solution

Added `enabled: status !== "loading"` to both hooks to wait for session readiness:

### Before
```typescript
export function useCurrentUser() {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.users.me(),
    queryFn: async () => { /* ... */ },
    retry: false,
  });
}
```

### After
```typescript
export function useCurrentUser() {
  const { data: session, status } = useSession(); // ✅ Track session status
  const client = useApiClient();
  
  return useQuery({
    queryKey: qk.users.me(),
    queryFn: async () => { /* ... */ },
    enabled: status !== "loading", // ✅ Wait for session
    retry: false,
  });
}
```

## Files Modified

1. **`apps/web/app/api-hooks/users.ts`**
   - Added `useSession()` import from `next-auth/react`
   - Modified `useCurrentUser()` to check session status
   - Modified `useMyCharacters()` to check session status
   - Added JSDoc comments explaining behavior

## Testing

### Test Scenario
1. ✅ Fresh login with EVE SSO → Character displays correctly
2. ✅ Logout → "Sign in with EVE" button shows
3. ✅ Re-login → Character displays correctly (no race condition)
4. ✅ Page refresh → Character persists (session maintained)

### Console Verification
```
[useApiClient] Token present: true eyJhbGciOiJSUzI1NiIs...
[API Request] GET /auth/me {hasToken: true, hasAuthHeader: true}
[API Request] GET /users/me/characters {hasToken: true, hasAuthHeader: true}
```

## Related Issues Fixed

This fix also resolved:
- Character dropdown not populating immediately after login
- "Sign in with EVE" button flashing before character info appears
- Unnecessary 401 errors in console on initial page load

## Additional Context

This issue was introduced when we simplified authentication to Bearer-only JWT (removed cookie-based session fallback). The previous `CompositeAuthGuard` masked this race condition because cookies were available server-side.

## Recommendations

1. ✅ **Session-dependent queries should always check `status !== "loading"`**
2. ✅ Consider adding a global loading state for initial session check
3. ✅ Document this pattern for future API hooks
4. 💡 Consider adding a `useAuthenticatedQuery()` wrapper hook that automatically includes this logic

## References

- [NextAuth.js Session Status](https://next-auth.js.org/getting-started/client#usesession)
- [React Query Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries)
- `docs/AUTH_ARCHITECTURE.md` - Current auth implementation

