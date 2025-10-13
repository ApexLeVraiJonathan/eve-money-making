# System Character Linking - Issues Fixed

## Issues Identified

1. **Role not set to LOGISTICS** - System characters were created with `managedBy=SYSTEM` but the `role` field wasn't set to `LOGISTICS`
2. **Scopes not extracted** - Scopes were hardcoded to empty string instead of being extracted from the JWT `scp` claim
3. **Characters not showing in UI** - Admin page was fetching only the current user's characters, excluding system characters (which have `userId=null`)

## Root Causes

### Issue 1: Missing Role Assignment

- **Location**: `apps/api/src/auth/auth.controller.ts` - `systemCharacterCallback` method
- **Problem**: Character upsert only set `managedBy: 'SYSTEM'` but not `role: 'LOGISTICS'`
- **Impact**: System characters couldn't be filtered/identified as logistics characters in the UI

### Issue 2: Scopes Not Extracted

- **Location**: `apps/api/src/auth/auth.controller.ts` - `systemCharacterCallback` method
- **Problem**: Hardcoded `scopes: ''` instead of extracting from JWT's `scp` claim
- **Impact**: Scopes were not stored in the database, making it impossible to track character permissions

### Issue 3: Wrong API Endpoint

- **Location**: `apps/web/app/arbitrage/admin/characters/page.tsx`
- **Problem**: Using `/api/auth/characters` which calls `/users/me/characters` - only returns characters linked to the current user (`userId != null`)
- **Impact**: System characters with `userId=null` were never returned, so they didn't appear in the UI

## Fixes Applied

### Fix 1: Set Role to LOGISTICS

**File**: `apps/api/src/auth/auth.controller.ts`

Added `role: 'LOGISTICS'` to both the `update` and `create` objects in the character upsert:

```typescript
await tx.eveCharacter.upsert({
  where: { id: characterId },
  update: {
    name: characterName,
    ownerHash,
    managedBy: "SYSTEM",
    userId: null,
    role: "LOGISTICS", // ✅ ADDED
    notes,
  },
  create: {
    id: characterId,
    name: characterName,
    ownerHash,
    managedBy: "SYSTEM",
    userId: null,
    role: "LOGISTICS", // ✅ ADDED
    notes,
  },
});
```

### Fix 2: Extract Scopes from JWT

**File**: `apps/api/src/auth/auth.controller.ts`

Updated JWT decoding to include the `scp` claim and extract scopes:

```typescript
// Decode access token to get character info and scopes
const decoded = jwt.decode(tokens.access_token) as {
  sub: string;
  name: string;
  owner: string;
  scp?: string | string[]; // ✅ ADDED
} | null;

// Extract scopes from JWT (can be string or array)
const scopes = Array.isArray(decoded.scp)
  ? decoded.scp.join(" ")
  : decoded.scp || ""; // ✅ ADDED

// Use extracted scopes instead of empty string
await tx.characterToken.upsert({
  where: { characterId },
  update: {
    // ...
    scopes, // ✅ CHANGED from ''
  },
  create: {
    // ...
    scopes, // ✅ CHANGED from ''
  },
});
```

### Fix 3: Create Admin Endpoint for All Characters

**File**: `apps/api/src/auth/auth.controller.ts`

Created new admin endpoint that returns ALL characters (including system characters):

```typescript
@UseGuards(RolesGuard)
@Roles('ADMIN')
@Get('admin/characters')
async getAllCharacters() {
  const characters = await this.prisma.eveCharacter.findMany({
    select: {
      id: true,
      name: true,
      ownerHash: true,
      userId: true,
      role: true,
      function: true,
      location: true,
      managedBy: true,
      notes: true,
      token: {
        select: {
          accessTokenExpiresAt: true,
          scopes: true,
        },
      },
    },
    orderBy: [{ managedBy: 'asc' }, { role: 'asc' }, { name: 'asc' }],
  });

  return characters.map((c) => ({
    characterId: c.id,
    characterName: c.name,
    ownerHash: c.ownerHash,
    userId: c.userId,
    role: c.role,
    function: c.function,
    location: c.location,
    managedBy: c.managedBy,
    notes: c.notes,
    accessTokenExpiresAt: c.token?.accessTokenExpiresAt?.toISOString() ?? null,
    scopes: c.token?.scopes ?? null,
  }));
}
```

**File**: `apps/web/app/api/admin/characters/route.ts` (NEW)

Created Next.js API route to expose the admin endpoint:

```typescript
import { NextResponse } from "next/server";
import { fetchWithAuthJson } from "@/lib/api-client";

export async function GET() {
  try {
    const characters = await fetchWithAuthJson("/auth/admin/characters");
    return NextResponse.json(characters);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to fetch characters", details: message },
      { status: 500 }
    );
  }
}
```

**File**: `apps/web/app/arbitrage/admin/characters/page.tsx`

Updated frontend to use the new admin endpoint:

```typescript
// BEFORE
async function fetchCharacters(): Promise<LinkedCharacter[]> {
  const res = await fetch("/api/auth/characters", { cache: "no-store" });
  const data = (await res.json()) as { characters?: LinkedCharacter[] };
  return data.characters ?? [];
}

// AFTER
async function fetchCharacters(): Promise<LinkedCharacter[]> {
  const res = await fetch("/api/admin/characters", { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as LinkedCharacter[];
}
```

Also updated `LinkedCharacter` type to include new fields:

```typescript
type LinkedCharacter = {
  characterId: number;
  characterName: string;
  ownerHash: string;
  userId: string | null; // ✅ ADDED
  accessTokenExpiresAt: string | null;
  scopes: string | null;
  role?: string;
  function?: string | null;
  location?: string | null;
  managedBy?: string; // ✅ ADDED
  notes?: string | null; // ✅ ADDED
};
```

## Expected Behavior After Fixes

1. ✅ System characters are created with `role='LOGISTICS'` and `managedBy='SYSTEM'`
2. ✅ Scopes from EVE SSO are properly extracted and stored in the database
3. ✅ System characters appear in the "System Characters" tab of the admin page
4. ✅ Character details include scopes, notes, and management type

## Testing Steps

1. Navigate to `/arbitrage/admin/characters`
2. Click "System Characters" tab
3. Enter notes for the character (optional)
4. Click "Link via EVE SSO"
5. Authorize the character on EVE SSO
6. Verify:
   - Character appears in the System Characters table
   - Scopes are visible in the database
   - Role is set to LOGISTICS
   - managedBy is set to SYSTEM

## Database Schema Reference

### EveCharacter Table

```prisma
model EveCharacter {
  id        Int      @id
  name      String
  ownerHash String
  userId    String?  // null for system characters
  role      CharacterRole      @default(USER)  // USER | LOGISTICS
  function  CharacterFunction? // SELLER | BUYER
  location  CharacterLocation? // JITA | DODIXIE | etc
  managedBy CharacterManagedBy @default(USER)  // USER | SYSTEM
  notes     String?
  // ...
  token     CharacterToken?
}
```

### CharacterToken Table

```prisma
model CharacterToken {
  characterId          Int
  accessToken          String
  accessTokenExpiresAt DateTime
  refreshTokenEnc      String
  scopes               String  // ✅ Now properly populated
  // ...
}
```
