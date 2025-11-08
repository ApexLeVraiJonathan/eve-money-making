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
import type { User, Cycle } from "@eve/shared/types";
import { getApiBaseUrl } from "@eve/shared/env";
```

## Structure

- `src/types/` - Shared TypeScript types
- `src/env.ts` - Frontend environment variable helpers
- `src/index.ts` - Main exports
