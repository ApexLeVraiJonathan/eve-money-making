# EVE Money Making - Monorepo

A comprehensive platform for managing EVE Online arbitrage trading cycles, tracking investor participations, and optimizing profit distribution.

---

## Architecture

### Monorepo Structure

```
eve-money-making/
├── apps/
│   ├── api/          # NestJS backend API
│   └── web/          # Next.js frontend
├── packages/
│   ├── api-client/   # Shared HTTP client (@eve/api-client)
│   ├── shared/       # Shared types & utilities (@eve/shared)
│   ├── prisma/       # Database schema & client (@eve/prisma)
│   └── ui/           # Shadcn UI components (@eve/ui)
└── docs/             # Comprehensive documentation
```

### Tech Stack

**Backend:**
- NestJS
- Prisma + PostgreSQL
- Swagger/OpenAPI
- class-validator

**Frontend:**
- Next.js 15 (App Router)
- TanStack Query
- Shadcn UI
- TypeScript

**Shared:**
- pnpm workspaces
- TypeScript
- Prettier + ESLint

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+
- PostgreSQL database
- EVE Online Developer Application

### Installation

```bash
# Install all dependencies
pnpm install

# Generate Prisma client
cd packages/prisma
pnpm run generate
pnpm run migrate:deploy
```

### Development

```bash
# Terminal 1: Start backend
cd apps/api
pnpm run dev
# API: http://localhost:3001/api
# Swagger: http://localhost:3001/docs

# Terminal 2: Start frontend
cd apps/web
pnpm run dev
# Web: http://localhost:3000
```

### Build All

```bash
# From root
pnpm build

# Or individually
cd apps/api && pnpm run build
cd apps/web && pnpm run build
```

---

## Key Features

### For Users
- **EVE SSO Authentication** - Secure character linking
- **Cycle Participation** - Opt-in to trading cycles with ISK
- **Investment Tracking** - View returns, profit, ROI
- **Real-time Updates** - Live capital & profit calculations

### For Admins
- **Cycle Management** - Create, open, close cycles
- **Payment Matching** - Fuzzy matching of investor payments
- **Profit Distribution** - Automated payout calculations
- **Item Tracking** - Detailed cycle line management
- **Admin Dashboard** - Comprehensive operations panel

### Technical Features
- **Domain-Driven Backend** - 6 clean domains, 9 focused services
- **Type-Safe API** - Shared types prevent drift
- **Modern Frontend** - TanStack Query hooks, zero boilerplate
- **Direct API Calls** - No proxy routes, better performance
- **Comprehensive Docs** - Swagger API docs + guides

---

## Documentation

### Architecture & Guides
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Complete architecture overview
- **[CRITICAL_USER_FLOWS.md](docs/CRITICAL_USER_FLOWS.md)** - Testing guide
- **[REFACTOR_COMPLETE_SUMMARY.md](docs/REFACTOR_COMPLETE_SUMMARY.md)** - Refactor summary

### Phase Documentation
- **[PHASE_5_COMPLETE_SUMMARY.md](docs/PHASE_5_COMPLETE_SUMMARY.md)** - Backend refactor
- **[PHASE_6_COMPLETE.md](docs/PHASE_6_COMPLETE.md)** - API client infrastructure
- **[PHASE_7_100_PERCENT_COMPLETE.md](docs/PHASE_7_100_PERCENT_COMPLETE.md)** - Frontend migration
- **[PHASE_8_COMPLETE.md](docs/PHASE_8_COMPLETE.md)** - Proxy route removal

### App-Specific
- **[apps/api/README.md](apps/api/README.md)** - Backend setup & architecture
- **[apps/web/README.md](apps/web/README.md)** - Frontend patterns & hooks

---

## Project Highlights

### Backend
- **6 domains** with clear boundaries (characters, cycles, market, wallet, game-data, infra)
- **9 focused cycle services** (all <300 lines, was 1 monolith of 2,308 lines)
- **Zero code duplication** (eliminated 250+ lines)
- **100% service documentation** with JSDoc
- **Domain services** prevent cross-domain coupling

### Frontend
- **67+ API hooks** across 9 domain files
- **15 components migrated** from manual fetch to hooks
- **~700 lines of boilerplate removed**
- **Type-safe** with full IntelliSense
- **Direct API communication** (no Next.js proxy)

### Packages
- **@eve/api-client** - Unified HTTP client with auth support
- **@eve/shared** - 30+ shared types
- **@eve/prisma** - Centralized database schema
- **@eve/ui** - 26+ Shadcn components

---

## Development Workflow

### Adding a New Feature

1. **Backend:**
   - Add service methods in appropriate domain
   - Create DTOs with `@ApiProperty` decorators
   - Add controller endpoint with `@ApiOperation`
   - Update Swagger tags

2. **Frontend:**
   - Add hook in `app/arbitrage/api/*.ts`
   - Use hook in component
   - Handle loading/error states automatically

3. **Types:**
   - Add shared types to `packages/shared/src/types/index.ts`
   - Use in both frontend and backend

### Testing

```bash
# Backend tests
cd apps/api
pnpm run test
pnpm run test:e2e

# Frontend (when added)
cd apps/web
pnpm run test
```

---

## Environment Setup

### Backend (.env)
```bash
DATABASE_URL="postgresql://..."
ESI_CLIENT_ID="..."
ESI_CLIENT_SECRET="..."
ESI_CALLBACK_URL="http://localhost:3000/api/auth/callback/eveonline"
JWT_SECRET="..."
PORT=3001
CORS_ORIGINS="http://localhost:3000"
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
EVE_CLIENT_ID="..." # Same as backend
EVE_CLIENT_SECRET="..." # Same as backend
```

---

## Deployment

### Build

```bash
# Build all packages
pnpm build
```

### Environment Variables

Set production values for:
- Database URL
- ESI credentials
- API URLs
- Auth secrets
- CORS origins

### Run Production

```bash
# Backend
cd apps/api
pnpm run start:prod

# Frontend
cd apps/web
pnpm run start
```

---

## Key Patterns

### API Hooks
- **Queries:** `use*()` - Auto-fetching, caching, refetching
- **Mutations:** `use*()` - Optimistic updates, cache invalidation
- **Query Keys:** Centralized in `@eve/api-client/queryKeys`

### Component Patterns
- **Client Components:** Use hooks directly
- **Server Components:** Use `auth()` + `clientForApp(appId, token)`
- **Error Handling:** Automatic via hooks
- **Loading States:** Built-in via `isLoading`

### Type Safety
- **Shared Types:** Import from `@eve/shared`
- **API Responses:** Typed via generics `client.get<Type>(...)`
- **Hooks:** Fully typed with IntelliSense

---

## Contributing

### Code Style
- **TypeScript:** Strict mode
- **Formatting:** Prettier (auto-format on save)
- **Linting:** ESLint with Next.js config
- **Naming:** Follow existing conventions

### Documentation
- **Services:** JSDoc on all exported methods
- **Hooks:** JSDoc with usage examples
- **Complex logic:** Inline comments

---

## License

MIT

---

## Support

For questions or issues, see documentation in `docs/` directory or check the comprehensive guides linked above.

