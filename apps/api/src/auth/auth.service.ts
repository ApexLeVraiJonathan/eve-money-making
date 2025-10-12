import { Injectable, Logger } from '@nestjs/common';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../common/config';
import { CryptoUtil } from '../common/crypto.util';

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
};

@Injectable()
export class AuthService {
  private readonly clientId = AppConfig.esiSso().clientId;
  private readonly clientSecret = AppConfig.esiSso().clientSecret;
  private readonly redirectUri = AppConfig.esiSso().redirectUri;
  private readonly userAgent = AppConfig.esiSso().userAgent;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  getAuthorizeUrl(
    state: string,
    codeChallenge: string,
    scopes: string[],
  ): string {
    const base = 'https://login.eveonline.com/v2/oauth/authorize';
    const url = new URL(base);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('client_id', this.clientId);
    if (scopes.length) url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async exchangeCodeForToken(
    code: string,
    codeVerifier: string,
  ): Promise<TokenResponse> {
    const tokenUrl = 'https://login.eveonline.com/v2/oauth/token';
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    const res = await axios.post<TokenResponse>(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier,
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

  async refreshAccessToken(refreshTokenEnc: string): Promise<TokenResponse> {
    const tokenUrl = 'https://login.eveonline.com/v2/oauth/token';
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    const refreshToken = await CryptoUtil.decrypt(refreshTokenEnc);
    const res = await axios.post<TokenResponse>(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
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

  async upsertCharacterWithToken(
    idTokenJwt: string,
    token: TokenResponse,
    scopes: string[],
  ): Promise<{ characterId: number; characterName: string }> {
    // CCP ID token is a JWT; payload contains character info
    const payload = JSON.parse(
      Buffer.from(idTokenJwt.split('.')[1], 'base64').toString('utf8'),
    ) as {
      sub: string; // EVE:CHARACTER:EVE:characterID
      name: string;
      owner: string; // owner hash
    };
    const characterId = Number(payload.sub?.split(':').pop() ?? '0');
    const characterName = payload.name ?? String(characterId);
    const ownerHash = payload.owner ?? '';

    const refreshTokenEnc = await CryptoUtil.encrypt(token.refresh_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.eveCharacter.upsert({
        where: { id: characterId },
        update: { name: characterName, ownerHash },
        create: { id: characterId, name: characterName, ownerHash },
      });
      await tx.characterToken.upsert({
        where: { characterId },
        update: {
          tokenType: token.token_type,
          accessToken: token.access_token,
          accessTokenExpiresAt: expiresAt,
          refreshTokenEnc,
          scopes: scopes.join(' '),
        },
        create: {
          characterId,
          tokenType: token.token_type,
          accessToken: token.access_token,
          accessTokenExpiresAt: expiresAt,
          refreshTokenEnc,
          scopes: scopes.join(' '),
        },
      });
    });

    return { characterId, characterName };
  }

  async setCharacterRole(
    characterId: number,
    role: 'ADMIN' | 'USER' | 'LOGISTICS',
  ): Promise<void> {
    await this.prisma.eveCharacter.update({
      where: { id: characterId },
      data: { role },
    });
  }

  async setCharacterProfile(
    characterId: number,
    func: string | null,
    loc: string | null,
  ): Promise<void> {
    const data: any = {};
    if (func) data.function = func;
    if (loc) data.location = loc;
    await this.prisma.eveCharacter.update({ where: { id: characterId }, data });
  }

  /**
   * Returns linked characters with non-sensitive token metadata.
   * Learning note: Do not return access/refresh tokens; only expiry/scopes.
   */
  async listLinkedCharacters(): Promise<
    Array<{
      characterId: number;
      characterName: string;
      ownerHash: string;
      accessTokenExpiresAt: string | null;
      scopes: string | null;
      role: string;
      function: string | null;
      location: string | null;
    }>
  > {
    const rows = await this.prisma.eveCharacter.findMany({
      include: {
        token: { select: { accessTokenExpiresAt: true, scopes: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    type Row = {
      id: number;
      name: string;
      ownerHash: string;
      token: {
        accessTokenExpiresAt: Date | null;
        scopes: string | null;
      } | null;
    };

    return (rows as Row[]).map((r) => ({
      characterId: r.id,
      characterName: r.name,
      ownerHash: r.ownerHash,
      accessTokenExpiresAt:
        r.token?.accessTokenExpiresAt?.toISOString() ?? null,
      scopes: r.token?.scopes ?? null,
      role: (r as any).role ?? 'USER',
      function: (r as any).function ?? null,
      location: (r as any).location ?? null,
    }));
  }

  /**
   * Uses stored refresh token to rotate access token (and refresh token when provided).
   */
  async refreshCharacterToken(characterId: number): Promise<{
    characterId: number;
    accessTokenExpiresAt: string;
    rotatedRefreshToken: boolean;
  }> {
    const token = await this.prisma.characterToken.findUnique({
      where: { characterId },
      select: {
        refreshTokenEnc: true,
        scopes: true,
      },
    });
    if (!token) {
      throw new Error(`No token found for character ${characterId}`);
    }
    const resp = await this.refreshAccessToken(String(token.refreshTokenEnc));
    const expiresAt = new Date(Date.now() + resp.expires_in * 1000);
    const rotatedRefreshToken = typeof resp.refresh_token === 'string';
    const refreshTokenEnc = rotatedRefreshToken
      ? await CryptoUtil.encrypt(resp.refresh_token)
      : token.refreshTokenEnc;

    await this.prisma.characterToken.update({
      where: { characterId },
      data: {
        tokenType: resp.token_type,
        accessToken: resp.access_token,
        accessTokenExpiresAt: expiresAt,
        refreshTokenEnc,
        // keep existing scopes as-is
      },
    });

    return {
      characterId,
      accessTokenExpiresAt: expiresAt.toISOString(),
      rotatedRefreshToken,
    };
  }

  /**
   * Unlink a character: delete token and character row.
   */
  async unlinkCharacter(characterId: number): Promise<{ removed: boolean }> {
    await this.prisma.$transaction(async (tx) => {
      await tx.characterToken.deleteMany({ where: { characterId } });
      await tx.eveCharacter.deleteMany({ where: { id: characterId } });
    });
    return { removed: true };
  }
}
