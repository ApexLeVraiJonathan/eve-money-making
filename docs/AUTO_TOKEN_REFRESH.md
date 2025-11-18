# Automatic Token Refresh Implementation

**Date**: November 18, 2025  
**Status**: ✅ Implemented

## Problem

When users work on long-running admin tasks (like the undercut checker), their EVE access token can expire after ~20 minutes. This causes API calls to fail with 401 errors, forcing users to:
- Reload the page (losing their work)
- Open the app in another tab to trigger a token refresh

This is particularly problematic for admin workflows that take significant time to complete.

## Solution

Implemented automatic background token refresh that keeps the session alive while users work, without requiring page reloads or user interaction.

## Implementation Details

### 1. SessionRefreshBoundary Component

**File**: `apps/web/components/session-refresh-boundary.tsx`

A client component that:
- Monitors `session.expiresAt` to know when the EVE access token expires
- Schedules a proactive refresh **3 minutes before expiry** (safety window)
- Calls `update()` from `useSession()` to trigger NextAuth's refresh logic
- Automatically reschedules when the session changes
- Logs refresh activity to the console for debugging

**Key features**:
- Gracefully handles missing expiry data
- Skips refresh scheduling if session has an error
- Clears timers on unmount to prevent memory leaks
- Refreshes immediately if token is already expired or expiring very soon

### 2. Layout Integration

**File**: `apps/web/app/layout.tsx`

Component hierarchy:
```
SessionProvider
└─ AuthLoadingBoundary
   └─ SessionRefreshBoundary  ← NEW
      └─ QueryProvider
         └─ App content
```

The `SessionRefreshBoundary` is placed:
- Inside `SessionProvider` (needs access to session)
- Inside `AuthLoadingBoundary` (only runs after initial session load)
- Outside `QueryProvider` (independent of React Query)

This makes the automatic refresh **global** across all pages and components.

### 3. SessionProvider Configuration

**File**: `apps/web/components/session-provider.tsx`

Added NextAuth configuration options:
- `refetchInterval: 5 * 60` - Refetch session every 5 minutes as a backup safety net
- `refetchOnWindowFocus: true` - Refetch when user returns to the tab (explicit)

These work in conjunction with `SessionRefreshBoundary`:
- **Primary**: `SessionRefreshBoundary` handles precise timing (3 min before expiry)
- **Backup**: `refetchInterval` catches any edge cases every 5 minutes
- **User return**: `refetchOnWindowFocus` refreshes when switching back to the tab

## How It Works

### Normal Flow

1. User logs in → session has `expiresAt` timestamp (e.g., 20 minutes from now)
2. `SessionRefreshBoundary` calculates: `expiresAt - now - 3 minutes = 17 minutes`
3. Sets a timer to refresh in 17 minutes
4. After 17 minutes: calls `update()` → triggers `jwt()` callback in `auth.ts`
5. `auth.ts` sees token expiring soon → calls EVE SSO with refresh token
6. New access token received → `expiresAt` updated → process repeats

### Token Refresh Logic (Existing)

**File**: `apps/web/lib/auth.ts`

The existing `jwt` callback already handles:
- Checking if token expires within 5 minutes
- Calling EVE SSO `/oauth/token` endpoint with refresh token
- Updating `accessToken` and `expiresAt` in the session
- Logging success/failure

Our `SessionRefreshBoundary` just ensures this logic runs **before** the user makes an API call that would fail.

## Benefits

✅ **No user interaction required** - Tokens refresh silently in the background  
✅ **No page reloads needed** - Work continues uninterrupted  
✅ **No data loss** - Long-running admin tasks (undercut checker) keep working  
✅ **Multiple safety nets** - Timer-based + interval-based + window-focus refresh  
✅ **Minimal code** - Leverages existing NextAuth refresh logic  
✅ **Easy to debug** - Console logs show when refreshes happen  

## Testing

### Manual Testing

1. **Normal refresh**:
   - Log in and wait ~17 minutes (20 min token - 3 min buffer)
   - Check console for: `[SessionRefresh] Refreshing session proactively`
   - Continue using app - API calls should work without interruption

2. **Long-running admin task**:
   - Go to undercut checker
   - Run a check and start working on repricing
   - Wait past token expiry (20+ minutes)
   - Confirm repricing operations still succeed

3. **Tab switching**:
   - Leave tab idle for extended period
   - Switch to another tab and back
   - Console should show refresh on window focus

### Dev Testing with Short Tokens

To test without waiting 20 minutes:

1. Temporarily edit `apps/web/lib/auth.ts`:
   ```typescript
   // Change line 80 from:
   const fiveMinutesMs = 5 * 60 * 1000;
   // To:
   const fiveMinutesMs = 19 * 60 * 1000; // Force refresh on every check
   ```

2. Edit `apps/web/components/session-refresh-boundary.tsx`:
   ```typescript
   // Change line 48 from:
   const safetyWindowMs = 3 * 60 * 1000;
   // To:
   const safetyWindowMs = 19 * 60 * 1000; // Force immediate refresh
   ```

3. Reload app - should see immediate refresh logs

## Edge Cases Handled

- **Token already expired**: Refreshes immediately instead of scheduling
- **Session has error**: Skips scheduling to avoid infinite loops
- **Session not authenticated**: No-op, waits for authentication
- **Missing expiresAt**: Gracefully handles by not scheduling
- **Component unmount**: Clears timers to prevent memory leaks
- **Session changes**: Clears old timer and reschedules with new expiry

## Future Enhancements (Not Implemented)

If needed, could add:
- Visual indicator when refresh happens (subtle toast)
- Retry logic for failed API calls due to expired tokens
- Session error banner for permanent refresh failures
- Metrics/monitoring for refresh success/failure rates

## Related Documentation

- `docs/AUTH_ARCHITECTURE.md` - Overall auth system
- `docs/AUTH_PATTERNS.md` - Client-side auth patterns
- NextAuth docs: https://next-auth.js.org/getting-started/client#refetch-interval

## Rollout

✅ Deployed globally - affects all pages and users  
✅ No feature flags needed - safe default behavior  
✅ Backward compatible - existing auth logic unchanged  

