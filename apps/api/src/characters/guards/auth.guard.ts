import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoUtil } from '../../common/crypto.util';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
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
      };
      if (!sess?.userId) return false;
      const user = await this.prisma.user.findUnique({
        where: { id: String(sess.userId) },
        select: { id: true, role: true, primaryCharacterId: true },
      });
      if (!user) return false;
      (req as unknown as { user?: unknown }).user = {
        userId: user.id,
        role: user.role,
        primaryCharacterId: user.primaryCharacterId ?? null,
        characterId: (sess as { characterId?: number }).characterId ?? null,
        characterName:
          (sess as { characterName?: string }).characterName ?? null,
      } as const;
      return true;
    } catch {
      return false;
    }
  }
}
