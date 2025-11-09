import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoUtil } from '../../common/crypto.util';

/**
 * CompositeAuthGuard implements a fallback authentication strategy:
 * 1. First tries encrypted cookie session (same as AuthGuard)
 * 2. Falls back to Passport JWT (EveAuthGuard) if cookie is missing/invalid
 * 3. Respects @Public() decorator on routes
 */
@Injectable()
export class CompositeAuthGuard implements CanActivate {
  private readonly jwtGuard: PassportAuthGuard;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    // Create an instance of the JWT guard for fallback
    this.jwtGuard = new (class extends PassportAuthGuard('eve-jwt') {})(
      this.reflector,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();

    // Strategy 1: Try encrypted cookie session
    const cookieAuth = await this.tryCookieAuth(req);
    if (cookieAuth) return true;

    // Strategy 2: Fallback to JWT Bearer token
    try {
      const result = await this.jwtGuard.canActivate(context);
      return result as boolean;
    } catch {
      // Both strategies failed
      return false;
    }
  }

  /**
   * Attempt cookie-based session authentication
   */
  private async tryCookieAuth(req: Request): Promise<boolean> {
    const cookiesHolder = req as unknown as {
      cookies?: Record<string, string>;
    };
    const enc = cookiesHolder?.cookies?.['session'];
    if (!enc) return false;

    try {
      const json = await CryptoUtil.decrypt(enc);
      const sess = JSON.parse(json) as {
        userId?: string;
        characterId?: number;
        characterName?: string;
      };

      if (!sess?.userId) return false;

      const user = await this.prisma.user.findUnique({
        where: { id: String(sess.userId) },
        select: { id: true, role: true, primaryCharacterId: true },
      });

      if (!user) return false;

      // Attach user info to request
      (req as unknown as { user?: unknown }).user = {
        userId: user.id,
        role: user.role,
        primaryCharacterId: user.primaryCharacterId ?? null,
        characterId: sess.characterId ?? null,
        characterName: sess.characterName ?? null,
      } as const;

      return true;
    } catch {
      return false;
    }
  }
}

