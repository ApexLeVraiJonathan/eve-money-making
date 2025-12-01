import { Injectable, Logger } from '@nestjs/common';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../common/config';
import { CryptoUtil } from '../../common/crypto.util';

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
};

@Injectable()
export class AuthService {
  private readonly ssoConfig = AppConfig.esiSso();
  private readonly clientId = this.ssoConfig.clientId;
  private readonly clientSecret = this.ssoConfig.clientSecret;
  private readonly redirectUri = this.ssoConfig.redirectUri;
  private readonly userAgent = this.ssoConfig.userAgent;

  // Unified client with per-flow redirect URIs
  private readonly linkingRedirectUri = AppConfig.esiSsoLinking().redirectUri;
  private readonly systemRedirectUri = AppConfig.esiSsoSystem().redirectUri;

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

  /**
   * Get OAuth URL for character linking (uses App 2 credentials)
   */
  getAuthorizeLinkingUrl(
    state: string,
    codeChallenge: string,
    scopes: string[],
  ): string {
    const base = 'https://login.eveonline.com/v2/oauth/authorize';
    const url = new URL(base);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.linkingRedirectUri);
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

  /**
   * Exchange authorization code for tokens (character linking with App 2)
   */
  async exchangeCodeForTokenLinking(
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
        redirect_uri: this.linkingRedirectUri,
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

  /**
   * Get OAuth URL for admin system character linking (uses App 3 credentials)
   */
  getAuthorizeSystemUrl(
    state: string,
    codeChallenge: string,
    scopes: string[],
  ): string {
    const base = 'https://login.eveonline.com/v2/oauth/authorize';
    const url = new URL(base);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.systemRedirectUri);
    url.searchParams.set('client_id', this.clientId);
    if (scopes.length) url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  /**
   * Exchange authorization code for tokens (system characters with App 3)
   */
  async exchangeCodeForTokenSystem(
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
        redirect_uri: this.systemRedirectUri,
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

    // Merge newly granted scopes with any existing scopes so we never
    // accidentally drop permissions that were granted during character
    // linking (e.g. skills/wallet scopes). Logging in with a minimal
    // scope set like "publicData" should not overwrite the richer
    // character-management scopes that are required elsewhere.
    const existingToken = await this.prisma.characterToken.findUnique({
      where: { characterId },
      select: { scopes: true },
    });
    const existingScopes = (existingToken?.scopes ?? '')
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean);
    const nextScopes = scopes ?? [];
    const mergedScopes = Array.from(
      new Set<string>([...existingScopes, ...nextScopes]),
    );
    const mergedScopesStr = mergedScopes.join(' ');

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
          scopes: mergedScopesStr,
        },
        create: {
          characterId,
          tokenType: token.token_type,
          accessToken: token.access_token,
          accessTokenExpiresAt: expiresAt,
          refreshTokenEnc,
          scopes: mergedScopesStr,
        },
      });
    });

    return { characterId, characterName };
  }

  async setCharacterRole(
    characterId: number,
    role: 'USER' | 'LOGISTICS',
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
   * Ensure a User exists for the given character. If the character is not linked
   * to a user, create a new user and link it. Also set primaryCharacterId if the
   * user has none.
   */
  async ensureUserForCharacter(characterId: number): Promise<string> {
    const ch = await this.prisma.eveCharacter.findUnique({
      where: { id: characterId },
      select: { id: true, userId: true },
    });
    if (!ch) throw new Error('Character not found');
    if (ch.userId) {
      // Ensure primary set
      const u = await this.prisma.user.findUnique({
        where: { id: ch.userId },
        select: { id: true, primaryCharacterId: true },
      });
      if (u && !u.primaryCharacterId) {
        await this.prisma.user.update({
          where: { id: u.id },
          data: { primaryCharacterId: characterId },
        });
      }
      return ch.userId;
    }
    // Create user and link
    const user = await this.prisma.user.create({
      data: { role: 'USER', primaryCharacterId: characterId },
      select: { id: true },
    });
    await this.prisma.eveCharacter.update({
      where: { id: characterId },
      data: { userId: user.id },
    });
    return user.id;
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
   * Link an existing character to an existing user.
   */
  async linkCharacterToUser(
    characterId: number,
    userId: string,
  ): Promise<void> {
    await this.prisma.eveCharacter.update({
      where: { id: characterId },
      data: { userId },
    });
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

  /**
   * Link a character from NextAuth callback.
   * Creates/updates character and token in database within a transaction.
   */
  async linkCharacterFromNextAuth(input: {
    characterId: number;
    characterName: string;
    ownerHash: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    scopes: string;
  }): Promise<{ success: true; characterId: number; characterName: string }> {
    const {
      characterId,
      characterName,
      ownerHash,
      accessToken,
      refreshToken,
      expiresIn,
      scopes,
    } = input;

    // Encrypt refresh token if provided
    const refreshTokenEnc = refreshToken
      ? await CryptoUtil.encrypt(refreshToken)
      : '';

    // Parse expiresIn safely with fallback (EVE tokens typically last 20 minutes for auth-only)
    const expiresInSeconds = Number(expiresIn) || 1200; // 20 minutes default
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Upsert character and token in a transaction
    await this.prisma.$transaction(async (tx) => {
      const normalizeScopes = (value: string | null | undefined): string[] =>
        (value ?? '')
          .split(' ')
          .map((s) => s.trim())
          .filter(Boolean);

      // Important ESI scopes we never want to silently drop for an existing character.
      const importantScopes = new Set<string>([
        'esi-markets.read_character_orders.v1',
        'esi-wallet.read_character_wallet.v1',
        'esi-assets.read_assets.v1',
        'esi-contracts.read_character_contracts.v1',
        'esi-location.read_location.v1',
        'esi-skills.read_skills.v1',
        'esi-skills.read_skillqueue.v1',
      ]);

      // Upsert character
      const character = await tx.eveCharacter.upsert({
        where: { id: characterId },
        update: {
          name: characterName,
          ownerHash,
        },
        create: {
          id: characterId,
          name: characterName,
          ownerHash,
          managedBy: 'USER',
        },
      });

      // Never modify tokens for SYSTEM-managed characters from the NextAuth flow.
      // Their ESI credentials are controlled via the admin/system SSO flows.
      if (character.managedBy === 'SYSTEM') {
        return;
      }

      // Load any existing token to avoid overwriting a wide-scope trading token
      // with a narrower "login-only" token from NextAuth.
      const existingToken = await tx.characterToken.findUnique({
        where: { characterId },
        select: { scopes: true },
      });

      const existingScopes = normalizeScopes(existingToken?.scopes);
      const incomingScopes = normalizeScopes(scopes);

      const existingSet = new Set(existingScopes);
      const incomingSet = new Set(incomingScopes);

      const wouldLoseImportantScope = Array.from(existingSet).some(
        (s) => importantScopes.has(s) && !incomingSet.has(s),
      );

      // If this NextAuth flow would *remove* important ESI scopes from an
      // already-linked trading character, keep the existing token as-is.
      if (existingToken && wouldLoseImportantScope) {
        this.logger.warn(
          `Skipping token update from NextAuth for character ${characterId} to avoid dropping important ESI scopes. ` +
            `Existing="${existingScopes.join(' ')}", incoming="${incomingScopes.join(' ')}"`,
        );
      } else {
        // Merge scopes so we retain the union of what has ever been granted.
        const mergedScopes = Array.from(
          new Set<string>([...existingScopes, ...incomingScopes]),
        ).join(' ');

        await tx.characterToken.upsert({
          where: { characterId },
          update: {
            tokenType: 'Bearer',
            accessToken,
            accessTokenExpiresAt: expiresAt,
            refreshTokenEnc,
            scopes: mergedScopes,
            lastRefreshAt: new Date(),
          },
          create: {
            characterId,
            tokenType: 'Bearer',
            accessToken,
            accessTokenExpiresAt: expiresAt,
            refreshTokenEnc,
            scopes: mergedScopes,
          },
        });
      }

      // Ensure user exists for this character
      if (!character.userId) {
        const user = await tx.user.create({
          data: {
            role: 'USER',
            primaryCharacterId: characterId,
          },
        });
        await tx.eveCharacter.update({
          where: { id: characterId },
          data: { userId: user.id },
        });
      }
    });

    return { success: true, characterId, characterName };
  }
}
