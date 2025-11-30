# EVE Money Making - Architecture Documentation

**Last Updated:** 2025-11-09  
**Version:** Post-Refactor v2.0

---

## Overview

EVE Money Making is a monorepo application for tracking EVE Online arbitrage trading cycles, managing investor participations, and optimizing profit distribution.

---

## Architecture

### Monorepo Structure

```
eve-money-making/
├── apps/
│   ├── api/          # NestJS backend API
│   └── web/          # Next.js frontend
├── packages/
│   ├── api-client/   # Shared HTTP client
│   ├── api-contracts/# API contracts (future)
│   ├── prisma/       # Database schema & client
│   ├── shared/       # Shared types & utilities
│   └── ui/           # Shared UI components
└── docs/             # Documentation
```

---

## Backend Architecture (NestJS)

### Domain Organization

```
apps/api/src/
├── characters/      # Auth, users, character management
├── cycles/          # Financial ledger, participations, cycle lines
│   ├── services/    # 9 focused services
│   ├── dto/         # Request/response DTOs
│   └── utils/       # Shared utilities (capital-helpers)
├── market/          # Arbitrage, pricing, liquidity, packages
├── wallet/          # Wallet imports, transaction allocation
├── game-data/       # Static EVE data, data imports
├── esi/             # EVE API infrastructure
├── jobs/            # Background tasks
├── prisma/          # Database client
└── common/          # Shared utilities, config
```

### Service Layer

**Cycles Domain (9 services):**
- `CycleService` - Lifecycle management (120 lines)
- `CycleLineService` - Item tracking (185 lines)
- `FeeService` - Fee management (65 lines)
- `SnapshotService` - Snapshots (55 lines)
- `ParticipationService` - Investments (210 lines)
- `PayoutService` - Payout computation (95 lines)
- `PaymentMatchingService` - Fuzzy matching (260 lines)
- `CapitalService` - Capital/NAV (175 lines)
- `ProfitService` - Profit calculations (180 lines)

**Domain Services (3):**
- `CharacterService` - Character domain facade (10 methods)
- `GameDataService` - Static game data facade (12 methods)
- `MarketDataService` - Market data facade (7 methods)

**Key Principles:**
- All services <550 lines
- Single responsibility
- No cross-domain Prisma queries
- 100% JSDoc documentation
- Comprehensive error handling

---

## Frontend Architecture (Next.js)

### Structure

```
apps/web/
├── app/
│   ├── arbitrage/           # Main arbitrage features
│   │   ├── api/             # TanStack Query hooks (67+ hooks)
│   │   ├── cycles/          # Cycle management pages
│   │   ├── admin/           # Admin panels
│   │   └── my-investments/  # User investment tracking
│   ├── account-settings/    # User account management
│   ├── api/
│   │   └── auth/            # NextAuth routes (ONLY)
│   ├── api-hooks/           # Cross-domain hooks (users)
│   └── brokerage/           # Brokerage features (mocks)
├── components/
│   └── sidebar/             # App-specific components
├── lib/
│   ├── auth.ts              # NextAuth configuration
│   └── utils.ts             # Shared utilities
└── public/                  # Static assets
```

### API Communication Pattern

**Old Pattern (Removed):**
```typescript
// Manual fetch with state management (~30 lines)
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetch("/api/proxy-route").then(...)
}, []);
```

**New Pattern (Current):**
```typescript
// TanStack Query hook (~1 line)
const { data, isLoading } = useSomeEndpoint();
```

**Benefits:**
- 95% less boilerplate
- Automatic caching & refetching
- Type-safe with IntelliSense
- Consistent error handling
- Easy testing with mocks

---

## Data Flow

### User Authentication

```
Browser → Next.js
  → NextAuth (EVE SSO)
  → NestJS API (/auth/*)
  → Prisma → PostgreSQL
```

### API Requests

```
Browser
  → Direct HTTP (clientForApp)
  → NestJS API (CORS enabled)
  → Service Layer
  → Prisma → PostgreSQL
```

**No proxy routes!** Direct communication for performance.

---

## Key Components

### Shared Packages

**1. @eve/api-client**
- `clientForApp(appId, token?)` - HTTP client factory
- Automatic auth token injection (NextAuth or localStorage)
- Custom `ApiError` class with status codes
- Support for both client and server components

**2. @eve/api-client/queryKeys**
- 50+ query key factories across 12 domains
- `_root` keys for domain-level cache invalidation
- Type-safe query keys with IntelliSense

**3. @eve/shared**
- 30+ shared types (User, Cycle, Participation, etc.)
- Enums (CharacterRole, ParticipationStatus, etc.)
- API response types (CycleOverview, CycleProfit, etc.)
- Utility types (PaginatedResponse, ApiErrorResponse)

**4. @eve/prisma**
- Single Prisma schema for entire monorepo
- Generated client used by backend
- Migrations managed centrally

**5. @eve/ui**
- 26+ shadcn components
- Shared across all web apps
- Consistent design system

**6. @eve/eve-core**
- Pure EVE domain helpers and types (ISK math, tick sizing, etc.)
- Framework-agnostic; used by backend services and future tools

**7. @eve/eve-esi**
- Shared ESI client adapter types (fetch options/meta and adapter interface)
- Consumed by NestJS `EsiService` and any future services that speak to ESI

---

## Multi-App Backend & Character Management

To support multiple apps (Tradecraft, Brokerage, Character Management, and future Skill Farm tooling) from a single codebase, the backend is organized into **product-level modules** plus shared infrastructure:

- `CharactersModule` (in `apps/api/src/characters`) owns **auth, users, character linking, guards, strategies, and decorators**.
- `CharacterManagementModule` (in `apps/api/src/character-management`) is a product module that will expose **cross-account character dashboards and management endpoints**.
- `SkillFarmModule` (in `apps/api/src/skill-farm`) is a product module reserved for **skill farm planning and SP/ISK optimization endpoints**.
- Shared infrastructure modules (`EsiModule`, `WalletModule`, `GameDataModule`, `MarketModule`, etc.) remain reusable across product modules.

New feature work should follow these guidelines:

- **Auth/identity concerns** stay in `CharactersModule` and re-use its guards/strategies.
- **Character dashboards and cross-account views** are implemented in `CharacterManagementModule`.
- **Skill farm–specific flows and profit math orchestration** are implemented in `SkillFarmModule`, delegating domain math to `@eve/eve-core` where possible.
- Any ESI-related client code that needs to be shared across apps should depend on `@eve/eve-esi` for types and adapter interfaces.

---

## API Hooks (Frontend)

### Domain Hooks (67+ total)

**Cycles (21 hooks):**
- Queries: overview, list, profit, capital, NAV, entries, lines, etc.
- Mutations: create, plan, open, close, lines, fees, payouts

**Participations (10 hooks):**
- Queries: all, list, me, unmatched donations
- Mutations: create, validate, match, refund, mark sent

**Users & Auth (9 hooks):**
- Queries: current user, my characters, all characters
- Mutations: set primary, unlink
- Utilities: start link, logout

**Pricing, Packages, Wallet, Arbitrage, Admin** (~27 hooks total)

---

## Database Schema

### Key Tables

**Users & Characters:**
- `app_users` - Application users
- `eve_characters` - Linked EVE characters
- `character_tokens` - ESI tokens

**Cycles & Ledger:**
- `cycle` - Trading cycles
- `cycle_line` - Item tracking within cycles
- `cycle_participation` - User investments
- `cycle_ledger_entry` - Financial entries
- `cycle_snapshot` - Capital snapshots
- `cycle_fee_event` - Transport/other fees

**Market Data:**
- `item_types` - EVE item types
- `stations` - EVE stations
- `tracked_stations` - Monitored stations
- `market_order_trades_daily` - Daily aggregates

**Wallet:**
- `wallet_transaction` - Buy/sell transactions
- `wallet_journal_entry` - Journal entries

**Packages:**
- `committed_package` - Hauling packages
- `package_item` - Items in packages

---

## Environment Configuration

### Backend (`apps/api/.env`)
```bash
DATABASE_URL="postgresql://..."
ESI_CLIENT_ID="..."
ESI_CLIENT_SECRET="..."
ESI_CALLBACK_URL="..."
JWT_SECRET="..."
CORS_ORIGINS="http://localhost:3000,..."
PORT=3001
```

### Frontend (`apps/web/.env.local`)
```bash
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
EVE_CLIENT_ID="..."
EVE_CLIENT_SECRET="..."
```

---

## Development Workflow

### Start Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
cd packages/prisma && pnpm run generate

# Start backend
cd apps/api && pnpm run dev

# Start frontend (separate terminal)
cd apps/web && pnpm run dev
```

### Build for Production

```bash
# Build all packages
pnpm build

# Or build individually
cd apps/api && pnpm run build
cd apps/web && pnpm run build
```

### Run Tests

```bash
cd apps/api && pnpm run test
```

---

## Critical User Flows

### 1. User Authentication
1. User clicks "Sign in with EVE Online"
2. Redirected to EVE SSO (`/api/auth/link-character/start`)
3. EVE returns with auth code
4. NextAuth exchanges for tokens
5. User redirected back with session
6. Session stored, `accessToken` used for API calls

### 2. Opt-in to Cycle
1. User views next cycle (`useCycleOverview()`)
2. Clicks "Opt-in now" (OptInDialog)
3. Enters investment amount
4. `useCreateParticipation()` creates participation
5. Backend returns memo (e.g., "ARB-12345678")
6. User sends ISK to logistics character with memo
7. Admin matches payment (`useMatchParticipationPayments()`)
8. Participation validated, user opted in

### 3. Admin Cycle Management
1. Admin plans new cycle (`usePlanCycle()`)
2. Investors opt-in
3. Admin opens cycle (`useOpenCycle()`)
4. Trading occurs
5. Admin closes cycle (`useCloseCycle()`)
   - Imports wallet transactions
   - Allocates to cycle lines
   - Closes cycle
   - Creates payouts
6. Admin marks payouts as sent (`useMarkPayoutSent()`)

---

## API Endpoints

### Public Endpoints
- `GET /ledger/cycles/overview` - Current + next cycle
- `GET /ledger/cycles` - List all cycles
- `GET /ledger/cycles/:id/profit` - Cycle profit
- `GET /ledger/cycles/:id/profit/estimated` - Estimated profit
- `GET /ledger/cycles/:id/profit/portfolio` - Portfolio value

### Authenticated Endpoints
- `POST /ledger/cycles/:id/participations` - Create participation
- `GET /ledger/cycles/:id/participations/me` - My participation
- `POST /ledger/participations/:id/opt-out` - Opt out

### Admin Endpoints
- `POST /ledger/cycles` - Create cycle
- `POST /ledger/cycles/plan` - Plan cycle
- `POST /ledger/cycles/:id/open` - Open cycle
- `POST /ledger/cycles/:id/close` - Close cycle
- `POST /ledger/participations/:id/validate` - Validate payment
- `POST /ledger/participations/match` - Auto-match payments
- `POST /ledger/participations/:id/mark-payout-sent` - Mark sent

**Full API documentation:** `http://localhost:3001/docs` (Swagger)

---

## Testing Strategy

### Backend Tests
- Unit tests for services
- E2E tests for critical flows
- Test files in `apps/api/test/`

### Frontend Testing
- Mock API hooks for component tests
- Query key invalidation testing
- Integration tests for user flows

---

## Deployment

### Backend
- Build: `cd apps/api && pnpm run build`
- Start: `cd apps/api && pnpm run start:prod`
- Migrations: `cd packages/prisma && pnpm run migrate:deploy`

### Frontend
- Build: `cd apps/web && pnpm run build`
- Start: `cd apps/web && pnpm run start`

### Environment Variables
- Set all `.env` variables
- Configure CORS origins for production domains
- Set secure JWT secrets
- Configure ESI credentials

---

## Security

### Authentication
- NextAuth with EVE SSO
- JWT tokens for API authentication
- Session stored in cookies
- CORS restricted to allowed origins

### Authorization
- Role-based access control (USER, ADMIN, LOGISTICS)
- Guards on all admin endpoints
- Ownership validation for user data

---

## Performance Optimizations

### Backend
- Prisma connection pooling
- ESI response caching (ETag/Expires headers)
- Capital snapshot caching (1-hour TTL)
- Parallel ESI requests where possible

### Frontend
- TanStack Query caching (automatic)
- Request deduplication
- Background refetching
- Optimistic updates on mutations
- Direct API calls (no proxy)

---

## Monitoring & Debugging

### Swagger Documentation
- Available at: `http://localhost:3001/docs`
- Interactive API testing
- Schema documentation
- Auth testing with Bearer tokens

### Logging
- Request/response logging interceptor
- BigInt serialization for safe JSON
- Error tracking with stack traces
- Request IDs for tracing

---

## Summary

**EVE Money Making** now features:
- ✅ Clean domain-driven backend architecture
- ✅ Type-safe API communication
- ✅ Modern React patterns (TanStack Query)
- ✅ Comprehensive documentation
- ✅ Production-ready infrastructure
- ✅ Scalable monorepo organization

**Ready for production deployment!** 🚀

