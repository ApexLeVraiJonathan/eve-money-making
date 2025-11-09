<!-- 521ce958-4897-4fa5-8c64-cc78ae39e889 aa033d71-b126-4a2a-b7d2-c7c32d954568 -->
# Consolidated Monorepo Refactor & Cleanup

This plan consolidates insights from three AI-generated reviews plus additional architectural improvements.

## Current State Issues

**Critical deviations identified:**

1. **No packages/ directory** - Shared code doesn't exist (prisma, types, api-client, ui)
2. **~76 Next.js API proxy routes** - Should be direct client calls with TanStack Query
3. **Type duplication** - Types redefined in multiple locations
4. **Prisma misplacement** - Schema in `apps/api/prisma/` instead of `packages/prisma/`
5. **No Swagger documentation** - Missing `@ApiTags`, `@ApiProperty`, Swagger UI
6. **Zod validation without Swagger** - Should use class-validator for Swagger compatibility
7. **Scattered env access** - `process.env` used directly instead of typed helpers
8. **No shared API client** - Custom `fetchWithAuth` instead of `clientForApp` pattern
9. **No centralized query keys** - TanStack Query keys scattered across components
10. **Frontend structure** - Not following `features/<domain>/api.ts` pattern
11. **Mock data in production** - `apps/web/app/arbitrage/_mock/` should use real API
12. **Business logic in controllers** - e.g., `ledger.controller.ts.closeCycle()`
13. **LedgerService too large** - 2493 lines, violates single responsibility principle
14. **Cross-domain Prisma calls** - Services bypass domain boundaries (arbitrage→cycleLine, ledger→eveCharacter)
15. **Dead/legacy code** - Unused methods, duplicate implementations
16. **Inconsistent naming** - Mixed conventions across DTOs, services, methods
17. **Lacking documentation** - Complex algorithms lack comments, services lack JSDoc

---

## Phase 1: Create Packages Infrastructure

### 1.1 Create packages/ directory structure

Create canonical monorepo structure:

- `packages/prisma/` - Single Prisma schema and migrations
- `packages/shared/` - Lightweight types and pure utilities
- `packages/api-client/` - Unified HTTP client with auth support
- `packages/ui/` - Shadcn components shared across web apps
- `packages/api-contracts/` - (Future) OpenAPI/Zod contracts

### 1.2 Move Prisma to packages/

**Current:** `apps/api/prisma/schema.prisma`

**Target:** `packages/prisma/schema.prisma`

- Move schema and migrations folder
- Create `packages/prisma/package.json`
- Update Prisma client generation path
- Update all imports to use package reference

### 1.3 Setup package.json files

Create proper package metadata for `@eve/shared`, `@eve/api-client`, `@eve/ui`, `@eve/prisma`.

### 1.4 Move shared UI components

Move `apps/web/components/ui/*` (26 shadcn components) to `packages/ui/`. Keep app-specific components in `apps/web/components/`.

### 1.5 Update TypeScript configs

Add path aliases: `@eve/shared`, `@eve/api-client`, `@eve/ui`, `@eve/prisma`

### 1.6 Update pnpm-workspace.yaml

Ensure workspace includes `packages/*`

---

## Phase 2: Backend - Add Swagger & Improve Validation

### 2.1 Install Swagger dependencies

```bash
pnpm add @nestjs/swagger class-validator class-transformer -w apps/api
```

### 2.2 Configure Swagger in main.ts

Setup Swagger UI at `/docs` with DocumentBuilder, add global ValidationPipe with whitelist/transform options.

### 2.3 Migrate DTOs from Zod to class-validator

**Priority:** arbitrage → liquidity → packages → auth → others

Convert Zod schemas to class-validator decorators with `@ApiProperty`.

### 2.4 Add Swagger decorators to controllers

Add `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation` to all controllers.

### 2.5 Remove ZodValidationPipe

Delete `apps/api/src/common/zod-validation.pipe.ts` and update controllers.

---

## Phase 3: Backend - Centralize Environment Access

### 3.1 Extend AppConfig

Cover all environment variables: database, ESI credentials, JWT, CORS, ports.

### 3.2 Replace scattered process.env usage

Search and replace in main.ts, auth, esi services.

### 3.3 Create shared env helpers

Create `packages/shared/env.ts` for frontend environment access.

---

## Phase 4: Backend - Refactor Business Logic

### 4.1 Thin controllers

Move `ledger.controller.ts.closeCycle()` orchestration to service. Review all controllers for business logic violations.

### 4.2 Add missing transactions

Add `prisma.$transaction` to `arbitrage.service.ts.commitPlan()` and other multi-step writes.

---

## Phase 5: Backend - Domain Separation & Service Refactoring

### 5.1 Split LedgerService (2493 lines)

**Problem:** Single service handling 8+ responsibilities

**Solution:** Extract into focused services:

```
apps/api/src/ledger/
  ledger.service.ts          - Core cycle CRUD, orchestration
  capital.service.ts         - ESI wallet/asset/order fetching
  participation.service.ts   - Participation CRUD + validation
  payment-matching.service.ts - Fuzzy payment matching (300+ lines)
  profit.service.ts          - Profit computations
  cycle-line.service.ts      - Cycle lines management
  fee-tracking.service.ts    - Broker/relist/transport fees
  snapshot.service.ts        - Cycle snapshots
```

**Example:** `ParticipationService` handles: createParticipation, listParticipations, optOutParticipation, adminValidatePayment, markPayoutAsSent, computePayouts, createPayouts.

### ✅ 5.2 Create domain services to prevent cross-domain access - COMPLETE
**Status:** ✅ Complete (2025-11-09)
**Documentation:** [docs/PHASE_5.2_COMPLETE.md](../docs/PHASE_5.2_COMPLETE.md)
**Build Status:** ✅ Success

**Problem:** Services directly query other domains' Prisma models

**Examples found:**

- `arbitrage.service.ts` line 155: queries `cycleLine` (ledger domain)
- `ledger.service.ts` line 42: queries `eveCharacter` (character domain)
- `ledger.service.ts` line 181: queries `stationId/solarSystemId` (game data domain)

**Solution:** Created 3 domain services with 29 methods:
- CharacterService - Character domain (10 methods)
- GameDataService - Static game data (12 methods)
- MarketDataService - Market data (7 methods)

**Services Refactored:** 8 services, 55+ cross-domain queries eliminated

### 5.3 Remove unused/dead code

**Audit process:**

1. Search for unused exports across all services
2. Remove legacy methods: `finalizePayouts()` (line 1300 - marked "OLD METHOD")
3. Check if `buildOpeningBalanceLines()` is still used

**Known duplicates to consolidate:**

- Cost basis calculation appears 4+ times (lines 106-232, 390-499, 526-554, 1667-1696)
- Jita price fallback duplicated 4+ times (lines 192-206, 470-484, 596-610, 1786-1814)
- WAC computation repeated

Extract to shared utilities or service methods.

### 5.4 Improve naming conventions

**Audit and fix:**

**DTOs:** Enforce `Create{Entity}Dto`, `Update{Entity}Dto`, `List{Entity}QueryDto` patterns

**Service methods:**

- List/query: `findAll()`, `findById()`, `findBy{Criteria}()`
- Create: `create()`
- Update: `update()`
- Delete: `delete()` or `remove()`
- Business logic: verb first - `computeProfit()`, `validatePayment()`

**Private methods:** Prefix with underscore `_methodName()` or use clear descriptive names

**Constants:** `UPPER_SNAKE_CASE` for true constants

**Examples to fix:**

```typescript
// Before
async listCycles()
async getCurrentOpenCycle()
private getTrackedCharacterIds()

// After
async findAllCycles()
async findCurrentOpenCycle()
// Move to CharacterService.findTrackedSellerIds()
```

### 5.5 Add comprehensive documentation

**Service-level JSDoc:**

```typescript
/**
 * Manages cycle lifecycle and orchestrates ledger operations.
 * 
 * Responsibilities:
 * - Cycle CRUD (create, open, close, list)
 * - Coordinate with ParticipationService for investor management
 * 
 * Does NOT handle:
 * - Direct ESI calls (use CapitalService)
 * - Payment matching (use PaymentMatchingService)
 */
@Injectable()
export class LedgerService {...}
```

**Method-level JSDoc for complex methods:**

```typescript
/**
 * Opens a planned cycle for active trading.
 * 
 * Process:
 * 1. Closes any currently open cycle
 * 2. Sets cycle startedAt to now if in future
 * 3. Computes initial capital (carryover + injection + participations)
 * 4. Creates CycleLines for rollover inventory
 * 
 * @param input.cycleId - ID of planned cycle
 * @param input.startedAt - Optional override for start time
 * @returns Opened cycle with initial capital set
 * @throws Error if cycle not found
 */
async openPlannedCycle(input: {...}) {...}
```

**Inline comments for complex algorithms:**

- Document cost basis calculation logic
- Explain payment matching fuzzy logic
- Comment profit computation formulas

**Extract magic numbers:**

```typescript
// Before
const reserve = 100_000_000 * tracked.length;
if (ageMs < 60 * 60 * 1000) {...}

// After
private readonly CASH_RESERVE_PER_CHARACTER_ISK = 100_000_000;
private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const reserve = this.CASH_RESERVE_PER_CHARACTER_ISK * tracked.length;
const isCacheFresh = ageMs < this.CACHE_TTL_MS;
```

---

## Phase 6: Create Shared API Client

### 6.1 Implement clientForApp pattern

Create `packages/api-client/index.ts` with multi-baseURL support, auto-inject Authorization from NextAuth/localStorage.

### 6.2 Create centralized query keys

Create `packages/api-client/queryKeys.ts` with query key factories for all domains (arbitrage, ledger, users, cycles, packages, pricing).

### 6.3 Extract shared types

Move common types to `packages/shared/types/index.ts`: User, Character, Cycle, CycleLine, Participation, Opportunity, Package.

---

## Phase 7: Frontend - Migrate to Direct API Client

### 7.1 Create feature API hook files

Create `api.ts` files using TanStack Query:

- `apps/web/app/arbitrage/api.ts`
- `apps/web/app/ledger/api.ts`
- `apps/web/app/brokerage/api.ts` (keep mocks)

Use pattern: `useQuery` for reads, `useMutation` for writes with proper invalidation.

### 7.2 Update frontend components

Replace `fetchWithAuth` calls with hooks from feature `api.ts`. Update arbitrage, account-settings, and admin pages.

### 7.3 Update auth.ts integration

Modify `apps/web/lib/auth.ts` to work with new client pattern using NextAuth session token.

---

## Phase 8: Frontend - Remove Proxy Routes

### 8.1 Delete Next.js API proxy routes

Delete entire `apps/web/app/api/` directory **except** `apps/web/app/api/auth/[...nextauth]/route.ts`.

This removes ~76 proxy route files.

### 8.2 Update CORS configuration

Ensure `apps/api/src/main.ts` CORS allows web app origin with proper headers.

### 8.3 Verify direct API calls work

Test authenticated endpoints, public endpoints, error handling, preflight requests.

---

## Phase 9: Frontend - Remove Mock Data

### 9.1 Delete arbitrage mock files

Delete `apps/web/app/arbitrage/_mock/store.ts` and `_mock/data.ts`.

Keep `apps/web/app/brokerage/_mock/*` (no backend yet).

### 9.2 Update arbitrage components

Replace mock calls with real API hooks in cycles and my-investments pages.

---

## Phase 10: Final Cleanup & Verification

### 10.1 Remove old utilities

Delete `apps/web/lib/api-client.ts` (replaced by `@eve/api-client`).

### 10.2 Update imports to use packages

Replace relative imports with package imports: `@eve/shared`, `@eve/api-client`, `@eve/ui`.

### 10.3 Verify build and linting

```bash
pnpm build
pnpm lint
pnpm test
```

### 10.4 Test critical user flows

- User authentication (EVE SSO)
- Character linking
- View arbitrage opportunities
- Commit to cycle
- Admin cycle closure
- View ledger and participations
- Admin operations

### 10.5 Update documentation

- Update README files
- Document new package structure and service architecture
- Add architecture diagram showing service boundaries and domain separation
- Document naming conventions and code standards
- Update environment variable examples

---

## Implementation Notes

### Order of Execution

Phases must be done sequentially:

1. Phase 1 - Foundation
2. Phases 2-5 - Backend improvements (can partially overlap)
3. Phase 6 - Shared client
4. Phase 7 - Frontend migration
5. Phase 8 - Remove proxies
6. Phase 9 - Remove mocks
7. Phase 10 - Final verification

### Testing Strategy

After each phase:

- Run `pnpm build` to catch TypeScript errors
- Test affected functionality manually
- Run existing test suites

### Key Benefits

- **Scalability**: Proper monorepo structure, smaller focused services
- **Type Safety**: Shared types prevent frontend/backend drift
- **Performance**: Direct API calls eliminate proxy overhead
- **DX**: Swagger docs, centralized client, clear patterns
- **Maintainability**: Single source of truth, clear domain boundaries
- **Code Quality**: No dead code, consistent naming, comprehensive documentation
- **Testing**: Easier to mock centralized client and focused services
- **Reproducibility**: Clear patterns that scale to new features

### To-dos

- [x] Create packages/ directory structure (prisma, shared, api-client, ui) with proper package.json files and TypeScript path aliases ✅ COMPLETE
- [x] Move Prisma schema and migrations from apps/api/prisma/ to packages/prisma/ and update all references ✅ COMPLETE
- [x] Move shadcn UI components from apps/web/components/ui/ to packages/ui/ and update imports ✅ COMPLETE
- [x] Install @nestjs/swagger, configure Swagger UI at /docs, add global ValidationPipe in main.ts ✅ COMPLETE
- [x] Convert arbitrage DTOs from Zod to class-validator with @ApiProperty decorators ✅ COMPLETE
- [x] Convert remaining DTOs (liquidity, packages, auth, etc.) to class-validator ✅ COMPLETE
- [x] Remove ZodValidationPipe and update controllers to use global ValidationPipe ✅ COMPLETE
- [x] Add @ApiTags, @ApiBearerAuth, and @ApiOperation decorators to all controllers ✅ COMPLETE
- [x] Extend AppConfig to cover all environment variables and replace scattered process.env usage ✅ COMPLETE
- [x] Move business logic from controllers to services (e.g., ledger.controller.ts.closeCycle) ✅ COMPLETE
- [x] Add prisma.$transaction wrappers to multi-step writes like arbitrage.service.ts.commitPlan ✅ COMPLETE
- [ ] Implement clientForApp pattern in packages/api-client with NextAuth session support
- [ ] Create centralized query key factories in packages/api-client/queryKeys.ts for all domains
- [ ] Move common types (User, Cycle, Participation, etc.) to packages/shared/types/ and remove duplicates
- [ ] Create api.ts files with TanStack Query hooks for arbitrage, ledger, and other features
- [ ] Update frontend components to use new API hooks instead of fetchWithAuth
- [ ] Delete apps/web/app/api/ directory except NextAuth route, update CORS config
- [ ] Delete arbitrage mock files and update components to use real API
- [ ] Replace relative imports with package imports (@eve/shared, @eve/api-client, @eve/ui) across codebase
- [ ] Build all packages, run linters and tests, verify critical user flows work