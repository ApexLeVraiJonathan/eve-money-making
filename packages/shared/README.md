# @eve/shared

Lightweight types and pure utilities shared across the monorepo.

## Purpose

This package contains:

- **Types**: Shared TypeScript interfaces and types used by both frontend and backend
- **Pure utilities**: Stateless helper functions with no dependencies
- **Environment helpers**: Typed access to environment variables (frontend only)

## Guidelines

- ✅ Keep it lightweight - no heavy dependencies
- ✅ No environment access in types or utilities (use `env.ts` for that)
- ✅ Types should be the single source of truth
- ❌ Don't add business logic here - that belongs in apps

## Usage

```typescript
import type { CycleOverviewResponse } from "@eve/shared/tradecraft-cycles";
import { getApiBaseUrl } from "@eve/shared/env";
```

## Structure

- `src/types/` - Shared TypeScript types
- `src/<feature>.ts` - Public subpath contract modules exported from `package.json`
- `src/env.ts` - Frontend environment variable helpers

Current character skill contracts live in `src/skill-contracts.ts` and cover character skills, training queues, the skill catalog, and the skill encyclopedia. Retired skill-plan, skill-farm, and skill-issue product contracts are intentionally not exported.

There is intentionally no legacy `src/types/index.ts` barrel. Consumers should import focused public subpaths such as `@eve/shared/tradecraft-cycles` or `@eve/shared/skill-contracts`.
