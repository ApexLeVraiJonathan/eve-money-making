import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import crypto from 'node:crypto';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppConfig } from '@api/common/config';

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

type DiscordUserResponse = {
  id: string;
  username: string;
  discriminator?: string;
  global_name?: string | null;
  avatar?: string | null;
};

@Injectable()
export class DiscordOauthService {
  private readonly logger = new Logger(DiscordOauthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Start Discord OAuth for the given user and return the authorization URL.
   */
  async getAuthorizeUrl(userId: string, returnUrl?: string): Promise<string> {
    const discord = AppConfig.discordOauth();
    if (!discord.clientId || !discord.clientSecret) {
      this.logger.warn(
        'Discord OAuth is not fully configured. Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET.',
      );
    }

    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.oAuthState.create({
      data: {
        state,
        codeVerifier: 'discord',
        userId,
        returnUrl:
          returnUrl ??
          new URL('/settings/notifications', AppConfig.webBaseUrl()).toString(),
        expiresAt,
      },
    });

    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', discord.clientId);
    url.searchParams.set('redirect_uri', discord.redirectUri);
    // Request guilds.join so we can auto-join the user to our server
    url.searchParams.set('scope', 'identify guilds.join');
    url.searchParams.set('state', state);

    return url.toString();
  }

  /**
   * Handle Discord OAuth callback, persist DiscordAccount and return redirect URL.
   */
  async handleCallback(code: string, state: string): Promise<string> {
    const discord = AppConfig.discordOauth();
    if (!discord.clientId || !discord.clientSecret) {
      throw new Error('Discord OAuth is not configured on the server.');
    }

    const oauthState = await this.prisma.oAuthState.findUnique({
      where: { state },
    });

    if (!oauthState) {
      throw new Error('Invalid or expired OAuth state.');
    }

    if (oauthState.expiresAt < new Date()) {
      await this.prisma.oAuthState.delete({
        where: { id: oauthState.id },
      });
      throw new Error('OAuth state has expired. Please start again.');
    }

    if (!oauthState.userId) {
      await this.prisma.oAuthState.delete({
        where: { id: oauthState.id },
      });
      throw new Error('No user associated with this Discord linking request.');
    }

    // Single use
    await this.prisma.oAuthState.delete({ where: { id: oauthState.id } });

    const token = await this.exchangeCodeForToken(code, discord);
    const user = await this.fetchDiscordUser(token.access_token);

    const avatarUrl =
      user.avatar && user.id
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null;

    const existing = await this.prisma.discordAccount.findFirst({
      where: { discordUserId: user.id },
      orderBy: { linkedAt: 'desc' },
    });

    const discordAccountPayload = {
      userId: oauthState.userId,
      discordUserId: user.id,
      username: user.username ?? user.global_name ?? user.id,
      discriminator: user.discriminator ?? null,
      avatarUrl,
    };

    if (existing) {
      await this.prisma.discordAccount.update({
        where: { id: existing.id },
        data: discordAccountPayload,
      });
    } else {
      await this.prisma.discordAccount.create({
        data: discordAccountPayload,
      });
    }

    // Option B: Attempt to auto-join the user to our Discord guild so that DMs can work.
    const guildId = AppConfig.discordGuildId();
    const botToken = AppConfig.discordBotToken();
    if (guildId && botToken) {
      const scopes = (token.scope ?? '')
        .split(' ')
        .map((s) => s.trim())
        .filter(Boolean);

      if (scopes.includes('guilds.join')) {
        try {
          await axios.put(
            `https://discord.com/api/guilds/${guildId}/members/${user.id}`,
            { access_token: token.access_token },
            {
              headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json',
              },
            },
          );
        } catch (error) {
          this.logger.warn(
            `Failed to auto-join Discord user ${user.id} to guild ${guildId}: ${String(
              error instanceof Error ? error.message : error,
            )}`,
          );
        }
      }
    }

    return (
      oauthState.returnUrl ??
      new URL('/settings/notifications', AppConfig.webBaseUrl()).toString()
    );
  }

  async getAccountForUser(userId: string) {
    return await this.prisma.discordAccount.findFirst({
      where: { userId },
      orderBy: { linkedAt: 'desc' },
    });
  }

  async disconnectForUser(userId: string) {
    await this.prisma.discordAccount.deleteMany({
      where: { userId },
    });
  }

  private async exchangeCodeForToken(
    code: string,
    discord: ReturnType<typeof AppConfig.discordOauth>,
  ): Promise<DiscordTokenResponse> {
    const tokenUrl = 'https://discord.com/api/oauth2/token';
    const body = new URLSearchParams({
      client_id: discord.clientId,
      client_secret: discord.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: discord.redirectUri,
    });

    const res = await axios.post<DiscordTokenResponse>(tokenUrl, body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return res.data;
  }

  private async fetchDiscordUser(
    accessToken: string,
  ): Promise<DiscordUserResponse> {
    const res = await axios.get<DiscordUserResponse>(
      'https://discord.com/api/users/@me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return res.data;
  }
}
