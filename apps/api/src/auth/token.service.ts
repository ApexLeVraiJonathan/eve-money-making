import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../common/config';
import { CryptoUtil } from '../common/crypto.util';

@Injectable()
export class TokenService {
  private readonly clientId = AppConfig.esiSso().clientId;
  private readonly clientSecret = AppConfig.esiSso().clientSecret;
  private readonly userAgent = AppConfig.esiSso().userAgent;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Returns a usable access token for a character, refreshing if near expiry.
   */
  async getValidAccessToken(characterId: number): Promise<string | null> {
    const token = await this.prisma.characterToken.findUnique({
      where: { characterId },
      select: {
        accessToken: true,
        accessTokenExpiresAt: true,
        refreshTokenEnc: true,
        tokenType: true,
      },
    });
    if (!token) return null;

    const now = Date.now();
    const expMs = token.accessTokenExpiresAt
      ? token.accessTokenExpiresAt.getTime()
      : 0;
    const needsRefresh = !expMs || expMs - now < 30_000;
    if (!needsRefresh) return token.accessToken ?? null;

    try {
      const basic = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString('base64');
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
    const token = await this.prisma.characterToken.findUnique({
      where: { characterId },
      select: {
        refreshTokenEnc: true,
      },
    });
    if (!token) return null;

    try {
      const basic = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString('base64');
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
        `Force token refresh failed for character ${characterId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }
}
