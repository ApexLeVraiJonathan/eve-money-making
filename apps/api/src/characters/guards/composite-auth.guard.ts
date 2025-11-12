import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Composite authentication guard supporting multiple auth methods:
 * 1. Dev API Key (dev/test only) - x-api-key header
 * 2. EVE SSO Bearer tokens (production)
 *
 * Authentication Flow (Dev API Key):
 * 1. Check for x-api-key header
 * 2. Validate against DEV_API_KEY environment variable
 * 3. Return admin user for testing
 *
 * Authentication Flow (EVE SSO):
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
 * - Dev API key for easy testing/automation (dev only)
 */
@Injectable()
export class CompositeAuthGuard extends AuthGuard(['dev-api-key', 'eve-jwt']) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Try authentication strategies in order: dev-api-key, then eve-jwt
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // If there's an error or no user, throw UnauthorizedException
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
