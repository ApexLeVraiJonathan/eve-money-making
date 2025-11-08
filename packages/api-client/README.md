# @eve/api-client

Unified HTTP client for all web applications.

## Purpose

The **only** HTTP client used by web apps. Provides:
- Multi-baseURL support via `appId` parameter
- Automatic Authorization header injection
- Consistent error handling
- Centralized query key factories for TanStack Query

## Usage

### Basic Client

```typescript
import { clientForApp } from '@eve/api-client';

const client = clientForApp('web-portal');

// GET request
const users = await client.get<User[]>('/users');

// POST request
const newUser = await client.post<User>('/users', { name: 'John' });
```

### Query Keys

```typescript
import { qk } from '@eve/api-client/queryKeys';
import { useQuery } from '@tanstack/react-query';

function useUsers() {
  return useQuery({
    queryKey: qk.users.list(),
    queryFn: () => client.get<User[]>('/users'),
  });
}
```

## Anti-patterns

❌ Don't create a second HTTP client in an app  
❌ Don't duplicate query keys in components  
✅ Always use `clientForApp` and `qk` from this package

