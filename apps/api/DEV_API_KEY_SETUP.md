# Dev API Key Setup

## Overview

The Dev API Key feature provides an easy way to authenticate API requests during development and testing without needing to manage JWT bearer tokens from EVE SSO.

**⚠️ IMPORTANT**: This feature is **ONLY available in non-production environments** for security reasons.

## Setup

### 1. Add to Environment Variables

Add `DEV_API_KEY` to your `.env` file in the API project:

```bash
# apps/api/.env
DEV_API_KEY=my-super-secret-dev-key-12345
```

**Choose a strong, random key**. You can generate one with:

```bash
# On Unix/Mac/WSL:
openssl rand -hex 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Restart the API Server

After adding the environment variable:

```bash
cd apps/api
pnpm dev
```

You should see in the logs:
```
✅ Dev API key authentication enabled (non-production)
```

## Usage

### In API Requests

Add the `x-api-key` header to your requests:

```bash
# Using curl
curl -H "x-api-key: my-super-secret-dev-key-12345" \
  http://localhost:3000/ledger/cycles

# Using fetch in TypeScript
fetch('http://localhost:3000/ledger/cycles', {
  headers: {
    'x-api-key': 'my-super-secret-dev-key-12345'
  }
})
```

### In Test Scripts

The E2E test script now supports API key auth:

```bash
# Using API key (recommended)
pnpm exec ts-node scripts/e2e-rollover-test.ts \
  --apiKey my-super-secret-dev-key-12345 \
  --characterId 2122151042 \
  --initialCapital 20000000000

# Using bearer token (legacy)
pnpm exec ts-node scripts/e2e-rollover-test.ts \
  --token eyJhbGc... \
  --characterId 2122151042
```

### In Swagger UI

1. Open http://localhost:3000/api-docs
2. Click "Authorize" button
3. For API Key: Enter value in `x-api-key` field
4. OR for JWT: Enter bearer token in `Authorization` field

## How It Works

1. The `DevApiKeyStrategy` checks for the `x-api-key` header
2. Validates it against the `DEV_API_KEY` environment variable
3. Returns a fake admin user with full permissions
4. If a real admin character exists in the DB, it uses that instead

## Security Notes

- ✅ **Only works in development**: Automatically disabled when `NODE_ENV=production`
- ✅ **No production access**: Will throw an error if used in production
- ✅ **Admin-only**: Always returns an admin user for convenience
- ⚠️ **Keep it secret**: Don't commit your API key to version control
- ⚠️ **Rotate regularly**: Change the key periodically for security

## Authentication Priority

The `CompositeAuthGuard` tries authentication methods in this order:

1. **Dev API Key** (x-api-key header) - if configured, non-production, AND header is present
2. **JWT Bearer Token** (Authorization header) - EVE SSO token (default fallback)

**Important:** If no `x-api-key` header is present, the guard automatically falls back to JWT authentication. This means the frontend continues to work normally with JWT tokens.

## Troubleshooting

### "Dev API key not configured"
- Check that `DEV_API_KEY` is set in your `.env` file
- Restart the API server after adding it

### "Dev API key not available in production"
- This is intentional for security
- Use proper JWT authentication in production

### "Invalid or missing API key"
- Check that the header name is exactly `x-api-key` (lowercase)
- Verify the key matches your `.env` file exactly

## Example: Complete Test Flow

```bash
# 1. Set up your dev API key
echo "DEV_API_KEY=$(openssl rand -hex 32)" >> apps/api/.env

# 2. Restart the API server
cd apps/api && pnpm dev

# 3. Run the E2E test
cd apps/api
pnpm exec ts-node scripts/e2e-rollover-test.ts \
  --apiKey $(grep DEV_API_KEY .env | cut -d= -f2) \
  --characterId 2122151042
```

## Creating Multiple Test Participations

In dev/test environments, you can use the `testUserId` field to create multiple participations from a single API key:

```bash
# Create participation for Investor Alpha
curl -H "x-api-key: my-dev-key" \
  http://localhost:3000/ledger/cycles/CYCLE_ID/participations \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"characterName": "Investor Alpha", "amountIsk": "15000000000.00", "testUserId": "test-user-alpha"}'

# Create participation for Investor Beta
curl -H "x-api-key: my-dev-key" \
  http://localhost:3000/ledger/cycles/CYCLE_ID/participations \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"characterName": "Investor Beta", "amountIsk": "12000000000.00", "testUserId": "test-user-beta"}'
```

**Note:** The `testUserId` field:
- Is **only available in dev/test environments**
- Will be **ignored in production** (production uses actual authenticated userId)
- Allows testing multi-investor scenarios without creating multiple real users
- Is used in E2E tests to simulate multiple investors

## Benefits

- ✅ **Faster testing**: No need to grab fresh EVE SSO tokens
- ✅ **Automation-friendly**: Perfect for CI/CD and automated tests
- ✅ **Simpler scripts**: No token expiry to worry about
- ✅ **Admin access**: Always authenticated as admin for full testing
- ✅ **Multi-user testing**: Create multiple test participations with `testUserId`

