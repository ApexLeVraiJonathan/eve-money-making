# Listed Units Admin Endpoint Implementation - Complete

## Summary

Created a proper admin endpoint for fetching character orders to support the listed units backfill script, following all project architecture rules.

## What Was Created

### 1. Service Layer (Business Logic)
**File:** `apps/api/src/characters/services/character.service.ts`

Added method:
```typescript
async getCharacterOrders(characterId: number): Promise<Array<...>>
```

**Responsibilities:**
- Validates character exists in database
- Throws `NotFoundException` if character not found
- Calls ESI service to fetch orders with token refresh
- Returns orders with `volume_total` field (original listed amount)

### 2. Controller Layer (Thin Routing)
**File:** `apps/api/src/characters/auth.controller.ts`

Added endpoint:
```
GET /admin/characters/:id/orders
```

**Responsibilities:**
- Route definition and parameter validation
- Delegates all logic to `CharacterService`
- No database calls (follows project rules)
- Protected with `@Roles('ADMIN')` and `@UseGuards(RolesGuard)`
- Documented with Swagger decorators

### 3. Backfill Script Updated
**File:** `apps/api/scripts/reset-and-backfill-listed-units.ts`

**Changed:**
```diff
- `${API_BASE_URL}/characters/${char.characterId}/orders`
+ `${API_BASE_URL}/admin/characters/${char.characterId}/orders`
```

## Architecture Compliance

✅ **Follows NestJS Rules (`.cursor/rules/20-backend-nest.mdc`):**
- Controllers are thin (routing + DTO validation only)
- **No database calls in controllers**
- Services contain business logic
- Proper use of guards and roles
- Swagger documentation

✅ **Follows Prisma Rules (`.cursor/rules/30-database-prisma.mdc`):**
- Single PrismaClient via DI-backed PrismaService
- Selective reads with `select`
- No ad-hoc PrismaClient instances

✅ **Follows Core Rules (`.cursor/rules/00-core.mdc`):**
- KISS, DRY, YAGNI principles
- Preserved existing patterns
- Used strict TypeScript with proper types

## Endpoint Details

**URL:** `GET /admin/characters/:id/orders`

**Authentication:** Admin only (via `@Roles('ADMIN')` guard)

**Authorization:** Requires:
- Valid EVE SSO bearer token OR dev API key
- Admin role

**Parameters:**
- `id` (path) - Character ID (number)

**Response:**
```typescript
Array<{
  order_id: number;
  type_id: number;
  is_buy_order: boolean;
  price: number;
  volume_remain: number;    // Current remaining: e.g., 18
  volume_total: number;      // Original listed: e.g., 42
  location_id: number;
  issued?: string;
  state?: string;
  region_id?: number;
}>
```

**Error Handling:**
- 404: Character not found
- 401: Unauthorized
- 500: ESI error or token refresh failed

## How It Works

1. **Client calls endpoint:** `GET /admin/characters/123456789/orders`
2. **Controller:** Validates ID and delegates to service
3. **Service:** 
   - Queries database to verify character exists
   - Calls ESI service to fetch orders
4. **ESI Service:** 
   - Uses stored character token
   - Automatically refreshes token if expired
   - Fetches orders from EVE ESI API
5. **Response:** Returns orders with `volume_total` field

## Backfill Script Usage

Now that the endpoint exists, the backfill script can run:

```bash
# Dry run (no changes)
npx ts-node apps/api/scripts/reset-and-backfill-listed-units.ts --dry-run

# Dry run for specific cycle
npx ts-node apps/api/scripts/reset-and-backfill-listed-units.ts --dry-run --cycle-id <cycle-id>

# Dry run for specific status
npx ts-node apps/api/scripts/reset-and-backfill-listed-units.ts --dry-run --status ACTIVE

# Run for real (applies changes)
npx ts-node apps/api/scripts/reset-and-backfill-listed-units.ts
```

## What the Script Does

1. Fetches all characters via `GET /admin/characters`
2. Filters to `function === 'SELLER'`
3. For each seller, fetches orders via `GET /admin/characters/:id/orders`
4. Aggregates sell orders by `stationId:typeId` and sums `volume_total`
5. Resets all `listedUnits` to 0
6. Updates `listedUnits` with aggregated values from active orders
7. Reports what was changed

## Benefits

✅ **Proper Architecture:** Service layer separated from controller
✅ **Reusable:** Endpoint is permanent and useful for other admin tools
✅ **Token Management:** ESI service handles token refresh automatically
✅ **Type Safe:** Full TypeScript type safety throughout
✅ **Documented:** Swagger documentation for API consumers
✅ **Secure:** Admin-only access with proper guards

## Testing

To test the endpoint:

```bash
# With dev API key (development only)
curl -H "X-Api-Key: YOUR_DEV_API_KEY" \
  http://localhost:3000/admin/characters/123456789/orders

# With bearer token (production)
curl -H "Authorization: Bearer YOUR_EVE_TOKEN" \
  http://localhost:3000/admin/characters/123456789/orders
```

## Next Steps

1. ✅ Endpoint created and follows architecture rules
2. ✅ Backfill script updated to use correct endpoint
3. 🔧 Run backfill script in --dry-run mode to verify
4. 🔧 Run backfill script for real to populate production data
5. 🔧 Verify Sell Appraiser shows correct unlisted quantities

## Files Modified

- `apps/api/src/characters/services/character.service.ts` - Added `getCharacterOrders()` method
- `apps/api/src/characters/auth.controller.ts` - Added endpoint, injected CharacterService
- `apps/api/scripts/reset-and-backfill-listed-units.ts` - Fixed endpoint URL

## Files NOT Modified (Already Complete)

- `apps/api/src/characters/characters.module.ts` - CharacterService already registered
- `apps/api/src/esi/esi-characters.service.ts` - `getOrders()` method already exists with `volume_total`

