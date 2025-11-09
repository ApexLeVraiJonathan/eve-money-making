# EVE Money Making - Web (Frontend)

Next.js frontend for EVE Online arbitrage trading cycle management.

---

## Architecture

### Modern React Patterns

This app uses:
- **Next.js 15** with App Router
- **TanStack Query** for API state management
- **Direct API calls** (no Next.js proxy routes)
- **Type-safe hooks** with shared types from `@eve/shared`
- **Shadcn UI** components from `@eve/ui`

### Project Structure

```
apps/web/
├── app/
│   ├── arbitrage/              # Main arbitrage features
│   │   ├── api/                # TanStack Query hooks (67+ hooks)
│   │   │   ├── cycles.ts       # Cycle management hooks
│   │   │   ├── participations.ts
│   │   │   ├── pricing.ts
│   │   │   ├── packages.ts
│   │   │   ├── wallet.ts
│   │   │   ├── arbitrage.ts
│   │   │   ├── admin.ts
│   │   │   └── index.ts        # Central exports
│   │   ├── cycles/             # Cycle pages
│   │   ├── admin/              # Admin panels
│   │   └── my-investments/     # User investment tracking
│   ├── account-settings/       # User account management
│   ├── api/
│   │   └── auth/               # NextAuth routes ONLY
│   ├── api-hooks/              # Cross-domain hooks
│   │   └── users.ts            # User & auth hooks
│   └── brokerage/              # Brokerage features
├── components/
│   └── sidebar/                # App-specific components
├── lib/
│   ├── auth.ts                 # NextAuth configuration
│   ├── server-api-client.ts    # Server-side API helper
│   └── utils.ts                # Shared utilities
└── public/                     # Static assets
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Backend API running (see `apps/api/README.md`)

### Installation

```bash
cd apps/web
pnpm install
```

### Environment Variables

Create `.env.local` file:

```bash
# API URLs (no /api suffix)
NEXT_PUBLIC_API_URL="http://localhost:3001"
API_URL="http://localhost:3001"  # Server-side only
NEXT_PUBLIC_WEB_BASE_URL="http://localhost:3000"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_secret_here"

# EVE SSO (same as backend)
EVE_CLIENT_ID="your_client_id"
EVE_CLIENT_SECRET="your_client_secret"
```

**Important:** Do NOT include `/api` suffix in `NEXT_PUBLIC_API_URL` - the backend routes handle the full path.

See [../../env.example.md](../../env.example.md) for complete configuration guide.

### Development

```bash
pnpm run dev
```

App will be available at `http://localhost:3000`

---

## API Communication

### Pattern: TanStack Query Hooks

**All API calls** use centralized hooks from `app/arbitrage/api/`:

```typescript
// ✅ Correct (using hooks)
import { useCycles, useCreateCycle } from "@/app/arbitrage/api";

function MyComponent() {
  const { data: cycles, isLoading } = useCycles();
  const createCycle = useCreateCycle();
  
  const handleCreate = async () => {
    await createCycle.mutateAsync({ name: "Cycle 1", ... });
  };
  
  return <div>...</div>;
}
```

**Benefits:**
- Automatic caching & refetching
- Built-in loading/error states
- Type-safe with IntelliSense
- Cache invalidation on mutations
- Automatic authentication (cookies + Bearer tokens)
- 95% less boilerplate code

### Authentication Strategy

The frontend uses **dual authentication**:

1. **Cookie-based (primary):** After NextAuth login, all requests automatically include session cookies via `credentials: 'include'`
2. **Bearer tokens (fallback):** Server-side code uses `@/lib/server-api-client` with NextAuth access tokens

**Client-side usage:**
```typescript
// Automatic auth via cookies
import { useApiClient } from "@/app/api-hooks/useApiClient";

function MyComponent() {
  const client = useApiClient(); // Includes session automatically
  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => client.get('/users')
  });
}
```

**Server-side usage:**
```typescript
import { fetchWithAuthJson } from "@/lib/server-api-client";

export async function ServerComponent() {
  const data = await fetchWithAuthJson('/users'); // Uses Bearer token
  return <div>{data}</div>;
}
```

### Available Hooks (67+)

**Cycles (21 hooks):**
- `useCycleOverview()`, `useCycles()`, `useCycleProfit()`, etc.
- `useCreateCycle()`, `usePlanCycle()`, `useOpenCycle()`, etc.

**Participations (10 hooks):**
- `useAllParticipations()`, `useMyParticipation()`, etc.
- `useCreateParticipation()`, `useValidateParticipationPayment()`, etc.

**Users & Auth (9 hooks):**
- `useCurrentUser()`, `useMyCharacters()`, etc.
- `useSetPrimaryCharacter()`, `useUnlinkCharacter()`, etc.

**Pricing, Packages, Wallet, Admin** (27+ hooks)

See `app/arbitrage/api/index.ts` for complete exports.

---

## Shared Packages

### @eve/ui
```typescript
import { Button, Card, Badge } from "@eve/ui";
```
26+ Shadcn components shared across apps.

### @eve/shared
```typescript
import type { Cycle, CycleParticipation, User } from "@eve/shared";
```
30+ shared types for frontend/backend consistency.

### @eve/api-client
```typescript
import { clientForApp } from "@eve/api-client";
import { qk } from "@eve/api-client/queryKeys";
```
- Type-safe HTTP client
- Centralized query key factories
- Automatic auth token injection

---

## Build

```bash
# Development build
pnpm run build

# Production optimized
pnpm run build

# Start production server
pnpm run start
```

---

## Project Conventions

### Component Organization
- **Pages:** `app/*/page.tsx`
- **API Hooks:** `app/*/api/*.ts`
- **Shared hooks:** `app/api-hooks/*.ts`
- **Components:** `components/*`
- **Utilities:** `lib/*`

### Import Patterns
```typescript
// ✅ Shared packages
import { Button } from "@eve/ui";
import type { Cycle } from "@eve/shared";
import { useCycles } from "@/app/arbitrage/api";

// ✅ Local utilities
import { formatIsk } from "@/lib/utils";
import { auth } from "@/auth";

// ❌ Avoid direct fetch calls
// Use hooks instead!
```

### API Hook Naming
- **Queries:** `use*()` - Returns `{ data, isLoading, error }`
- **Mutations:** `use*()` - Returns `{ mutateAsync, isPending }`
- **Utilities:** Plain functions - `startCharacterLink()`, `logout()`

---

## Key Features

### Authentication
- **EVE SSO** via NextAuth
- **Session-based** auth
- **Character linking** support
- **Role-based** access (USER, ADMIN)

### State Management
- **TanStack Query** for server state
- **React hooks** for local state
- **Automatic cache** invalidation
- **Optimistic updates**

### Type Safety
- **100% TypeScript**
- **Shared types** from `@eve/shared`
- **IntelliSense** for all API calls
- **Compile-time** error checking

---

## Critical User Flows

See [../../docs/CRITICAL_USER_FLOWS.md](../../docs/CRITICAL_USER_FLOWS.md) for detailed flow documentation and testing guide.

---

## Deployment

### Build for Production

```bash
pnpm run build
```

### Environment Variables

Set all production environment variables:
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXTAUTH_URL` - Frontend URL
- `NEXTAUTH_SECRET` - Session secret
- EVE SSO credentials

### Deploy

Compatible with:
- Vercel
- Railway
- Docker
- Any Node.js hosting

---

## Development Tips

### Adding New API Endpoints

1. **Create hook** in appropriate `app/*/api/*.ts` file
2. **Add query key** if needed in `@eve/api-client/queryKeys`
3. **Use in component** with `use*()` hook
4. **Handle loading** and error states automatically

Example:
```typescript
// 1. Add hook
export function useMyNewEndpoint() {
  return useQuery({
    queryKey: qk.domain.myEndpoint(),
    queryFn: () => client.get("/my-endpoint"),
  });
}

// 2. Use in component
function MyComponent() {
  const { data, isLoading, error } = useMyNewEndpoint();
  if (isLoading) return <Skeleton />;
  if (error) return <div>Error!</div>;
  return <div>{data}</div>;
}
```

---

## License

MIT
