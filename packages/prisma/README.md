# @eve/prisma

Single Prisma schema and migrations for the entire monorepo.

## Setup

1. **Create .env file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure DATABASE_URL:**
   ```bash
   # For local development (using docker-compose.dev.yml)
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public"
   ```

3. **Generate Prisma Client:**
   ```bash
   pnpm prisma:generate
   ```

## Structure

- `schema.prisma` - Main Prisma schema
- `migrations/` - Database migrations (31 migrations)
- `client/` - Generated Prisma Client (gitignored)
- `.env` - Environment variables (DATABASE_URL)
- `.env.example` - Example environment configuration

## Usage

In apps that need database access:

```typescript
import { PrismaClient } from '@eve/prisma';
import type { Prisma, User, Cycle } from '@eve/prisma';
import { Decimal } from '@eve/prisma/runtime/library';

const prisma = new PrismaClient();
```

## Scripts

**From workspace root:**
- `pnpm db:generate` - Generate Prisma Client
- `pnpm db:migrate:deploy` - Apply migrations (production)
- `pnpm db:studio` - Open Prisma Studio

**From this package:**
- `pnpm prisma:generate` - Generate Prisma Client
- `pnpm prisma:migrate:dev` - Create and apply migrations (dev)
- `pnpm prisma:migrate:deploy` - Apply migrations (production)
- `pnpm prisma:studio` - Open Prisma Studio

## Environment Variables

The package reads configuration from `.env` file in this directory:

- **DATABASE_URL** (required): PostgreSQL connection string
  - Dev: `postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public`
  - Prod: `postgresql://user:password@host:5432/dbname?schema=public`

## Development Workflow

1. **Start local database:**
   ```bash
   pnpm db:up  # from workspace root
   ```

2. **Generate Prisma Client:**
   ```bash
   pnpm db:generate
   ```

3. **Apply migrations:**
   ```bash
   pnpm --filter @eve/prisma run prisma migrate dev
   ```

4. **Open Prisma Studio:**
   ```bash
   pnpm db:studio
   ```

## Notes

- The Prisma Client is generated to `./client/` directory
- The client is gitignored and must be generated after installation
- All apps import from `@eve/prisma` (not `@prisma/client`)
- Migrations are managed centrally for the entire monorepo

