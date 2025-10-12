import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  Delete,
  Param,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import crypto from 'node:crypto';
import { AuthService } from './auth.service';
import { EsiService } from '../esi/esi.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly esi: EsiService,
  ) {}

  /**
   * Starts the OAuth flow with PKCE and state.
   * Learning note: state protects against CSRF, PKCE protects public clients.
   */
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
   * User login: minimal scopes (identity-only).
   */
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
    try {
      const kind = cookies['sso_kind'];
      if (kind === 'admin') {
        await this.auth.setCharacterRole(linked.characterId, 'LOGISTICS');
      } else if (kind === 'user') {
        await this.auth.setCharacterRole(linked.characterId, 'USER');
      }
    } catch {
      // non-fatal
    }
    res.clearCookie('sso_kind');
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
  @Get('characters')
  async listCharacters(@Res() res: Response) {
    const rows = await this.auth.listLinkedCharacters();
    res.json({ characters: rows });
  }

  /**
   * Refresh a character token.
   */
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
      if (role === 'ADMIN' || role === 'USER' || role === 'LOGISTICS') {
        await this.auth.setCharacterRole(id, role);
      }
      await this.auth.setCharacterProfile(id, func || null, loc || null);
      res.json({ updated: true, characterId: id });
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  }
}
