import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EveAuthGuard } from './eve-auth.guard';

/**
 * Global authentication guard using EVE SSO Bearer tokens.
 *
 * Authentication Flow:
 * 1. Frontend: User logs in via NextAuth (EVE SSO)
 * 2. Frontend: Stores EVE access_token in NextAuth session
 * 3. Frontend: Sends Authorization: Bearer <eve_token> with all API requests
 * 4. Backend: This guard validates the token via EveAuthGuard (passport-jwt)
 * 5. Backend: EveJwtStrategy verifies token against EVE's JWKS (RS256)
 * 6. Backend: Strategy looks up character in DB, loads user/role
 * 7. Backend: Attaches user to request for use in controllers
 *
 * Benefits:
 * - Single source of truth: NextAuth session
 * - EVE validates tokens (RS256 + JWKS)
 * - Backend loads user/role from DB for authorization
 * - No separate session storage needed
 * - Respects @Public() decorator for public endpoints
 */
@Injectable()
export class CompositeAuthGuard extends EveAuthGuard {
  constructor(reflector: Reflector) {
    super(reflector);
  }
}
