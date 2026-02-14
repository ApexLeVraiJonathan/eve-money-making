import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../common/config';
import { CryptoUtil } from '../../common/crypto.util';

@Injectable()
export class TokenService {
  private readonly ssoConfig = AppConfig.esiSso();
  private readonly clientId = this.ssoConfig.clientId;
  private readonly clientSecret = this.ssoConfig.clientSecret;
  private readonly userAgent = this.ssoConfig.userAgent;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  private async refreshWithClient(
    refreshPlain: string,
    client: {
      clientId: string;
      clientSecret: string;
    },
  ): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
  }> {
    const basic = Buffer.from(
      `${client.clientId}:${client.clientSecret}`,
    ).toString('base64');
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
    return res.data;
  }

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

    try {
      const refreshPlain = await CryptoUtil.decrypt(
        String(token.refreshTokenEnc ?? ''),
      );
      const data = await this.refreshWithClient(refreshPlain, {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });
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
          lastRefreshAt: new Date(),
          refreshFailAt: null,
          refreshFailMsg: null,
        },
      });
      return data.access_token;
    } catch (e: any) {
      const details =
        e?.response?.data ?? (e instanceof Error ? e.message : String(e));
      this.logger.warn(
        `Token refresh failed for character ${characterId}: ${JSON.stringify(details)}`,
      );
      // Record failure and return null so callers can handle auth errors explicitly.
      await this.prisma.characterToken
        .update({
          where: { characterId },
          data: {
            refreshFailAt: new Date(),
            refreshFailMsg: String(details).slice(0, 500),
          },
        })
        .catch(() => undefined);
      return null;
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

    try {
      const refreshPlain = await CryptoUtil.decrypt(
        String(character.token.refreshTokenEnc ?? ''),
      );
      const data = await this.refreshWithClient(refreshPlain, {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });
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
          lastRefreshAt: new Date(),
          refreshFailAt: null,
          refreshFailMsg: null,
        },
      });
      return data.access_token;
    } catch (e: any) {
      const details =
        e?.response?.data ?? (e instanceof Error ? e.message : String(e));
      this.logger.warn(
        `Force token refresh failed for character ${characterId}: ${JSON.stringify(details)}`,
      );
      await this.prisma.characterToken
        .update({
          where: { characterId },
          data: {
            refreshFailAt: new Date(),
            refreshFailMsg: String(details).slice(0, 500),
          },
        })
        .catch(() => undefined);
      return null;
    }
  }
}
