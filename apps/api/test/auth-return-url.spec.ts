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
});
