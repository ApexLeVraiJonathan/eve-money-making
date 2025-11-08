# @eve/api-contracts

OpenAPI/Zod contracts and generated TypeScript types (Future).

## Purpose

This package will contain:
- OpenAPI specifications
- Zod schemas for request/response validation
- Generated TypeScript types from OpenAPI specs
- Shared contracts between frontend and backend

## Status

🚧 **Placeholder** - This package will be populated during Phase 2 when Swagger is implemented.

## Future Usage

```typescript
import { UserSchema, CreateUserDto } from '@eve/api-contracts';

// Use for validation
const result = UserSchema.parse(data);

// Use for type safety
const dto: CreateUserDto = { name: 'John' };
```

