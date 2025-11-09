<!-- c92e829b-7cf4-4ee3-9b98-9022ed982361 430637d3-020c-4036-87ec-89ea3c19be32 -->
# Production-Ready Polish & Architecture Cleanup

## Executive Summary

Transform the POC into a maintainable production-ready codebase optimized for solo development. Focus on completing half-done migrations, establishing clear patterns, adding essential testing, and documenting for future-you.

**Timeline**: ~2-3 weeks of focused work

**Goal**: Solid foundation to build new features confidently

---

## Phase 1: Complete Frontend Migration (HIGH PRIORITY)

**Problem**: Admin pages still fetch from `/api/` routes that were deleted in Phase 8. Several components use inconsistent patterns.

### 1.1 Complete Missing API Hooks

**Create remaining hooks** in `apps/web/app/arbitrage/api/`:

- `pricing.ts` - Pricing endpoints (sell appraise, undercut check, confirm listing/reprice)
- `packages.ts` - Package management (list, status updates, mark failed)  
- `wallet.ts` - Wallet imports and transactions
- `admin.ts` - Admin-specific endpoints (metrics, jobs, user management)
- `game-data.ts` - Game data queries (types, stations, tracked stations)

**Estimated**: ~40-50 additional hooks

### 1.2 Migrate Remaining Admin Pages

**Files to migrate** (11 components):

- `apps/web/app/arbitrage/admin/page.tsx` - Still uses `fetch('/api/metrics')`, etc.
- `apps/web/app/arbitrage/admin/planner/page.tsx`
- `apps/web/app/arbitrage/admin/packages/page.tsx`
- `apps/web/app/arbitrage/admin/sell-appraiser/page.tsx`
- `apps/web/app/arbitrage/admin/undercut-checker/page.tsx`
- `apps/web/app/arbitrage/admin/triggers/*.tsx` (5 files)

**Pattern to follow**:

```typescript
// ❌ OLD (direct fetch)
const res = await fetch('/api/metrics');
const data = await res.json();

// ✅ NEW (API hook)
const { data, isLoading, error } = useMetrics();
```

### 1.3 Create Frontend Environment Helper

**Problem**: `process.env` accessed directly in 11 frontend files

**Create** `packages/shared/src/env.ts`:

```typescript
export const clientEnv = {
  apiUrl: () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  nextAuthUrl: () => process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  isDev: () => process.env.NODE_ENV === 'development',
  isProd: () => process.env.NODE_ENV === 'production',
};
```

**Update files**:

- `packages/api-client/src/index.ts` - Use `clientEnv.apiUrl()`
- `apps/web/lib/auth.ts` - Use `clientEnv.nextAuthUrl()`
- All frontend files accessing `process.env`

### 1.4 Delete Remaining Proxy Routes

**Delete** (after migration):

- `apps/web/app/api/auth/me/route.ts` - Replace with direct hook
- `apps/web/app/api/auth/characters/route.ts` - Replace with direct hook

**Keep only**: `apps/web/app/api/auth/[...nextauth]/route.ts` and auth flow routes

---

## Phase 2: Component Architecture Cleanup (MEDIUM PRIORITY)

**Problem**: Several components are 400-700 lines, violating single responsibility principle.

### 2.1 Break Down Large Components

**Extract sub-components** from:

- `apps/web/app/arbitrage/admin/page.tsx` (540 lines)
  - Extract: `MetricsCards`, `CapitalPieChart`, `ProfitLineChart`, `QuickActions`
- `apps/web/app/arbitrage/admin/participations/page.tsx` (718 lines)
  - Extract: `ParticipationsTable`, `UnmatchedDonationsTable`, `ManualMatchDialog`
- `apps/web/app/arbitrage/admin/lines/page.tsx` (445 lines)
  - Extract: `CycleLinesTable`, `AddLineDialog`, `FeeDialogs`

**Create**: `apps/web/app/arbitrage/admin/components/` directory

### 2.2 Establish Layout Patterns

**Problem**: Inconsistent page layouts, duplicated structure

**Create**: `apps/web/app/arbitrage/admin/_components/admin-layout.tsx`

```typescript
// Standard admin page layout with header, description, actions
export function AdminPageLayout({ title, description, actions, children })
```

**Benefits**:

- Consistent spacing and structure
- Easy to update all admin pages at once
- Follows DRY principle

### 2.3 Create Reusable Data Tables

**Problem**: Table code duplicated across 6+ pages

**Create**: `packages/ui/src/data-table.tsx`

- Sortable columns
- Pagination controls  
- Loading skeletons
- Empty states
- Action menus

**Use shadcn's data-table pattern** as base

---

## Phase 3: Testing Foundation (HIGH PRIORITY)

**Current State**: 5 backend unit tests, 0 frontend tests, 6 e2e tests

### 3.1 Backend Testing Setup

**Add to existing** `apps/api/test/`:

**Domain Logic Tests** (priority services):

- `apps/api/src/cycles/services/*.spec.ts` - 8 service files
  - Focus on: `profit.service.spec.ts`, `participation.service.spec.ts`, `payout.service.spec.ts`
- `apps/api/src/market/services/arbitrage.service.spec.ts`
- `apps/api/src/wallet/services/allocation.service.spec.ts`

**Test Pattern**:

```typescript
describe('ProfitService', () => {
  let service: ProfitService;
  let prisma: PrismaService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ProfitService, PrismaService],
    }).compile();
    service = module.get(ProfitService);
    prisma = module.get(PrismaService);
  });

  it('should calculate cycle profit correctly', async () => {
    // Test critical business logic
  });
});
```

**Target**: 60-70% coverage of service layer (not 100% - pragmatic)

### 3.2 Frontend Testing Setup

**Install Vitest + React Testing Library**:

```bash
cd apps/web
pnpm add -D vitest @testing-library/react @testing-library/user-event jsdom
```

**Create**:

- `apps/web/vitest.config.ts`
- `apps/web/test/setup.ts`
- `apps/web/test/utils.tsx` - Test wrapper with QueryClient, theme providers

**Priority Test Files**:

- `apps/web/app/arbitrage/api/cycles.test.ts` - Test API hooks with MSW
- `apps/web/app/arbitrage/cycles/page.test.tsx` - Test critical user flow
- `apps/web/components/ui/data-table.test.tsx` - Test reusable components

**Test Pattern**:

```typescript
import { renderWithProviders } from '@/test/utils';

test('displays cycle overview', async () => {
  const { getByText } = renderWithProviders(<CyclesPage />);
  await waitFor(() => expect(getByText('Current Cycle')).toBeInTheDocument());
});
```

**Target**: Essential flows tested (not every component)

### 3.3 E2E Critical Path Tests

**Extend existing** `apps/api/test/*.e2e-spec.ts`:

**Add scenarios**:

- Complete cycle lifecycle (create → invest → close → payout)
- Arbitrage opportunity → package planning → commit flow
- Character linking → wallet import → transaction allocation

**Tools**: Keep existing NestJS e2e test setup

---

## Phase 4: Database Optimization (MEDIUM PRIORITY)

**Problem**: Missing indexes, no query performance monitoring

### 4.1 Add Missing Indexes

**Analyze** `packages/prisma/schema.prisma`:

**Add indexes** for common queries:

```prisma
model WalletTransaction {
  @@index([characterId, date])
  @@index([allocatedToCycleLineId])
  @@index([typeId, date])
}

model CycleLine {
  @@index([cycleId, typeId])
  @@index([destinationStationId])
}

model CycleParticipation {
  @@index([cycleId, status])
  @@index([userId, cycleId])
}
```

**Generate migration**: `pnpm --filter @eve/prisma prisma migrate dev`

### 4.2 Add Query Performance Logging

**Create**: `apps/api/src/common/prisma-logging.interceptor.ts`

```typescript
// Log slow queries (>500ms) in development
```

**Enable** in `PrismaService`:

```typescript
this.$on('query', (e) => {
  if (e.duration > 500) {
    logger.warn(`Slow query: ${e.duration}ms - ${e.query}`);
  }
});
```

### 4.3 Add Connection Pooling Config

**Update** `packages/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection pooling for production
  // connection_limit = 10
  // pool_timeout = 2
}
```

**Document** in `env.example.md`

---

## Phase 5: Error Handling & Developer Experience (HIGH PRIORITY)

### 5.1 Standardize Error Responses

**Problem**: Inconsistent error shapes across API

**Create**: `apps/api/src/common/api-error.ts`

```typescript
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown
  ) {}
}

// Usage: throw new ApiError('Cycle not found', 404, 'CYCLE_NOT_FOUND');
```

**Update**: Global exception filter to use consistent shape

### 5.2 Add Request Logging

**Enhance**: `apps/api/src/common/logging.interceptor.ts`

- Log all requests with timing
- Include userId when authenticated
- Mask sensitive data (tokens, passwords)

### 5.3 Frontend Error Boundaries

**Create**: `apps/web/app/error.tsx` and `apps/web/app/arbitrage/error.tsx`

```typescript
'use client';
export default function Error({ error, reset }) {
  // User-friendly error display with retry
}
```

### 5.4 Add React Query DevTools

**Install**: `@tanstack/react-query-devtools`

**Add** to `apps/web/components/query-provider.tsx`:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## Phase 6: Documentation & Patterns (HIGH PRIORITY)

**Goal**: Help future-you understand and maintain the codebase

### 6.1 Create Developer Guide

**Create**: `docs/DEVELOPER_GUIDE.md`

**Contents**:

- How to add a new feature (step-by-step)
- How to add a new API endpoint
- How to create a new frontend page
- How to add a new background job
- Common patterns and anti-patterns
- Debugging tips
- Performance optimization checklist

### 6.2 Document API Hook Patterns

**Create**: `apps/web/app/arbitrage/api/README.md`

**Contents**:

- How to create new API hooks
- Query vs mutation patterns
- Cache invalidation strategies
- Error handling patterns
- Loading states
- Optimistic updates

### 6.3 Update Architecture Documentation

**Update**: `docs/ARCHITECTURE.md`

- Add database schema diagram
- Add API flow diagrams
- Document critical user flows
- Add decision records for major choices

### 6.4 Create Package READMEs

**Add/update** README in each package:

- `packages/api-client/README.md` - Usage examples
- `packages/shared/README.md` - Type catalog
- `packages/ui/README.md` - Component showcase
- `packages/prisma/README.md` - Schema overview, migration guide

### 6.5 Add Inline Documentation

**Add JSDoc** to complex functions:

- `apps/api/src/cycles/services/profit.service.ts` - Profit calculations
- `apps/api/src/wallet/services/allocation.service.ts` - Transaction matching
- `apps/api/src/market/services/arbitrage.service.ts` - Opportunity detection

**Focus on**: Why, not what (code shows what, docs explain why)

---

## Phase 7: CI/CD & Automation (MEDIUM PRIORITY)

### 7.1 GitHub Actions Workflows

**Create**: `.github/workflows/ci.yml`

**Jobs**:

- Lint (ESLint + Prettier)
- Type check (TypeScript)
- Test (backend unit + e2e)
- Test (frontend unit)
- Build (all packages + apps)

**Run on**: Pull requests + main branch

### 7.2 Pre-commit Hooks

**Install**: Husky + lint-staged

**Add**: `.husky/pre-commit`

```bash
npx lint-staged
```

**Configure**: `package.json`

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### 7.3 Automated Database Backups

**Create**: Script to backup production database

**Document**: Backup and restore procedures in `apps/api/DEPLOYMENT.md`

### 7.4 Health Check Endpoints

**Add**: `apps/api/src/health/health.controller.ts`

- `/health` - Basic uptime check
- `/health/db` - Database connection check
- `/health/esi` - ESI API connectivity check

---

## Phase 8: Performance & Production Readiness (LOW PRIORITY)

### 8.1 Add Response Caching

**Add** HTTP caching headers for public endpoints:

```typescript
@CacheControl('public, max-age=60')
@Get('tracked-stations')
```

### 8.2 Frontend Performance

**Add**:

- Image optimization (already using Next.js Image)
- Code splitting for admin pages (React.lazy)
- Prefetch critical queries on hover

### 8.3 Database Query Optimization

**Review and optimize**:

- Add `select` to limit fields in large queries
- Use `cursor` pagination for large lists
- Batch ESI requests where possible

### 8.4 Add Rate Limiting

**Install**: `@nestjs/throttler`

**Configure**: 100 requests/minute per IP for public endpoints

---

## Phase 9: Security Hardening (MEDIUM PRIORITY)

### 9.1 Environment Variable Validation

**Create**: `apps/api/src/common/env.validator.ts`

```typescript
export function validateRequiredEnv() {
  const required = ['DATABASE_URL', 'ESI_CLIENT_ID', 'ESI_CLIENT_SECRET', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
```

**Call** in `main.ts` before bootstrap

### 9.2 Add Input Sanitization

**Ensure**: All DTOs use proper validation

- Check for SQL injection risks
- Validate numeric ranges
- Sanitize string inputs

### 9.3 Add Security Headers

**Install**: `helmet`

**Add** to `main.ts`:

```typescript
app.use(helmet());
```

### 9.4 Review Auth Guards

**Audit**: All sensitive endpoints have proper guards

- Admin endpoints require `@Roles('ADMIN')`
- User endpoints require authentication
- Public endpoints explicitly marked `@Public()`

---

## Phase 10: Final Polish & Verification (HIGH PRIORITY)

### 10.1 Code Quality Audit

**Run**:

```bash
# Lint all code
pnpm lint

# Type check all packages
pnpm type-check

# Run all tests
pnpm test

# Build all packages
pnpm build
```

**Fix** all errors and warnings

### 10.2 Dependency Audit

**Run**:

```bash
pnpm audit
pnpm outdated
```

**Update**: Dependencies with security vulnerabilities

**Document**: Major version upgrades needed

### 10.3 Clean Up Dead Code

**Remove**:

- Unused imports
- Commented-out code
- Dead files (mock data, old utilities)
- Unused dependencies

**Tools**: Use ESLint unused vars rule

### 10.4 Update README Files

**Ensure** all READMEs are accurate:

- Root `README.md` - Project overview
- `apps/api/README.md` - Backend setup
- `apps/web/README.md` - Frontend setup
- Package READMEs - API documentation

### 10.5 Create Migration Checklist

**Document**: What to check before deploying

**Create**: `docs/DEPLOYMENT_CHECKLIST.md`

- Environment variables set
- Database migrations run
- Secrets rotated
- Health checks passing
- Backups configured

---

## Implementation Order (Recommended)

**Week 1** (Foundation):

1. Phase 1.1-1.2: Complete frontend migration (~3 days)
2. Phase 5.1-5.2: Error handling & logging (~1 day)
3. Phase 6.1-6.3: Core documentation (~2 days)

**Week 2** (Quality):

4. Phase 3.1: Backend testing setup (~2 days)
5. Phase 3.2: Frontend testing setup (~2 days)
6. Phase 2.1-2.2: Component cleanup (~2 days)

**Week 3** (Production Ready):

7. Phase 4.1: Database optimization (~1 day)
8. Phase 7.1-7.2: CI/CD setup (~2 days)
9. Phase 9: Security hardening (~2 days)
10. Phase 10: Final audit (~1 day)

**Optional** (as needed):

- Phase 8: Performance optimization
- Remaining documentation tasks

---

## Success Criteria

**You'll know you're done when**:

- ✅ All components use API hooks (no direct fetch)
- ✅ All critical paths have tests
- ✅ CI/CD pipeline runs on every commit
- ✅ Documentation helps you add new features easily
- ✅ No ESLint/TypeScript errors
- ✅ Build completes successfully
- ✅ You feel confident deploying to production

---

## Benefits for Solo Development

**Immediate**:

- Consistent patterns → Less time deciding "how" to do things
- Good error messages → Faster debugging
- Tests → Catch bugs before production

**Long-term**:

- Documentation → Help yourself in 6 months
- CI/CD → Reduce deployment stress
- Type safety → Refactor with confidence
- Clear architecture → Add features predictably

---

## Deferred Items (Not in This Refactor)

**Don't do now** (wait for real need):

- Advanced monitoring (Sentry, DataDog)
- Complex scaling patterns
- Microservices architecture
- Advanced caching strategies
- Feature flags system
- Multi-tenancy
- Internationalization

**Reason**: YAGNI (You Aren't Gonna Need It) - Build these when you actually need them.

### To-dos

- [ ] Create remaining API hooks (pricing, packages, wallet, admin, game-data) - ~40-50 hooks total
- [ ] Migrate 11 admin pages from fetch to API hooks (admin dashboard, planner, packages, sell-appraiser, undercut-checker, triggers)
- [ ] Create packages/shared/src/env.ts and replace all direct process.env usage in frontend (11 files)
- [ ] Delete remaining proxy routes (apps/web/app/api/auth/me and characters) after migration complete
- [ ] Extract sub-components from 3 large admin pages (540, 718, 445 lines) into apps/web/app/arbitrage/admin/components/
- [ ] Create AdminPageLayout component for consistent structure across admin pages
- [ ] Create reusable DataTable component in packages/ui using shadcn pattern
- [ ] Add unit tests for 8 cycle services (focus on profit, participation, payout) targeting 60-70% coverage
- [ ] Setup Vitest + React Testing Library, create test utils, add tests for critical API hooks and pages
- [ ] Add e2e tests for complete cycle lifecycle, arbitrage flow, and character linking flow
- [ ] Add missing indexes to WalletTransaction, CycleLine, CycleParticipation tables and generate migration
- [ ] Add slow query logging (>500ms) to PrismaService for development debugging
- [ ] Create ApiError class and update global exception filter for consistent error responses
- [ ] Enhance LoggingInterceptor with timing, userId, and sensitive data masking
- [ ] Add error.tsx files for app-level and arbitrage-level error handling
- [ ] Add React Query DevTools to QueryProvider for debugging
- [ ] Create docs/DEVELOPER_GUIDE.md with step-by-step patterns for adding features
- [ ] Create apps/web/app/arbitrage/api/README.md documenting hook patterns
- [ ] Update docs/ARCHITECTURE.md with diagrams and decision records
- [ ] Create/update READMEs for all 4 packages with usage examples
- [ ] Create .github/workflows/ci.yml with lint, type-check, test, and build jobs
- [ ] Setup Husky + lint-staged for automated pre-commit linting
- [ ] Add /health, /health/db, and /health/esi endpoints for monitoring
- [ ] Create env.validator.ts to check required environment variables at startup
- [ ] Add Helmet middleware for security headers
- [ ] Audit all API endpoints to ensure proper authentication/authorization guards
- [ ] Run lint, type-check, test, and build across entire monorepo and fix all issues
- [ ] Run pnpm audit and update dependencies with security vulnerabilities
- [ ] Remove unused imports, commented code, dead files, and unused dependencies
- [ ] Verify and update all README files (root, apps, packages) for accuracy
- [ ] Create docs/DEPLOYMENT_CHECKLIST.md with pre-deployment verification steps