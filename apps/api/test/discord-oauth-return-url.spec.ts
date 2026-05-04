import { DiscordOauthService } from '../src/notifications/discord-oauth.service';

describe('DiscordOauthService return URL handling', () => {
  function makeService() {
    const prisma = {
      oAuthState: {
        create: jest.fn(async () => ({})),
      },
    };
    return {
      prisma,
      service: new DiscordOauthService(prisma as any),
    };
  }

  it('falls back instead of storing unsafe return URLs', async () => {
    const { prisma, service } = makeService();

    await service.getAuthorizeUrl('user1', 'https://evil.example/phish');

    expect(prisma.oAuthState.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          returnUrl: 'http://localhost:3001/settings/notifications',
        }),
      }),
    );
  });

  it('stores relative and allowlisted return URLs', async () => {
    const { prisma, service } = makeService();

    await service.getAuthorizeUrl('user1', '/settings/notifications');
    await service.getAuthorizeUrl(
      'user1',
      'http://localhost:3001/settings/notifications',
    );

    expect(prisma.oAuthState.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          returnUrl: '/settings/notifications',
        }),
      }),
    );
    expect(prisma.oAuthState.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          returnUrl: 'http://localhost:3001/settings/notifications',
        }),
      }),
    );
  });
});
