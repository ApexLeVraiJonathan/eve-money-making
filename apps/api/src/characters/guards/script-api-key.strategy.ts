import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from './jwt.strategy';

@Injectable()
export class ScriptApiKeyStrategy extends PassportStrategy(
  Strategy,
  'script-api-key',
) {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private parseApiKeys(): Array<{ key: string; userId: string }> {
    const out: Array<{ key: string; userId: string }> = [];

    const singleKey = (process.env.SCRIPT_API_KEY ?? '').trim();
    const singleUserId = (process.env.SCRIPT_API_USER_ID ?? '').trim();
    if (singleKey && singleUserId) {
      out.push({ key: singleKey, userId: singleUserId });
    }

    const multi = (process.env.SCRIPT_API_KEYS ?? '').trim();
    if (!multi) return out;

    for (const entry of multi.split(',')) {
      const raw = entry.trim();
      if (!raw) continue;
      const sep = raw.indexOf(':');
      if (sep <= 0 || sep >= raw.length - 1) continue;
      const key = raw.slice(0, sep).trim();
      const userId = raw.slice(sep + 1).trim();
      if (key && userId) out.push({ key, userId });
    }
    return out;
  }

  async validate(req: Request): Promise<RequestUser | false> {
    const provided = (
      req.headers['x-script-api-key'] ??
      req.headers['x-api-key'] ??
      ''
    )
      .toString()
      .trim();
    if (!provided) return false;

    const keys = this.parseApiKeys();
    if (!keys.length) {
      throw new UnauthorizedException('Script API key auth not configured');
    }

    const matched = keys.find((k) => k.key === provided);
    if (!matched) {
      throw new UnauthorizedException('Invalid script API key');
    }

    const character = await this.prisma.eveCharacter.findFirst({
      where: { userId: matched.userId },
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
      orderBy: { updatedAt: 'desc' },
    });

    if (!character?.user) {
      throw new UnauthorizedException('Script API key user has no character');
    }

    return {
      characterId: character.id,
      ownerHash: character.ownerHash,
      name: character.name,
      userId: character.user.id,
      role: character.user.role,
      primaryCharacterId: character.user.primaryCharacterId,
    };
  }
}
