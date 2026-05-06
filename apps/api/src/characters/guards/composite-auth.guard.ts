import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/current-user.decorator';
import { CryptoUtil } from '../../common/crypto.util';
import { PrismaService } from '../../prisma/prisma.service';

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

type SessionPayload = {
  userId: string | null;
  characterId: number;
  characterName: string;
  role: string;
};

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    (typeof payload.userId === 'string' || payload.userId === null) &&
    typeof payload.characterId === 'number' &&
    typeof payload.characterName === 'string' &&
    typeof payload.role === 'string'
  );
}

/**
 * Composite authentication guard supporting multiple auth methods:
 * 1. HTTP-only session cookie (primary, used by the web frontend)
 * 2. Dev API Key (dev/test only) - x-api-key header
 * 3. EVE SSO Bearer tokens (legacy / tooling)
 *
 * The guard first tries to authenticate via the encrypted `session` cookie.
 * If that fails, it falls back to Passport strategies in order:
 *   - dev-api-key
 *   - eve-jwt
 */
@Injectable()
export class CompositeAuthGuard extends AuthGuard(['dev-api-key', 'eve-jwt']) {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | import('rxjs').Observable<boolean> {
    return this.canActivateWithSession(context);
  }

  private async canActivateWithSession(
    context: ExecutionContext,
  ): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const cookies = (req as unknown as {
      cookies?: Record<string, string | undefined>;
    }).cookies;

    const encSession = cookies?.session;
    if (encSession) {
      try {
        const json = await CryptoUtil.decrypt(encSession);
        const parsed: unknown = JSON.parse(json) as unknown;
        if (!isSessionPayload(parsed)) {
          throw new Error('Invalid session payload');
        }
        const payload = parsed;

        // Load latest character + user info to populate RequestUser
        const character = await this.prisma.eveCharacter.findUnique({
          where: { id: payload.characterId },
          select: {
            id: true,
            name: true,
            ownerHash: true,
            userId: true,
            user: {
              select: {
                id: true,
                role: true,
                primaryCharacterId: true,
              },
            },
          },
        });

        if (!character) {
          throw new Error('Character not found for session');
        }

        req.user = {
          characterId: character.id,
          ownerHash: character.ownerHash,
          name: character.name,
          userId: character.userId,
          role: character.user?.role ?? payload.role ?? 'USER',
          primaryCharacterId: character.user?.primaryCharacterId ?? null,
        };

        return true;
      } catch {
        // If session cookie is invalid, fall through to other strategies
      }
    }

    // No valid session cookie: try authentication strategies in order
    const result = await Promise.resolve(
      super.canActivate(context) as Promise<boolean>,
    );
    return result;
  }

  handleRequest<TUser = RequestUser>(
    err: unknown,
    user: TUser | null | undefined,
  ): TUser {
    if (err || !user) {
      if (err instanceof Error) throw err;
      throw new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
