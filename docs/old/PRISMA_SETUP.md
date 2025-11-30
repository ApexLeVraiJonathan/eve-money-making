# Prisma Package Setup Guide

## Overview

The Prisma schema and migrations have been centralized in `packages/prisma/` to provide a single source of truth for database access across the monorepo.

## Initial Setup

### 1. Configure Environment Variables

The Prisma package needs its own `.env` file with the `DATABASE_URL`.

**Option A: For Development (Docker Compose)**

```bash
cd packages/prisma
cp .env.example .env
```

The example file already contains the dev database URL:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public"
```

**Option B: For Production**

Edit `packages/prisma/.env`:
```
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
```

### 2. Generate Prisma Client

From workspace root:
```bash
pnpm db:generate
```

Or from the package:
```bash
cd packages/prisma
pnpm prisma:generate
```

This generates the Prisma Client to `packages/prisma/client/`.

### 3. Start Development Database (Optional)

If using Docker Compose for local development:

```bash
# From workspace root
pnpm db:up
```

This starts PostgreSQL on port 5433.

## Multiple Environment Variables

If you need different database URLs for different environments:

### packages/prisma/.env
```bash
# Default for Prisma CLI commands
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public"

# Test database
DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5433/eve_money_test?schema=public"
```

### apps/api/.env
```bash
# API uses this at runtime (can override DATABASE_URL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public"

# Plus other API-specific env vars
ESI_CLIENT_ID_DEV="..."
EVE_CLIENT_ID="..."
# etc.
```

## Running Migrations

### Development
```bash
# From workspace root
pnpm --filter @eve/prisma run prisma migrate dev

# Or directly
cd packages/prisma
pnpm prisma:migrate:dev
```

### Production
```bash
# From workspace root
pnpm db:migrate:deploy

# Or with explicit DATABASE_URL
DATABASE_URL="postgresql://..." pnpm db:migrate:deploy
```

## Common Commands

All commands can be run from workspace root:

```bash
# Generate Prisma Client
pnpm db:generate

# Apply migrations (production)
pnpm db:migrate:deploy

# Open Prisma Studio
pnpm db:studio

# Start dev database
pnpm db:up

# Stop dev database
pnpm db:down

# Reset dev database
pnpm db:reset
```

## Troubleshooting

### "Environment variable not found: DATABASE_URL"

**Solution:** Create `packages/prisma/.env` with DATABASE_URL:
```bash
cd packages/prisma
cp .env.example .env
# Edit .env with your database URL
```

### Prisma Client not generated

**Solution:** Run the generate command:
```bash
pnpm db:generate
```

### Import errors: "Cannot find module '@eve/prisma'"

**Solution:** Ensure dependencies are installed and client is generated:
```bash
pnpm install
pnpm db:generate
```

### Different DATABASE_URL for apps vs Prisma commands

This is normal! The Prisma CLI reads from `packages/prisma/.env`, while apps read from their own `.env` files (e.g., `apps/api/.env`).

**Best practice:** Keep them in sync manually, or use a shared .env at workspace root.

## Architecture

```
packages/prisma/
├── schema.prisma          # Single schema for monorepo
├── migrations/            # All database migrations
├── client/                # Generated Prisma Client (gitignored)
├── .env                   # DATABASE_URL for Prisma CLI
├── .env.example           # Template
└── package.json           # @eve/prisma package

apps/api/
└── .env                   # API runtime env vars (includes DATABASE_URL)

apps/web/
└── .env.local             # Web app env vars
```

## Benefits

- ✅ Single source of truth for database schema
- ✅ Consistent types across all apps
- ✅ Centralized migration management
- ✅ Easy to add new apps that need database access
- ✅ Clear separation of concerns

## Next Steps

After setup, you can:

1. Import Prisma Client in your apps:
   ```typescript
   import { PrismaClient } from '@eve/prisma';
   ```

2. Use shared types:
   ```typescript
   import type { User, Cycle, Prisma } from '@eve/prisma';
   ```

3. Create migrations:
   ```bash
   cd packages/prisma
   pnpm prisma migrate dev --name my_migration
   ```

## See Also

- [Phase 1.2 Complete Documentation](./PHASE_1.2_COMPLETE.md)
- [Environment Variables Guide](../env.example.md)

