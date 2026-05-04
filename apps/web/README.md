# EVE Money Making - Web (Frontend)

Next.js frontend for EVE Online Tradecraft and character-management workflows.

---

## Architecture

### Modern React Patterns

This app uses:
- **Next.js 15** with App Router
- **TanStack Query** for API state management
- **Next as BFF**: browser calls route handlers under `/api/*`, route handlers call Nest with server-only backend URLs
- **Type-safe hooks** with shared types from `@eve/shared`
- **Shadcn UI** components from `@eve/ui`

### Project Structure

```
apps/web/
├── app/
│   ├── tradecraft/             # Trading cycles, admin tools, market workflows
│   │   ├── api/                # TanStack Query hooks by feature
│   │   ├── cycles/             # Cycle pages
│   │   ├── admin/              # Admin panels
│   │   └── my-investments/     # User investment tracking
│   ├── characters/             # Character overview, training queues, skill browser
│   ├── account-settings/       # User account management
│   ├── api/
│   │   ├── auth/               # NextAuth and auth bridge routes
│   │   ├── tradecraft/         # BFF proxy to Tradecraft API routes
│   │   ├── characters/         # BFF proxy to character API routes
│   │   └── core/               # BFF proxy to core API routes
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
# API URLs
API_URL="http://localhost:3000"              # Server-side only (used by Next route handlers)
NEXT_PUBLIC_WEB_BASE_URL="http://localhost:3001"  # Web is on port 3001

# NextAuth
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your_secret_here"

# EVE SSO (same as backend)
EVE_CLIENT_ID="your_client_id"
EVE_CLIENT_SECRET="your_client_secret"
```

Browser API calls go through app-scoped Next.js BFF routes (`/api/tradecraft/*`, `/api/characters/*`, `/api/core/*`) and do not require a public backend URL variable.

See [../../env.example.md](../../env.example.md) for complete configuration guide.

### Development

```bash
pnpm run dev
```

App will be available at `http://localhost:3001`

---

## API Communication

### Pattern: TanStack Query Hooks

Feature API calls should use centralized hooks from route/feature API modules, usually under `app/tradecraft/api/`, `app/characters/**/api.ts`, or `app/api-hooks/`:

```typescript
// ✅ Correct (using hooks)
import { useCycles, useCreateCycle } from "@/app/tradecraft/api/cycles";

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

### Available Hooks

**Cycles (21 hooks):**
- `useCycleOverview()`, `useCycles()`, `useCycleProfit()`, etc.
- `useCreateCycle()`, `usePlanCycle()`, `useOpenCycle()`, etc.

**Participations (10 hooks):**
- `useAllParticipations()`, `useMyParticipation()`, etc.
- `useCreateParticipation()`, `useValidateParticipationPayment()`, etc.

**Users & Auth (9 hooks):**
- `useCurrentUser()`, `useMyCharacters()`, etc.
- `useSetPrimaryCharacter()`, `useUnlinkCharacter()`, etc.

**Characters, Pricing, Packages, Wallet, Admin** hooks are grouped by feature.

Prefer direct feature imports over barrel exports. See `app/tradecraft/api/**` and `app/api-hooks/**` for current hook modules.

---

## Shared Packages

### @eve/ui
```typescript
import { Button, Card, Badge } from "@eve/ui";
```
26+ Shadcn components shared across apps.

### @eve/shared
```typescript
import type { CycleOverviewResponse } from "@eve/shared/tradecraft-cycles";
```
Shared request/response contracts are published through `@eve/shared/*` subpath exports.

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
import type { CycleOverviewResponse } from "@eve/shared/tradecraft-cycles";
import { useCycles } from "@/app/tradecraft/api/cycles";

// ✅ Local utilities
import { formatIsk } from "@/lib/utils";
import { auth } from "@/auth";

// ❌ Avoid ad-hoc browser fetches to the Nest API
// Use feature hooks that call Next route handlers instead.
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

Historical flow docs live in [../../docs/old](../../docs/old). Treat them as archive context and prefer current route/API behavior when they conflict with code.

---

## Deployment

### Build for Production

```bash
pnpm run build
```

### Notes on `.next` folders (Windows-safe)

This repo intentionally separates Next.js output folders to avoid file-lock/race issues when a build happens while a server is running:

- **Dev server** (`pnpm run dev`) uses `.next/`
- **Prod build output** (`pnpm run build`) writes to `.next-build/`
- **Prod runtime** (`pnpm run start`) reads from `.next-run/`

`pnpm run start` will automatically initialize `.next-run/` from `.next-build/` if needed.

### Environment Variables

Set all production environment variables:
- `API_URL` - Backend API URL for Next.js server-side routes
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
