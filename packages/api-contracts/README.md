# @eve/api-contracts

Runtime API contract artifacts (OpenAPI/Zod/tooling outputs).

## Purpose

This package is reserved for:
- OpenAPI specifications
- Zod schemas for request/response validation
- Generated validators or codegen outputs tied to runtime schemas

## Status

🚧 **Placeholder** - app-level request/response TypeScript contracts live in `@eve/shared/*`.

## Future Usage

```typescript
import { UserSchema } from '@eve/api-contracts';
import type { UserDto } from '@eve/shared/some-feature';

const result = UserSchema.parse(data);
const dto: UserDto = { id: '1', name: 'John' };
```

