# EVE Money Making - API (Backend)

NestJS backend API for EVE Online arbitrage trading cycle management.

---

## Architecture

### Domain-Driven Design

The API is organized into 6 clear domains:

```
src/
├── characters/      # Auth, users, character management
├── cycles/          # Financial ledger, participations (9 services)
├── market/          # Arbitrage, pricing, liquidity, packages
├── wallet/          # Wallet imports, transaction allocation
├── game-data/       # Static EVE data, data imports
└── Infrastructure:
    ├── esi/         # EVE API client
    ├── jobs/        # Background tasks
    ├── prisma/      # Database client
    └── common/      # Shared utilities
```

### Key Services (Cycles Domain)

The cycles domain contains 9 focused services (all <300 lines):

- **CycleService** - Lifecycle management
- **CapitalService** - Capital & NAV computation
- **ProfitService** - Profit calculations
- **ParticipationService** - User investments
- **PayoutService** - Payout computation
- **PaymentMatchingService** - Fuzzy payment matching
- **CycleLineService** - Item tracking
- **FeeService** - Fee management
- **SnapshotService** - Cycle snapshots

**Principles:**

- Single responsibility per service
- No cross-domain Prisma queries
- Domain services for cross-domain access
- 100% JSDoc documentation

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- EVE Online Developer Application

### Installation

```bash
cd apps/api
pnpm install
```

### Environment Variables

Create `.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/eve_money"

# EVE SSO
ESI_CLIENT_ID="your_client_id"
ESI_CLIENT_SECRET="your_client_secret"
ESI_CALLBACK_URL="http://localhost:3000/auth/callback/eveonline"

# Auth
JWT_SECRET="your_secret_key_here"

# Server
PORT=3000
CORS_ORIGINS="http://localhost:3001"
```

### Database Setup

```bash
cd ../../packages/prisma
pnpm run generate
pnpm run migrate:deploy
```

### Development

```bash
cd apps/api
pnpm run start:dev
```

API will be available at `http://localhost:3000`

### Swagger Documentation

Interactive API documentation available at:

```
http://localhost:3000/docs
```

---

## Build

```bash
# Development
pnpm run build

# Production
pnpm run start:prod
```

---

## Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

---

## Project Structure

```
apps/api/
├── src/
│   ├── characters/          # User & character management
│   │   ├── services/        # Auth, character, user, token services
│   │   ├── guards/          # Auth guards
│   │   └── decorators/      # Custom decorators
│   ├── cycles/              # Financial ledger domain
│   │   ├── services/        # 9 focused cycle services
│   │   ├── dto/             # Request/response DTOs
│   │   └── utils/           # Shared utilities (capital-helpers)
│   ├── market/              # Trading operations
│   ├── wallet/              # Wallet & reconciliation
│   ├── game-data/           # EVE static data
│   ├── esi/                 # EVE API client
│   ├── jobs/                # Background jobs
│   ├── prisma/              # Database service
│   ├── common/              # Shared utilities
│   └── main.ts              # Bootstrap
├── test/                    # E2E tests
└── prisma/ → ../../packages/prisma/
```

---

## Key Features

### API Documentation

- **Swagger/OpenAPI** at `/docs`
- All endpoints documented with `@ApiOperation`
- Request/response schemas with `@ApiProperty`
- Bearer auth support

### Validation

- **class-validator** for DTO validation
- Automatic type transformation
- Whitelist unknown properties
- Detailed error messages

### Security

- **JWT authentication** with EVE SSO
- **Role-based access** control (USER, ADMIN, LOGISTICS)
- **CORS** protection
- **Rate limiting** on ESI calls

### Caching

- **ESI response caching** (ETag/Expires headers)
- **Capital snapshot caching** (1-hour TTL)
- **Concurrent request limiting**

---

## Environment Configuration

All environment access is centralized in `src/common/config.ts`:

```typescript
import { AppConfig } from './common/config';

// Usage
const port = AppConfig.port();
const dbUrl = AppConfig.database().url;
const esiCredentials = AppConfig.esi();
```

---

## Development Guidelines

### Service Naming

- Queries: `find*()`, `get*()`, `list*()`
- Mutations: `create()`, `update()`, `delete()`
- Business logic: `compute*()`, `validate*()`, `match*()`

### Constants

- Use `UPPER_SNAKE_CASE` for true constants
- Extract magic numbers to named constants
- Document purpose inline

### Documentation

- Service-level JSDoc explaining responsibilities
- Method-level JSDoc for complex operations
- Inline comments for algorithms

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment guide.

---

## License

MIT

---

Trigger changes
