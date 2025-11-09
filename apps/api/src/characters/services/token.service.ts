import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../common/config';
import { CryptoUtil } from '../../common/crypto.util';

@Injectable()
export class TokenService {
  private readonly userAgent = AppConfig.esiSso().userAgent;

  // App 2: Character linking credentials (for managedBy=USER)
  private readonly linkingClientId = AppConfig.esiSsoLinking().clientId;
  private readonly linkingClientSecret = AppConfig.esiSsoLinking().clientSecret;

  // App 3: System character credentials (for managedBy=SYSTEM)
  private readonly systemClientId = AppConfig.esiSsoSystem().clientId;
  private readonly systemClientSecret = AppConfig.esiSsoSystem().clientSecret;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Returns a usable access token for a character, refreshing if near expiry.
   */
  async getValidAccessToken(characterId: number): Promise<string | null> {
    const character = await this.prisma.eveCharacter.findUnique({
      where: { id: characterId },
      select: {
        managedBy: true,
        token: {
          select: {
            accessToken: true,
            accessTokenExpiresAt: true,
            refreshTokenEnc: true,
            tokenType: true,
          },
        },
      },
    });
    if (!character?.token) return null;

    const token = character.token;
    const now = Date.now();
    const expMs = token.accessTokenExpiresAt
      ? token.accessTokenExpiresAt.getTime()
      : 0;
    const needsRefresh = !expMs || expMs - now < 30_000;
    if (!needsRefresh) return token.accessToken ?? null;

    // Use App 3 credentials for SYSTEM-managed chars, App 2 for USER-managed chars
    const isSystemChar = character.managedBy === 'SYSTEM';
    const clientId = isSystemChar ? this.systemClientId : this.linkingClientId;
    const clientSecret = isSystemChar
      ? this.systemClientSecret
      : this.linkingClientSecret;

    try {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64',
      );
      const refreshPlain = await CryptoUtil.decrypt(
        String(token.refreshTokenEnc ?? ''),
      );
      const res = await axios.post<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token?: string;
      }>(
        'https://login.eveonline.com/v2/oauth/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshPlain,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basic}`,
            'User-Agent': this.userAgent,
          },
        },
      );
      const data = res.data;
      const newExp = new Date(Date.now() + Number(data.expires_in) * 1000);
      const newRefreshEnc = data.refresh_token
        ? await CryptoUtil.encrypt(data.refresh_token)
        : String(token.refreshTokenEnc);
      await this.prisma.characterToken.update({
        where: { characterId },
        data: {
          accessToken: data.access_token,
          accessTokenExpiresAt: newExp,
          refreshTokenEnc: newRefreshEnc,
          tokenType: data.token_type,
        },
      });
      return data.access_token;
    } catch (e) {
      this.logger.warn(
        `Token refresh failed for character ${characterId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return token.accessToken ?? null;
    }
  }

  /**
   * Forces an access token rotation using the stored refresh token.
   * Returns the new access token string, or null if rotation fails.
   */
  async forceRotateAccessToken(characterId: number): Promise<string | null> {
    const character = await this.prisma.eveCharacter.findUnique({
      where: { id: characterId },
      select: {
        managedBy: true,
        token: {
          select: {
            refreshTokenEnc: true,
          },
        },
      },
    });
    if (!character?.token) return null;

    // Use App 3 credentials for SYSTEM-managed chars, App 2 for USER-managed chars
    const isSystemChar = character.managedBy === 'SYSTEM';
    const clientId = isSystemChar ? this.systemClientId : this.linkingClientId;
    const clientSecret = isSystemChar
      ? this.systemClientSecret
      : this.linkingClientSecret;

    try {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64',
      );
      const refreshPlain = await CryptoUtil.decrypt(
        String(character.token.refreshTokenEnc ?? ''),
      );
      const res = await axios.post<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token?: string;
      }>(
        'https://login.eveonline.com/v2/oauth/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshPlain,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basic}`,
            'User-Agent': this.userAgent,
          },
        },
      );
      const data = res.data;
      const newExp = new Date(Date.now() + Number(data.expires_in) * 1000);
      const newRefreshEnc = data.refresh_token
        ? await CryptoUtil.encrypt(data.refresh_token)
        : String(character.token.refreshTokenEnc);
      await this.prisma.characterToken.update({
        where: { characterId },
        data: {
          accessToken: data.access_token,
          accessTokenExpiresAt: newExp,
          refreshTokenEnc: newRefreshEnc,
          tokenType: data.token_type,
        },
      });
      return data.access_token;
    } catch (e) {
      this.logger.warn(
        `Force token refresh failed for character ${characterId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }
}
