# Authentication Patterns & Best Practices

**Date**: November 10, 2025  
**Status**: ✅ Active Standard

## Overview

This document outlines the standard patterns for implementing authentication-aware features in the EVE Money Making application.

## 1. Global Loading State

### Implementation

The `AuthLoadingBoundary` component wraps the entire application and shows a loading spinner while NextAuth checks for an existing session.

```typescript
// apps/web/app/layout.tsx
<SessionProvider>
  <AuthLoadingBoundary>
    <QueryProvider>
      {/* Your app */}
    </QueryProvider>
  </AuthLoadingBoundary>
</SessionProvider>
```

### Benefits

- ✅ Prevents flash of unauthenticated content (FOUC)
- ✅ Professional loading experience
- ✅ Stops premature API calls
- ✅ Consistent user experience

### Customization

Edit `apps/web/components/auth-loading-boundary.tsx` to customize the loading UI:

```typescript
// Show different loading state
if (status === "loading") {
  return <YourCustomLoadingComponent />;
}
```

---

## 2. Authenticated Queries with `useAuthenticatedQuery`

### When to Use

Use `useAuthenticatedQuery` instead of `useQuery` when your API endpoint requires authentication.

### ✅ Do This

```typescript
import { useAuthenticatedQuery } from "./useAuthenticatedQuery";

export function useCurrentUser() {
  const client = useApiClient();
  
  return useAuthenticatedQuery({
    queryKey: qk.users.me(),
    queryFn: () => client.get("/auth/me"),
    retry: false,
  });
}
```

### ❌ Don't Do This

```typescript
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export function useCurrentUser() {
  const { status } = useSession(); // ❌ Repetitive boilerplate
  const client = useApiClient();
  
  return useQuery({
    queryKey: qk.users.me(),
    queryFn: () => client.get("/auth/me"),
    enabled: status !== "loading", // ❌ Easy to forget!
    retry: false,
  });
}
```

---

## 3. Combining with Additional Conditions

You can still add extra `enabled` conditions that will be combined with the session check:

```typescript
export function useUserById(userId: string | undefined) {
  const client = useApiClient();
  
  return useAuthenticatedQuery({
    queryKey: ["user", userId],
    queryFn: () => client.get(`/users/${userId}`),
    enabled: !!userId, // ✅ Combined with session check automatically
  });
}
```

This becomes: `enabled: (status !== "loading") && !!userId`

---

## 4. Public Endpoints (No Auth Required)

For public endpoints that don't require authentication, use regular `useQuery`:

```typescript
import { useQuery } from "@tanstack/react-query";

export function usePublicServerStatus() {
  const client = useApiClient(); // Still use for consistent API client
  
  return useQuery({
    queryKey: ["server", "status"],
    queryFn: () => client.get("/public/status"),
    // No session check needed
  });
}
```

---

## 5. Migration Guide

### Identifying Hooks to Migrate

Look for these patterns in existing hooks:

```typescript
// Pattern 1: Manual session check
const { status } = useSession();
// ...
enabled: status !== "loading"

// Pattern 2: No session check (BUG - needs migration!)
return useQuery({
  // ... no session check at all
});
```

### Migration Steps

1. **Import the hook**:
   ```typescript
   import { useAuthenticatedQuery } from "./useAuthenticatedQuery";
   ```

2. **Remove manual session checks**:
   ```typescript
   // ❌ Remove this
   const { data: session, status } = useSession();
   ```

3. **Replace `useQuery` with `useAuthenticatedQuery`**:
   ```typescript
   // ❌ Before
   return useQuery({
     queryKey: [...],
     queryFn: ...,
     enabled: status !== "loading",
   });
   
   // ✅ After
   return useAuthenticatedQuery({
     queryKey: [...],
     queryFn: ...,
     // enabled: status !== "loading" handled automatically
   });
   ```

### Example Migration

**Before**:
```typescript
export function useCycleOverview() {
  const { status } = useSession();
  const client = useApiClient();
  
  return useQuery({
    queryKey: qk.cycles.overview(),
    queryFn: () => client.get("/ledger/cycles/overview"),
    enabled: status !== "loading",
  });
}
```

**After**:
```typescript
export function useCycleOverview() {
  const client = useApiClient();
  
  return useAuthenticatedQuery({
    queryKey: qk.cycles.overview(),
    queryFn: () => client.get("/ledger/cycles/overview"),
  });
}
```

---

## 6. Testing Authenticated Queries

When writing tests for components using `useAuthenticatedQuery`:

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useCurrentUser } from "./users";

describe("useCurrentUser", () => {
  it("waits for session before fetching", async () => {
    // Mock useSession to return loading state
    mockUseSession({ status: "loading" });
    
    const { result } = renderHook(() => useCurrentUser());
    
    // Query should not have run yet
    expect(result.current.fetchStatus).toBe("idle");
    
    // Update session to authenticated
    mockUseSession({ status: "authenticated", data: { ... } });
    
    // Now query should run
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("fetching");
    });
  });
});
```

---

## 7. Common Pitfalls

### ❌ Pitfall 1: Using `useQuery` for Protected Endpoints

```typescript
// ❌ BAD - Race condition possible
export function useProtectedData() {
  return useQuery({
    queryKey: ["protected"],
    queryFn: () => api.get("/protected/data"),
  });
}
```

```typescript
// ✅ GOOD - Session-aware
export function useProtectedData() {
  return useAuthenticatedQuery({
    queryKey: ["protected"],
    queryFn: () => api.get("/protected/data"),
  });
}
```

### ❌ Pitfall 2: Double Session Checks

```typescript
// ❌ BAD - Redundant session check
export function useCurrentUser() {
  const { status } = useSession(); // ❌ Not needed!
  
  return useAuthenticatedQuery({
    queryKey: qk.users.me(),
    queryFn: () => client.get("/auth/me"),
    enabled: status !== "loading", // ❌ Already handled!
  });
}
```

```typescript
// ✅ GOOD - Single session check (inside hook)
export function useCurrentUser() {
  return useAuthenticatedQuery({
    queryKey: qk.users.me(),
    queryFn: () => client.get("/auth/me"),
  });
}
```

### ❌ Pitfall 3: Forgetting to Export

```typescript
// ❌ BAD - Not exported, can't be used elsewhere
function useCurrentUser() {
  return useAuthenticatedQuery({ ... });
}
```

```typescript
// ✅ GOOD - Properly exported
export function useCurrentUser() {
  return useAuthenticatedQuery({ ... });
}
```

---

## 8. Architecture Decision Records

### Why Not use `useSession` in Every Hook?

**Problem**: Repeating `useSession` in every hook is:
- Verbose (extra boilerplate)
- Error-prone (easy to forget)
- Hard to maintain (change logic in 50+ places)

**Solution**: Centralize session checking in `useAuthenticatedQuery`
- ✅ DRY principle
- ✅ Single source of truth
- ✅ Self-documenting code

### Why `AuthLoadingBoundary` at Root?

**Problem**: Without a global boundary:
- Users see flash of login button
- API calls might fire before session ready (despite query-level checks)
- Poor UX on initial load

**Solution**: Wrap entire app in `AuthLoadingBoundary`
- ✅ Consistent loading experience
- ✅ Double protection (boundary + query-level)
- ✅ Professional appearance

---

## 9. Future Considerations

### Potential Enhancements

1. **`useAuthenticatedMutation`**: Similar pattern for mutations
2. **Role-based query hooks**: `useAdminQuery`, `useUserQuery`
3. **Optimistic updates**: Pre-configure for auth queries
4. **Error boundaries**: Specialized handling for auth errors

### Migration Tracking

As of November 10, 2025:
- ✅ Core hooks migrated (`users.ts`)
- ⏳ Arbitrage hooks (25 hooks in `apps/web/app/arbitrage/api/*.ts`)
- ⏳ Brokerage hooks (if any)
- ⏳ Admin hooks (15+ hooks)

---

## 10. Quick Reference

| Pattern | Use Case | Import |
|---------|----------|--------|
| `useAuthenticatedQuery` | Protected API endpoints | `./useAuthenticatedQuery` |
| `useQuery` | Public endpoints | `@tanstack/react-query` |
| `useApiClient` | Get authenticated API client | `./useApiClient` |
| `AuthLoadingBoundary` | Root-level loading state | Automatic in layout |

---

## Related Documentation

- `docs/AUTH_ARCHITECTURE.md` - Overall auth implementation
- `docs/AUTH_FIX_SUMMARY.md` - Race condition fix details
- [TanStack Query Docs](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries)
- [NextAuth.js useSession](https://next-auth.js.org/getting-started/client#usesession)

