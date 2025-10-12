import { INestApplication, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      providers: [Logger],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    const logger = app.get(Logger);
    app.useLogger(logger);
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);

    // Spy token exchange to avoid real network
    jest.spyOn(auth, 'exchangeCodeForToken').mockResolvedValue({
      access_token: 'test_access',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'test_refresh',
    } as any);

    // Mock global fetch used by callback verify call

    (global as any).fetch = jest.fn(async () => ({
      json: async () => ({
        CharacterID: 90000001,
        CharacterName: 'TestUser',
        CharacterOwnerHash: 'owner_hash_x',
      }),
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('login/user -> callback creates USER role', async () => {
    const agent = request.agent(app.getHttpServer());
    // Set required cookies directly
    const state = 'test_state_user';
    agent.jar.setCookie(`sso_state=${state}`);
    agent.jar.setCookie(`sso_verifier=test_verifier`);
    agent.jar.setCookie(`sso_kind=user`);

    const cbRes = await agent
      .get('/auth/callback')
      .query({ code: 'abc', state })
      .expect(302);

    const row = await prisma.eveCharacter.findUnique({
      where: { id: 90000001 },
    });
    expect(row).not.toBeNull();
    expect(row?.role).toBe('USER');
  });

  it('login/admin -> callback creates LOGISTICS role', async () => {
    const agent = request.agent(app.getHttpServer());
    const state = 'test_state_admin';
    agent.jar.setCookie(`sso_state=${state}`);
    agent.jar.setCookie(`sso_verifier=test_verifier`);
    agent.jar.setCookie(`sso_kind=admin`);

    // Change mock verify identity for admin flow

    (global as any).fetch = jest.fn(async () => ({
      json: async () => ({
        CharacterID: 90000002,
        CharacterName: 'TestAdmin',
        CharacterOwnerHash: 'owner_hash_y',
      }),
    }));

    const cbRes = await agent
      .get('/auth/callback')
      .query({ code: 'abc', state })
      .expect(302);

    const row = await prisma.eveCharacter.findUnique({
      where: { id: 90000002 },
    });
    expect(row).not.toBeNull();
    expect(row?.role).toBe('LOGISTICS');
  });
});
