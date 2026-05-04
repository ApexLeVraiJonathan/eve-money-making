# Packages

Shared packages used across the EVE Money Making monorepo.

## Structure

### [@eve/shared](./shared/)
Lightweight types and pure utilities. No dependencies.

**Exports:**
- `@eve/shared/<feature>` - Focused shared contracts, such as `@eve/shared/tradecraft-cycles`
- `@eve/shared/env` - Frontend environment helpers

### [@eve/api-client](./api-client/)
The **only** HTTP client for web apps. Provides unified API access with auth support.

**Exports:**
- `@eve/api-client` - Main client (`clientForApp`)
- `@eve/api-client/queryKeys` - Centralized TanStack Query keys

### [@eve/ui](./ui/)
Shadcn component library shared across all web apps.

**Exports:**
- `@eve/ui` - UI components (will be populated in Phase 1.4)

### [@eve/prisma](./prisma/)
Single Prisma schema and migrations for the entire monorepo.

**Exports:**
- `@eve/prisma` - Prisma Client instance

### [@eve/api-contracts](./api-contracts/)
🚧 **Runtime tooling** - OpenAPI/Zod/schema artifacts (app TypeScript contracts live in `@eve/shared/*`)

## Usage Guidelines

### In Apps

**Frontend (Next.js):**
```typescript
import { clientForApp } from '@eve/api-client';
import { qk } from '@eve/api-client/queryKeys';
import type { CycleOverviewResponse } from '@eve/shared/tradecraft-cycles';
import { Button } from '@eve/ui';
```

**Backend (NestJS):**
```typescript
import { PrismaClient } from '@eve/prisma';
import type { CharacterOverviewResponse } from '@eve/shared/character-management';
```

### Rules

- ✅ Apps share code **only** via packages
- ❌ Apps must **never** import from each other
- ✅ Use package imports: `@eve/*`
- ✅ Use explicit shared subpaths: `@eve/shared/tradecraft-cycles`, not `@eve/shared`
- ❌ Don't duplicate types, clients, or components in apps

## Development

All packages use TypeScript with strict mode enabled. Build with:

```bash
pnpm build
```


