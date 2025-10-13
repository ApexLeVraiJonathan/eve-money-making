import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  Delete,
  Param,
  Post,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import crypto from 'node:crypto';
import { AuthService } from './auth.service';
import { CryptoUtil } from '../common/crypto.util';
import { EsiService } from '../esi/esi.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../common/config';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { UseGuards } from '@nestjs/common';
import { CurrentUser, type RequestUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly esi: EsiService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Starts the OAuth flow with PKCE and state.
   * Learning note: state protects against CSRF, PKCE protects public clients.
   */
  @Public()
  @Get('login')
  login(@Res() res: Response, @Query('returnUrl') returnUrl?: string) {
    const state = crypto.randomUUID();
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Store verifier/state in a short-lived, httpOnly cookie for demo simplicity
    res.cookie('sso_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    res.cookie('sso_verifier', codeVerifier, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    if (returnUrl) {
      // Whitelist return URL origins via env (comma-separated), fallback to local dev
      const allowFromEnv = (
        process.env.ESI_SSO_RETURN_URL_ALLOWLIST ||
        'http://localhost:3001,http://127.0.0.1:3001'
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const extraOrigins: string[] = [];
      for (const v of [
        process.env.WEB_BASE_URL,
        process.env.NEXT_PUBLIC_WEB_BASE_URL,
      ]) {
        if (!v) continue;
        try {
          const u = new URL(v);
          extraOrigins.push(u.origin);
        } catch {
          // ignore
        }
      }
      const allow = Array.from(new Set([...allowFromEnv, ...extraOrigins]));
      try {
        const u = new URL(returnUrl);
        if (allow.includes(u.origin)) {
          res.cookie('sso_return', returnUrl, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 10 * 60 * 1000,
          });
        }
      } catch {
        // ignore
      }
    }

    const scopes = (process.env.ESI_SSO_SCOPES ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const url = this.auth.getAuthorizeUrl(state, codeChallenge, scopes);
    res.redirect(url);
  }

  /**
   * Start SSO to link another character to the current user (App 2: Character Linking)
   * Requires authentication via JWT Bearer token
   */
  @Get('link-character/start')
  async linkCharacterStart(
    @CurrentUser() user: RequestUser | null,
    @Res() res: Response,
    @Query('returnUrl') returnUrl?: string,
  ) {
    if (!user?.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const state = crypto.randomUUID();
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Store OAuth state in database with user association
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await this.prisma.oAuthState.create({
      data: {
        state,
        codeVerifier,
        userId: user.userId,
        returnUrl: returnUrl ?? null,
        expiresAt,
      },
    });

    const scopes = (process.env.ESI_SSO_SCOPES_USER ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Use App 2 (Character Linking) OAuth URL
    const url = this.auth.getAuthorizeLinkingUrl(state, codeChallenge, scopes);
    res.redirect(url);
  }

  /**
   * OAuth callback for linking additional characters
   * Public endpoint (no auth required) - uses state from database
   */
  @Public()
  @Get('link-character/callback')
  async linkCharacterCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      res.status(400).send('Missing code or state');
      return;
    }

    // Retrieve OAuth state from database
    const oauthState = await this.prisma.oAuthState.findUnique({
      where: { state },
    });

    if (!oauthState) {
      res.status(400).send('Invalid or expired OAuth state');
      return;
    }

    // Check if state has expired
    if (oauthState.expiresAt < new Date()) {
      await this.prisma.oAuthState.delete({ where: { id: oauthState.id } });
      res.status(400).send('OAuth state expired');
      return;
    }

    // Delete state immediately (single use)
    await this.prisma.oAuthState.delete({ where: { id: oauthState.id } });

    if (!oauthState.userId) {
      res
        .status(401)
        .json({ error: 'No user associated with this linking request' });
      return;
    }

    try {
      // Exchange code for token (using App 2 credentials)
      const token = await this.auth.exchangeCodeForTokenLinking(
        code,
        oauthState.codeVerifier,
      );
      // Verify token and get character info
      const verify = await fetch('https://login.eveonline.com/oauth/verify', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }).then(
        (r) =>
          r.json() as Promise<{
            CharacterID: number;
            CharacterName: string;
            CharacterOwnerHash: string;
          }>,
      );

      // Create a fake JWT for the upsert function
      const idTokenLike = {
        sub: `EVE:CHARACTER:${verify.CharacterID}`,
        name: verify.CharacterName,
        owner: verify.CharacterOwnerHash,
      };
      const fakeJwt = `${Buffer.from('x').toString('base64')}.${Buffer.from(
        JSON.stringify(idTokenLike),
      ).toString('base64')}.x`;

      const scopes = (process.env.ESI_SSO_SCOPES_USER ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // Upsert character and token
      const linked = await this.auth.upsertCharacterWithToken(
        fakeJwt,
        token,
        scopes,
      );

      // Link to user
      await this.auth.linkCharacterToUser(
        linked.characterId,
        oauthState.userId,
      );

      // Redirect to return URL or show success
      if (oauthState.returnUrl) {
        res.redirect(oauthState.returnUrl);
        return;
      }

      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>✅ Character Linked Successfully!</h1>
            <p>Character <strong>${linked.characterName}</strong> has been linked to your account.</p>
            <a href="/" style="color: blue; text-decoration: underline;">Return to App</a>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error linking character:', error);
      res.status(500).send('Failed to link character. Please try again.');
    }
  }
  /**
   * User login: minimal scopes (identity-only).
   */
  @Public()
  @Public()
  @Get('login/user')
  loginUser(@Res() res: Response, @Query('returnUrl') returnUrl?: string) {
    const state = crypto.randomUUID();
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    res.cookie('sso_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    res.cookie('sso_verifier', codeVerifier, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    if (returnUrl)
      res.cookie('sso_return', returnUrl, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
      });
    // Mark intent so callback can tag role
    res.cookie('sso_kind', 'user', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    const scopes = (process.env.ESI_SSO_SCOPES_USER ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const url = this.auth.getAuthorizeUrl(state, codeChallenge, scopes);
    res.redirect(url);
  }

  /**
   * Admin login: full trading scopes.
   */
  @Public()
  @Public()
  @Get('login/admin')
  loginAdmin(@Res() res: Response, @Query('returnUrl') returnUrl?: string) {
    const state = crypto.randomUUID();
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    res.cookie('sso_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    res.cookie('sso_verifier', codeVerifier, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    if (returnUrl)
      res.cookie('sso_return', returnUrl, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
      });
    res.cookie('sso_kind', 'admin', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    const scopes = (
      process.env.ESI_SSO_SCOPES_ADMIN ??
      process.env.ESI_SSO_SCOPES ??
      ''
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const url = this.auth.getAuthorizeUrl(state, codeChallenge, scopes);
    res.redirect(url);
  }

  /**
   * CCP redirects here with authorization code.
   */
  @Public()
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cookies: Record<string, string> = (req.cookies ?? {}) as Record<
      string,
      string
    >;
    const expectedState = cookies['sso_state'];
    const codeVerifier = cookies['sso_verifier'];
    if (!expectedState || !codeVerifier || state !== expectedState) {
      res.status(400).send('Invalid SSO state');
      return;
    }
    // Clear cookies
    res.clearCookie('sso_state');
    res.clearCookie('sso_verifier');

    // Exchange code for tokens
    const token = await this.auth.exchangeCodeForToken(code, codeVerifier);
    // CCP sends id_token via an OpenID connect flow if requested; otherwise we can fetch character via /verify endpoint.
    // Here we use the JWT present in access token response headers if available, else call verify endpoint.
    // For simplicity, call the ESI verify endpoint.
    const verify = await fetch('https://login.eveonline.com/oauth/verify', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).then(
      (r) =>
        r.json() as Promise<{
          CharacterID: number;
          CharacterName: string;
          CharacterOwnerHash: string;
        }>,
    );

    const idTokenLike = {
      sub: `EVE:CHARACTER:${verify.CharacterID}`,
      name: verify.CharacterName,
      owner: verify.CharacterOwnerHash,
    };
    const fakeJwt = `${Buffer.from('x').toString('base64')}.${Buffer.from(JSON.stringify(idTokenLike)).toString('base64')}.x`;
    const kindCookie: string | undefined = cookies['sso_kind'];
    const scopesEnv =
      kindCookie === 'admin'
        ? (process.env.ESI_SSO_SCOPES_ADMIN ?? process.env.ESI_SSO_SCOPES ?? '')
        : kindCookie === 'user'
          ? (process.env.ESI_SSO_SCOPES_USER ?? '')
          : (process.env.ESI_SSO_SCOPES ?? '');
    const scopes = scopesEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const linked = await this.auth.upsertCharacterWithToken(
      fakeJwt,
      token,
      scopes,
    );
    // Role tagging based on login kind
    let resolvedRole: 'LOGISTICS' | 'USER' = 'USER';
    try {
      const kind = cookies['sso_kind'];
      if (kind === 'admin') {
        resolvedRole = 'LOGISTICS';
        await this.auth.setCharacterRole(linked.characterId, 'LOGISTICS');
      } else if (kind === 'user') {
        resolvedRole = 'USER';
        await this.auth.setCharacterRole(linked.characterId, 'USER');
      }
    } catch {
      // non-fatal
    }
    res.clearCookie('sso_kind');

    // Create session cookie bound to the logged-in user/character
    try {
      let userId: string | null = null;
      const kind = cookies['sso_kind'];
      if (kind === 'user') {
        userId = await this.auth.ensureUserForCharacter(linked.characterId);
      }
      const payload = {
        userId,
        characterId: linked.characterId,
        characterName: linked.characterName,
        role: resolvedRole,
        at: Date.now(),
      } as const;
      const enc = await CryptoUtil.encrypt(JSON.stringify(payload));
      const secureCookie = AppConfig.env() === 'prod';
      res.cookie('session', enc, {
        httpOnly: true,
        sameSite: secureCookie ? 'none' : 'lax',
        secure: secureCookie,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    } catch {
      // non-fatal
    }
    const redirectTo = cookies['sso_return'];
    if (redirectTo) {
      res.clearCookie('sso_return');
      res.redirect(redirectTo);
      return;
    }
    // Fallback: redirect to a default URL if configured, or first allowed origin
    const allowFromEnv = (
      process.env.ESI_SSO_RETURN_URL_ALLOWLIST ||
      'http://localhost:3001,http://127.0.0.1:3001'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const extraOrigins: string[] = [];
    for (const v of [
      process.env.WEB_BASE_URL,
      process.env.NEXT_PUBLIC_WEB_BASE_URL,
    ]) {
      if (!v) continue;
      try {
        const u = new URL(v);
        extraOrigins.push(u.origin);
      } catch {
        // ignore
      }
    }
    const allow = Array.from(new Set([...allowFromEnv, ...extraOrigins]));
    let defaultReturn: string | null = null;
    if (process.env.ESI_SSO_DEFAULT_RETURN_URL) {
      try {
        defaultReturn = new URL(
          process.env.ESI_SSO_DEFAULT_RETURN_URL,
        ).toString();
      } catch {
        defaultReturn = null;
      }
    }
    if (!defaultReturn && allow.length > 0) {
      try {
        defaultReturn = new URL('/', allow[0]).toString();
      } catch {
        // ignore
      }
    }
    if (defaultReturn) {
      res.redirect(defaultReturn);
      return;
    }
    res.status(200).json({ linked });
  }

  /**
   * Lists linked characters.
   */
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Get('characters')
  async listCharacters(@Res() res: Response) {
    const rows = await this.auth.listLinkedCharacters();
    res.json({ characters: rows });
  }

  /**
   * Logout - clears the session cookie
   */
  @Get('logout')
  async logout(@Res() res: Response) {
    await Promise.resolve();
    const secureCookie = AppConfig.env() === 'prod';
    res.clearCookie('session', {
      httpOnly: true,
      sameSite: secureCookie ? 'none' : 'lax',
      secure: secureCookie,
    });
    res.json({ ok: true });
    return;
  }

  /**
   * Returns current user identity from validated EVE Bearer token.
   */
  @Get('me')
  me(@CurrentUser() user: RequestUser | null, @Res() res: Response) {
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.json({
      userId: user.userId,
      characterId: user.characterId,
      characterName: user.name,
      role: user.role,
      primaryCharacterId: user.primaryCharacterId,
    });
  }

  /**
   * Refresh a character token.
   */
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Get('refresh')
  async refresh(
    @Query('characterId') characterId: string,
    @Res() res: Response,
  ) {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid characterId' });
      return;
    }
    try {
      const out = await this.auth.refreshCharacterToken(id);
      res.json(out);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  }

  /**
   * Returns wallet balance (ISK) for a linked character via authed ESI.
   */
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Get('wallet')
  async wallet(
    @Query('characterId') characterId: string,
    @Res() res: Response,
  ) {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid characterId' });
      return;
    }
    try {
      const { data } = await this.esi.fetchJson<number>(
        `/latest/characters/${id}/wallet/`,
        { characterId: id },
      );
      res.json({ characterId: id, balanceISK: data });
    } catch (e) {
      res
        .status(400)
        .json({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Unlink a character (remove token and character rows).
   */
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Delete('characters/:id')
  async unlink(@Param('id') idParam: string, @Res() res: Response) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    await this.auth.unlinkCharacter(id);
    res.json({ removed: true, characterId: id });
  }

  /**
   * Update a linked character's function/location (admin usage).
   */
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Get('set-profile')
  async setProfile(
    @Query('characterId') characterId: string,
    @Query('role') role: string,
    @Query('function') func: string,
    @Query('location') loc: string,
    @Res() res: Response,
  ) {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid characterId' });
      return;
    }
    try {
      if (role === 'USER' || role === 'LOGISTICS') {
        await this.auth.setCharacterRole(id, role);
      }
      await this.auth.setCharacterProfile(id, func || null, loc || null);
      res.json({ updated: true, characterId: id });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  }

  /**
   * Admin: Get token status/health for a character.
   */
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Get('admin/characters/:id/token/status')
  async getTokenStatus(@Param('id') idParam: string, @Res() res: Response) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    try {
      const token = await this.prisma.characterToken.findUnique({
        where: { characterId: id },
        select: {
          characterId: true,
          accessTokenExpiresAt: true,
          scopes: true,
          lastRefreshAt: true,
          refreshFailAt: true,
          refreshFailMsg: true,
          updatedAt: true,
        },
      });
      if (!token) {
        res.status(404).json({ error: 'Token not found' });
        return;
      }
      res.json(token);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  }

  /**
   * Admin: Revoke a character's refresh token (clears it in DB).
   */
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Delete('admin/characters/:id/token')
  async revokeToken(@Param('id') idParam: string, @Res() res: Response) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    try {
      await this.prisma.characterToken.update({
        where: { characterId: id },
        data: {
          refreshTokenEnc: '',
          accessToken: '',
          refreshFailAt: new Date(),
          refreshFailMsg: 'manually_revoked',
        },
      });
      res.json({ revoked: true, characterId: id });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  }

  /**
   * Link additional character to existing user (from NextAuth linking flow)
   * Requires authentication via JWT Bearer token from the EXISTING session
   */
  @Post('link-additional-character')
  async linkAdditionalCharacter(
    @CurrentUser() user: RequestUser | null,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!user?.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    try {
      const body = req.body as {
        characterId: number;
        characterName: string;
        ownerHash: string;
        accessToken: string;
        refreshToken?: string;
        expiresIn: number;
        scopes: string;
      };

      const {
        characterId,
        characterName,
        ownerHash,
        accessToken,
        refreshToken,
        expiresIn,
        scopes,
      } = body;

      if (!characterId || !characterName || !ownerHash || !accessToken) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const refreshTokenEnc = refreshToken
        ? await CryptoUtil.encrypt(refreshToken)
        : '';

      const expiresInSeconds = Number(expiresIn) || 1200;
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      // Upsert character and token, then link to the authenticated user
      await this.prisma.$transaction(async (tx) => {
        await tx.eveCharacter.upsert({
          where: { id: characterId },
          update: {
            name: characterName,
            ownerHash,
            userId: user.userId, // Link to existing user
          },
          create: {
            id: characterId,
            name: characterName,
            ownerHash,
            managedBy: 'USER',
            userId: user.userId,
          },
        });

        await tx.characterToken.upsert({
          where: { characterId },
          update: {
            tokenType: 'Bearer',
            accessToken,
            accessTokenExpiresAt: expiresAt,
            refreshTokenEnc,
            scopes,
            lastRefreshAt: new Date(),
          },
          create: {
            characterId,
            tokenType: 'Bearer',
            accessToken,
            accessTokenExpiresAt: expiresAt,
            refreshTokenEnc,
            scopes,
          },
        });
      });

      res.json({ success: true, characterId, characterName });
    } catch (e) {
      console.error('Error linking additional character:', e);
      res.status(500).json({
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
    }
  }

  /**
   * Link character from NextAuth callback - creates/updates character and tokens in DB
   */
  @Public()
  @Post('link-character')
  async linkCharacterFromNextAuth(@Req() req: Request, @Res() res: Response) {
    try {
      const body = req.body as {
        characterId: number;
        characterName: string;
        ownerHash: string;
        accessToken: string;
        refreshToken?: string;
        expiresIn: number;
        scopes: string;
      };

      const {
        characterId,
        characterName,
        ownerHash,
        accessToken,
        refreshToken,
        expiresIn,
        scopes,
      } = body;

      if (!characterId || !characterName || !ownerHash || !accessToken) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Encrypt refresh token if provided
      const refreshTokenEnc = refreshToken
        ? await CryptoUtil.encrypt(refreshToken)
        : '';

      // Parse expiresIn safely with fallback (EVE tokens typically last 20 minutes for auth-only)
      const expiresInSeconds = Number(expiresIn) || 1200; // 20 minutes default
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      // Upsert character and token in a transaction
      await this.prisma.$transaction(async (tx) => {
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

        // Upsert token
        await tx.characterToken.upsert({
          where: { characterId },
          update: {
            tokenType: 'Bearer',
            accessToken,
            accessTokenExpiresAt: expiresAt,
            refreshTokenEnc,
            scopes,
            lastRefreshAt: new Date(),
          },
          create: {
            characterId,
            tokenType: 'Bearer',
            accessToken,
            accessTokenExpiresAt: expiresAt,
            refreshTokenEnc,
            scopes,
          },
        });

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

      res.json({ success: true, characterId, characterName });
    } catch (e) {
      console.error('Error linking character:', e);
      res.status(500).json({
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
    }
  }
}
