import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoUtil } from '../common/crypto.util';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class EsiTokenService {
  private readonly logger = new Logger(EsiTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a valid access token for a character, refreshing if necessary.
   * Throws if token refresh fails.
   */
  async getAccessToken(characterId: number): Promise<string> {
    const token = await this.prisma.characterToken.findUnique({
      where: { characterId },
    });

    if (!token) {
      throw new Error(`No token found for character ${characterId}`);
    }

    // Check if token is still valid (with 60s buffer)
    const soon = new Date(Date.now() + 60_000);
    if (token.accessToken && token.accessTokenExpiresAt > soon) {
      return token.accessToken;
    }

    // Token is expired or about to expire, refresh it
    this.logger.log(
      `Refreshing access token for character ${characterId}`,
      'TokenRefresh',
    );

    try {
      const refreshToken = await CryptoUtil.decrypt(token.refreshTokenEnc);

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const clientId = process.env.EVE_CLIENT_ID;
      const clientSecret = process.env.EVE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('EVE_CLIENT_ID or EVE_CLIENT_SECRET not configured');
      }

      const authHeader =
        'Basic ' +
        Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await axios.post<{
        access_token: string;
        expires_in: number;
        refresh_token?: string;
      }>('https://login.eveonline.com/v2/oauth/token', body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: authHeader,
        },
      });

      const { access_token, expires_in, refresh_token } = response.data;

      // Decode the new access token to check owner hash (without verification since we already trust EVE's response)
      const decoded = jwt.decode(access_token) as {
        owner?: string;
        sub?: string;
      } | null;

      if (decoded?.owner) {
        // Check if owner has changed
        const ownerValid = await this.checkOwnerHashAndRevoke(
          characterId,
          decoded.owner,
        );

        if (!ownerValid) {
          throw new Error(
            `Character ${characterId} owner has changed - token revoked, relink required`,
          );
        }
      }

      // Update token in database
      const newRefreshEnc = refresh_token
        ? await CryptoUtil.encrypt(refresh_token)
        : token.refreshTokenEnc;

      await this.prisma.characterToken.update({
        where: { characterId },
        data: {
          accessToken: access_token,
          accessTokenExpiresAt: new Date(Date.now() + expires_in * 1000),
          refreshTokenEnc: newRefreshEnc,
          lastRefreshAt: new Date(),
          refreshFailAt: null,
          refreshFailMsg: null,
        },
      });

      this.logger.log(
        `Successfully refreshed token for character ${characterId}`,
        'TokenRefresh',
      );

      return access_token;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { error_description?: string } | string };
        message?: string;
      };
      const errorMessage = String(
        err?.response?.data &&
          typeof err.response.data === 'object' &&
          'error_description' in err.response.data
          ? err.response.data.error_description
          : (err?.response?.data ?? err?.message ?? error),
      );

      this.logger.error(
        `Failed to refresh token for character ${characterId}: ${errorMessage}`,
        'TokenRefresh',
      );

      // Record the failure
      await this.prisma.characterToken.update({
        where: { characterId },
        data: {
          refreshFailAt: new Date(),
          refreshFailMsg: errorMessage.substring(0, 500), // Limit message length
        },
      });

      throw new Error(
        `Failed to refresh token for character ${characterId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Check owner hash and revoke token if changed.
   */
  async checkOwnerHashAndRevoke(
    characterId: number,
    currentOwnerHash: string,
  ): Promise<boolean> {
    const character = await this.prisma.eveCharacter.findUnique({
      where: { id: characterId },
      select: { ownerHash: true },
    });

    if (!character) {
      return false;
    }

    if (character.ownerHash !== currentOwnerHash) {
      this.logger.warn(
        `Owner hash mismatch for character ${characterId}, revoking token`,
        'OwnerHashCheck',
      );

      // Revoke the token
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
          /* ignore if no token */
        });

      return false;
    }

    return true;
  }
}
