import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';
import { PrismaService } from '../prisma/prisma.service';

export interface EveJwtPayload {
  sub: string; // "CHARACTER:EVE:12345678"
  name: string;
  owner: string; // ownerHash
  exp: number;
  iss: string;
  // ... other claims
}

export interface RequestUser {
  characterId: number;
  ownerHash: string;
  name: string;
  userId: string | null;
  role: string;
  primaryCharacterId: number | null;
}

@Injectable()
export class EveJwtStrategy extends PassportStrategy(Strategy, 'eve-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      issuer: ['https://login.eveonline.com', 'login.eveonline.com'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        jwksUri: 'https://login.eveonline.com/oauth/jwks',
        cache: true,
        rateLimit: true,
      }),
    });
  }

  async validate(payload: EveJwtPayload): Promise<RequestUser> {
    const sub: string = String(payload.sub ?? ''); // "CHARACTER:EVE:12345678"
    const characterId = Number(sub.split(':').pop());

    // Look up character in DB to get user association
    const character = await this.prisma.eveCharacter.findUnique({
      where: { id: characterId },
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

    // Check for owner hash change
    if (character && character.ownerHash !== payload.owner) {
      // Owner hash has changed - this token is invalid
      // We should revoke the stored refresh token
      await this.prisma.characterToken
        .update({
          where: { characterId },
          data: {
            refreshTokenEnc: '',
            accessToken: '',
            refreshFailAt: new Date(),
            refreshFailMsg: 'owner_hash_changed',
          },
        })
        .catch(() => {
          /* ignore if no token exists */
        });

      throw new Error(
        'Character ownership changed. Please re-link your character.',
      );
    }

    return {
      characterId,
      ownerHash: payload.owner,
      name: payload.name,
      userId: character?.userId ?? null,
      role: character?.user?.role ?? 'USER',
      primaryCharacterId: character?.user?.primaryCharacterId ?? null,
    };
  }
}
