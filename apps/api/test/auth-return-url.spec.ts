import { AuthController } from '../src/characters/auth.controller';

type MockResponse = {
  cookie: jest.Mock;
  redirect: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
  clearCookie: jest.Mock;
};

function makeResponse(): MockResponse {
  return {
    cookie: jest.fn(),
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
    clearCookie: jest.fn(),
  };
}

function makeController() {
  const auth = {
    getAuthorizeUrl: jest.fn(() => 'https://login.eveonline.test/oauth'),
    getAuthorizeLinkingUrl: jest.fn(() => 'https://login.eveonline.test/link'),
    getUserRequestedScopes: jest.fn(async () => ['publicData']),
  };
  const oauthStates = {
    createUserLinkState: jest.fn(async () => undefined),
    findByState: jest.fn(async () => null),
  };
  const controller = new AuthController(
    auth as any,
    {} as any,
    oauthStates as any,
    {} as any,
    {} as any,
  );

  return { auth, controller, oauthStates };
}

function getCookieValue(res: MockResponse, name: string): unknown {
  return res.cookie.mock.calls.find(([cookieName]) => cookieName === name)?.[1];
}

function getCookieOptions(res: MockResponse, name: string): unknown {
  return res.cookie.mock.calls.find(([cookieName]) => cookieName === name)?.[2];
}

describe('AuthController return URL handling', () => {
  it('does not store untrusted return URLs in SSO cookies', () => {
    const { controller } = makeController();
    const res = makeResponse();

    controller.loginUser(res as any, 'https://evil.example/phish');

    expect(getCookieValue(res, 'sso_return')).toBeUndefined();
    expect(res.redirect).toHaveBeenCalledWith(
      'https://login.eveonline.test/oauth',
    );
  });

  it('stores allowlisted and relative return URLs in SSO cookies', () => {
    const { controller } = makeController();
    const allowedRes = makeResponse();
    const relativeRes = makeResponse();

    controller.loginUser(allowedRes as any, 'http://localhost:3001/tradecraft');
    controller.loginUser(
      relativeRes as any,
      '/characters/skills/browser',
    );

    expect(getCookieValue(allowedRes, 'sso_return')).toBe(
      'http://localhost:3001/tradecraft',
    );
    expect(getCookieValue(relativeRes, 'sso_return')).toBe(
      '/characters/skills/browser',
    );
  });

  it('sanitizes link-character return URLs before persisting OAuth state', async () => {
    const { controller, oauthStates } = makeController();
    const res = makeResponse();

    await controller.linkCharacterStart(
      { userId: 'user1' } as any,
      res as any,
      'https://evil.example/phish',
    );

    expect(oauthStates.createUserLinkState).toHaveBeenCalledWith(
      expect.objectContaining({ returnUrl: null }),
    );

    const safeRes = makeResponse();
    await controller.linkCharacterStart(
      { userId: 'user1' } as any,
      safeRes as any,
      '/characters/skills/browser',
    );

    expect(oauthStates.createUserLinkState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        returnUrl: '/characters/skills/browser',
      }),
    );
  });

  it('scopes production session cookies to the configured parent domain', async () => {
    const previousAppEnv = process.env.APP_ENV;
    const previousSessionCookieDomain = process.env.SESSION_COOKIE_DOMAIN;
    process.env.APP_ENV = 'prod';
    process.env.SESSION_COOKIE_DOMAIN = '.apexapps.gg';

    try {
      const { controller, auth } = makeController();
      const res = makeResponse();
      const req = {
        cookies: {
          sso_state: 'state-1',
          sso_verifier: 'verifier-1',
          sso_kind: 'user',
        },
      };

      auth.exchangeCodeForToken = jest.fn(async () => ({
        access_token: 'token',
      }));
      auth.upsertCharacterWithToken = jest.fn(async () => ({
        characterId: 123,
        characterName: 'Pilot',
      }));
      auth.setCharacterRole = jest.fn(async () => undefined);
      auth.ensureUserForCharacter = jest.fn(async () => 'user-1');

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        json: async () => ({
          CharacterID: 123,
          CharacterName: 'Pilot',
          CharacterOwnerHash: 'owner',
        }),
      } as Response);

      await controller.callback('code-1', 'state-1', req as any, res as any);

      expect(getCookieOptions(res, 'session')).toEqual(
        expect.objectContaining({
          domain: '.apexapps.gg',
          httpOnly: true,
          sameSite: 'none',
          secure: true,
        }),
      );
    } finally {
      process.env.APP_ENV = previousAppEnv;
      process.env.SESSION_COOKIE_DOMAIN = previousSessionCookieDomain;
      jest.restoreAllMocks();
    }
  });
});
