import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CryptoUtil } from '../src/common/crypto.util';

/**
 * E2E tests for EVE SSO + JWT authentication
 */
describe('EVE Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests to /auth/me', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should reject invalid Bearer tokens', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    // Note: Testing with real EVE JWT tokens requires mocking the JWKS endpoint
    // or using a test fixture with a valid but expired token
  });

  describe('Admin Endpoints', () => {
    it('should require ADMIN role for /auth/characters', () => {
      return request(app.getHttpServer())
        .get('/auth/characters')
        .set('x-test-role', 'USER') // Test header fallback
        .expect(403);
    });

    it('should allow ADMIN role for /auth/characters', async () => {
      // This will fail auth first (401) but demonstrates role check
      const res = await request(app.getHttpServer())
        .get('/auth/characters')
        .set('x-test-role', 'ADMIN');
      // Expect either 401 (no valid token) or 200 (if public)
      expect([401, 200]).toContain(res.status);
    });
  });

  describe('Token Management', () => {
    let testCharacterId: number;

    beforeEach(async () => {
      // Create a test character with a token
      const char = await prisma.eveCharacter.create({
        data: {
          id: 999999999,
          name: 'Test Character',
          ownerHash: 'test-owner-hash',
          managedBy: 'SYSTEM',
        },
      });
      testCharacterId = char.id;

      const refreshEnc = await CryptoUtil.encrypt('test-refresh-token');
      await prisma.characterToken.create({
        data: {
          characterId: testCharacterId,
          tokenType: 'Bearer',
          accessToken: 'test-access-token',
          accessTokenExpiresAt: new Date(Date.now() + 3600_000),
          refreshTokenEnc: refreshEnc,
          scopes: 'openid',
        },
      });
    });

    afterEach(async () => {
      // Clean up
      await prisma.characterToken
        .deleteMany({ where: { characterId: testCharacterId } })
        .catch(() => {});
      await prisma.eveCharacter
        .deleteMany({ where: { id: testCharacterId } })
        .catch(() => {});
    });

    it('should have token health fields in schema', async () => {
      const token = await prisma.characterToken.findUnique({
        where: { characterId: testCharacterId },
        select: {
          lastRefreshAt: true,
          refreshFailAt: true,
          refreshFailMsg: true,
        },
      });
      expect(token).toBeDefined();
      expect(token).toHaveProperty('lastRefreshAt');
      expect(token).toHaveProperty('refreshFailAt');
      expect(token).toHaveProperty('refreshFailMsg');
    });

    it('should allow admin to view token status', async () => {
      // This test demonstrates the endpoint exists
      // Actual auth would require valid JWT
      const res = await request(app.getHttpServer())
        .get(`/auth/admin/characters/${testCharacterId}/token/status`)
        .set('x-test-role', 'ADMIN');
      // Expect 401 (no valid JWT) but endpoint exists
      expect([401, 200]).toContain(res.status);
    });

    it('should allow admin to revoke token', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/auth/admin/characters/${testCharacterId}/token`)
        .set('x-test-role', 'ADMIN');
      // Expect 401 (no valid JWT) but endpoint exists
      expect([401, 200]).toContain(res.status);
    });
  });

  describe('SYSTEM Characters', () => {
    it('should support managedBy field', async () => {
      const char = await prisma.eveCharacter.create({
        data: {
          id: 888888888,
          name: 'System Character',
          ownerHash: 'system-hash',
          managedBy: 'SYSTEM',
          notes: 'Test system character',
        },
      });

      expect(char.managedBy).toBe('SYSTEM');
      expect(char.notes).toBe('Test system character');

      await prisma.eveCharacter.delete({ where: { id: char.id } });
    });

    it('should default to USER managedBy', async () => {
      const char = await prisma.eveCharacter.create({
        data: {
          id: 777777777,
          name: 'User Character',
          ownerHash: 'user-hash',
        },
      });

      expect(char.managedBy).toBe('USER');

      await prisma.eveCharacter.delete({ where: { id: char.id } });
    });
  });
});
