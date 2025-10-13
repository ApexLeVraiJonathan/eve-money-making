<!-- e04f92aa-cac4-49e7-8ed3-5f35ae43fbd4 6f4b8865-c64d-46a0-8078-15ac217552fe -->
# EVE SSO + Multi-Character Linking (Nest-owned link flow)

## Scope

- NextAuth (Auth.js) provides user sign-in with EVE only.
- NestJS validates EVE Bearer tokens (JWK), performs linking, stores/refreshes tokens, and enforces RBAC.
- Preserve ADMIN functionality via existing `RolesGuard` using resolved `req.user.role` from linked user.

## 1) Prisma schema (non-breaking)

- Edit `apps/api/prisma/schema.prisma`:
  - Add enum and fields:
    - `enum CharacterManagedBy { USER SYSTEM }`
    - In `EveCharacter`: `managedBy CharacterManagedBy @default(USER) @map("managed_by")`, `notes String? @map("notes")`
    - In `CharacterToken`: `lastRefreshAt DateTime? @map("last_refresh_at")`, `refreshFailAt DateTime? @map("refresh_fail_at")`, `refreshFailMsg String? @map("refresh_fail_msg")`
- Create migration: `pnpm -w prisma generate` then `pnpm -w prisma migrate dev -n system_characters_and_token_health`

## 2) Environment & config

- Update root `env.example.md` with:
  - `EVE_CLIENT_ID`, `EVE_CLIENT_SECRET` (stored in secret store), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `API_URL`, `PORT`
- Ensure `apps/api/src/main.ts` CORS allows Next origin and `Authorization` header.

## 3) Next.js Auth.js — EVE-only sign-in

- Add `apps/web/app/api/auth/[...nextauth]/route.ts` using `next-auth` `eveonline` provider.
- JWT sessions, callbacks copy `access_token` + expiry into session.
- Optional: If you want a custom sign-in UI, add `/login`; otherwise omit `pages.signIn` and use the default NextAuth sign-in page or point `pages.signIn` to an existing public page that already shows a “Sign in with EVE Online” button.
- Optional `middleware.ts` wiring left minimal (user deferred page list).
```ts
// apps/web/app/api/auth/[...nextauth]/route.ts (essential bits)
import NextAuth from "next-auth";
import EVEOnline from "next-auth/providers/eveonline";

export const authOptions = {
  providers: [
    EVEOnline({
      clientId: process.env.EVE_CLIENT_ID!,
      clientSecret: process.env.EVE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.expires_at = Date.now() + (account.expires_in ?? 0) * 1000;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).expiresAt = token.expires_at;
      return session;
    },
  },
};
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```


## 4) Next → Nest calls (forward Bearer)

- Pattern for server actions/API routes: fetch session, forward `Authorization: Bearer <access_token>` to Nest.
```ts
import { auth } from "@/auth";
export async function getUserCharacters() {
  const session = await auth();
  const r = await fetch(`${process.env.API_URL}/me/characters`, {
    headers: { Authorization: `Bearer ${session?.accessToken ?? ""}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error("API error");
  return r.json();
}
```


## 5) NestJS — EVE JWT validation

- Install: `pnpm -w add -F @apex/api @nestjs/passport passport passport-jwt jwks-rsa`
- Add `apps/api/src/auth/jwt.strategy.ts` and `EveAuthGuard`:
```ts
// jwt.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import jwksRsa from "jwks-rsa";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EveJwtStrategy extends PassportStrategy(Strategy, "eve-jwt") {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ["RS256"],
      issuer: ["https://login.eveonline.com", "login.eveonline.com"],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        jwksUri: "https://login.eveonline.com/oauth/jwks",
        cache: true,
        rateLimit: true,
      }),
    });
  }
  async validate(payload: any) {
    const sub: string = String(payload.sub ?? ""); // CHARACTER:EVE:123
    const characterId = Number(sub.split(":").pop());
    const character = await this.prisma.eveCharacter.findUnique({
      where: { id: characterId },
      select: { id: true, name: true, ownerHash: true, userId: true, user: { select: { id: true, role: true, primaryCharacterId: true } } },
    });
    return {
      characterId,
      ownerHash: payload.owner,
      name: payload.name,
      userId: character?.userId ?? null,
      role: character?.user?.role ?? "USER",
      primaryCharacterId: character?.user?.primaryCharacterId ?? null,
    } as const;
  }
}

// auth.guard.ts (light wrapper)
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
@Injectable()
export class EveAuthGuard extends AuthGuard("eve-jwt") {}
```

- Register in `apps/api/src/auth/auth.module.ts` and ensure controllers use `@UseGuards(EveAuthGuard)` for `/me*` and admin endpoints combine with `RolesGuard`.
- `apps/api/src/main.ts` CORS to allow Next origin and `Authorization`.

## 6) Linking characters (Nest-owned flow)

- Endpoints in `apps/api/src/auth/auth.controller.ts`:
  - `POST /auth/eve/link/url` → returns OAuth URL for requested scopes; include state/PKCE if desired.
  - `GET /auth/eve/callback` → exchange code, decode ID token, upsert `EveCharacter` + `CharacterToken`, connect to current user (identified by the EVE Bearer on request or a short-lived state binding), then redirect to app.
- Admin system characters:
  - `POST /admin/system-characters/link/url` (ADMIN)
  - `GET /admin/system-characters/callback` (ADMIN) → same upsert but `userId=null`, `managedBy=SYSTEM`.
- Upsert logic (service): use `CryptoUtil` to encrypt refresh tokens.

## 7) ESI access token refresh service

- Add `apps/api/src/auth/esi-token.service.ts` using axios to refresh when expired; update token health fields on success/failure.
- Use this service before ESI calls to ensure a valid bearer.
- Owner change check: on JWT validate/callback and on refresh, compare payload.owner with DB `ownerHash`; if changed, revoke token and require relink.

## 8) API surface (initial)

- `GET /me` → returns resolved `{ userId, role, characterId, characterName }` from strategy.
- `GET /me/characters` → list all characters where `user_id = current.userId`.
- Admin ops:
  - `POST /admin/characters/:id/revoke` → clear refresh
  - `GET /admin/characters/:id/token/status` → token meta

## 9) Background jobs (skeleton)

- Add a cron/scheduled task to periodically refresh `managedBy=SYSTEM` characters and log failures.

## 10) Tests (essentials)

- E2E: unauthenticated protected route → 401; with valid EVE Bearer → 200.
- Link flow upserts character + token; second character linking shows in `/me/characters`.
- Refresh path updates token fields when `accessTokenExpiresAt` is stale.
- Owner change revokes refresh and signals relink.

## Notes

- Keep secrets (`EVE_CLIENT_SECRET`) out of repo; store in secret manager.
- Keep existing ADMIN gating via `RolesGuard`; it will read `req.user.role` set by the strategy.
- UI route protection can be wired later in `middleware.ts` as needed by pages.

### To-dos

- [ ] Add managedBy/notes and token health fields; run migration
- [ ] Create NextAuth EVE-only provider route and login page
- [ ] Implement EveJwtStrategy and EveAuthGuard; wire into module
- [ ] Enable CORS for Next origin with Authorization header
- [ ] Implement link URL + callback endpoints (user + admin)
- [ ] Create EsiTokenService with refresh + owner change checks
- [ ] Expose /me and /me/characters using EveAuthGuard
- [ ] Add revoke/status endpoints for admin characters
- [ ] Add skeleton job to refresh SYSTEM characters
- [ ] Write e2e tests for auth guard, linking, refresh, owner change