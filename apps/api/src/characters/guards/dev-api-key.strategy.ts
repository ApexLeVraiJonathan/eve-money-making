import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { AppConfig } from '../../common/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from './jwt.strategy';

/**
 * Dev-only API key authentication strategy
 *
 * Usage: Add header `x-api-key: <DEV_API_KEY>` to requests
 *
 * Security:
 * - Only enabled when NODE_ENV !== 'production'
 * - Requires DEV_API_KEY environment variable to be set
 * - Returns a fake admin user for testing purposes
 */
@Injectable()
export class DevApiKeyStrategy extends PassportStrategy(
  Strategy,
  'dev-api-key',
) {
  private readonly logger = new Logger(DevApiKeyStrategy.name);
  private readonly devApiKey: string | undefined;
  private readonly isProduction: boolean;

  constructor(private readonly prisma: PrismaService) {
    super();
    this.devApiKey = process.env.DEV_API_KEY;
    this.isProduction = AppConfig.env() === 'prod';

    if (this.devApiKey && !this.isProduction) {
      this.logger.log('✅ Dev API key authentication enabled (non-production)');
    }
  }

  async validate(req: Request): Promise<RequestUser | false> {
    // Never allow in production
    if (this.isProduction) {
      return false;
    }

    // Check if dev API key is configured
    if (!this.devApiKey) {
      return false;
    }

    // Check for API key in header
    const apiKey = req.headers['x-api-key'];

    // If no API key provided, let other strategies try (return false, not throw)
    if (!apiKey) {
      return false;
    }

    // If API key IS provided but invalid, throw error
    if (apiKey !== this.devApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Try to find a real admin character for better testing
    const adminChar = await this.prisma.eveCharacter.findFirst({
      where: {
        user: {
          role: 'ADMIN',
        },
      },
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

    if (adminChar && adminChar.user) {
      this.logger.debug(
        `Dev API key authenticated as admin: ${adminChar.name} (${adminChar.id})`,
      );
      return {
        characterId: adminChar.id,
        ownerHash: adminChar.ownerHash,
        name: adminChar.name,
        userId: adminChar.user.id,
        role: adminChar.user.role,
        primaryCharacterId: adminChar.user.primaryCharacterId,
      };
    }

    // Fallback: return a fake admin user if no real admin exists
    this.logger.warn('No admin character found, using fake dev admin');
    return {
      characterId: 99999999,
      ownerHash: 'dev-api-key-fake-hash',
      name: 'Dev API Admin',
      userId: 'dev-api-user-id',
      role: 'ADMIN',
      primaryCharacterId: 99999999,
    };
  }
}
