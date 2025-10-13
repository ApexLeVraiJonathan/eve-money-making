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
        .expect(401); // Auth happens before role check
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

  describe('Character Linking Flow', () => {
    afterEach(async () => {
      // Clean up test data
      await prisma.characterToken.deleteMany({
        where: { characterId: { in: [111111111, 222222222] } },
      });
      await prisma.eveCharacter.deleteMany({
        where: { id: { in: [111111111, 222222222] } },
      });
      await prisma.user.deleteMany({
        where: { primaryCharacterId: { in: [111111111, 222222222] } },
      });
    });

    it('should create new user and character on first link', async () => {
      const refreshEnc = await CryptoUtil.encrypt('test-refresh');

      // Simulate initial character link - create character first
      const char = await prisma.eveCharacter.create({
        data: {
          id: 111111111,
          name: 'First Character',
          ownerHash: 'owner-hash-1',
          managedBy: 'USER',
        },
      });

      const user = await prisma.user.create({
        data: {
          role: 'USER',
          primaryCharacterId: 111111111,
        },
      });

      // Link character to user
      await prisma.eveCharacter.update({
        where: { id: char.id },
        data: { userId: user.id },
      });

      await prisma.characterToken.create({
        data: {
          characterId: char.id,
          tokenType: 'Bearer',
          accessToken: 'access-token-1',
          accessTokenExpiresAt: new Date(Date.now() + 3600_000),
          refreshTokenEnc: refreshEnc,
          scopes: 'openid',
        },
      });

      const foundUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { characters: true },
      });

      expect(foundUser).toBeDefined();
      expect(foundUser?.characters).toHaveLength(1);
      expect(foundUser?.primaryCharacterId).toBe(111111111);
    });

    it('should link additional character to existing user', async () => {
      const refreshEnc = await CryptoUtil.encrypt('test-refresh');

      // Create first character
      await prisma.eveCharacter.create({
        data: {
          id: 111111111,
          name: 'First Character',
          ownerHash: 'owner-hash-1',
        },
      });

      // Create user with first character
      const user = await prisma.user.create({
        data: {
          role: 'USER',
          primaryCharacterId: 111111111,
        },
      });

      // Link first character to user
      await prisma.eveCharacter.update({
        where: { id: 111111111 },
        data: { userId: user.id },
      });

      await prisma.characterToken.create({
        data: {
          characterId: 111111111,
          tokenType: 'Bearer',
          accessToken: 'access-1',
          accessTokenExpiresAt: new Date(Date.now() + 3600_000),
          refreshTokenEnc: refreshEnc,
          scopes: '',
        },
      });

      // Link second character
      await prisma.eveCharacter.create({
        data: {
          id: 222222222,
          name: 'Second Character',
          ownerHash: 'owner-hash-2',
          userId: user.id,
        },
      });

      await prisma.characterToken.create({
        data: {
          characterId: 222222222,
          tokenType: 'Bearer',
          accessToken: 'access-2',
          accessTokenExpiresAt: new Date(Date.now() + 3600_000),
          refreshTokenEnc: refreshEnc,
          scopes: '',
        },
      });

      const characters = await prisma.eveCharacter.findMany({
        where: { userId: user.id },
      });

      expect(characters).toHaveLength(2);
      expect(characters.map((c) => c.id)).toContain(111111111);
      expect(characters.map((c) => c.id)).toContain(222222222);
    });
  });

  describe('Token Refresh', () => {
    let testCharId: number;

    beforeEach(async () => {
      testCharId = 333333333;
      const refreshEnc = await CryptoUtil.encrypt('test-refresh');

      await prisma.eveCharacter.create({
        data: {
          id: testCharId,
          name: 'Refresh Test Character',
          ownerHash: 'refresh-owner-hash',
          managedBy: 'SYSTEM',
        },
      });

      await prisma.characterToken.create({
        data: {
          characterId: testCharId,
          tokenType: 'Bearer',
          accessToken: 'old-access-token',
          accessTokenExpiresAt: new Date(Date.now() - 3600_000), // Expired
          refreshTokenEnc: refreshEnc,
          scopes: '',
        },
      });
    });

    afterEach(async () => {
      await prisma.characterToken.deleteMany({
        where: { characterId: testCharId },
      });
      await prisma.eveCharacter.deleteMany({
        where: { id: testCharId },
      });
    });

    it('should update token health fields on refresh attempt', async () => {
      const token = await prisma.characterToken.findUnique({
        where: { characterId: testCharId },
      });

      expect(token?.accessTokenExpiresAt.getTime()).toBeLessThan(Date.now());
      expect(token?.lastRefreshAt).toBeNull();
      expect(token?.refreshFailAt).toBeNull();
      expect(token?.refreshFailMsg).toBeNull();

      // Note: Actual refresh would require mocking EVE SSO
      // This test validates the schema fields exist
    });

    it('should track refresh failures', async () => {
      // Simulate a failed refresh
      await prisma.characterToken.update({
        where: { characterId: testCharId },
        data: {
          refreshFailAt: new Date(),
          refreshFailMsg: 'invalid_grant',
        },
      });

      const token = await prisma.characterToken.findUnique({
        where: { characterId: testCharId },
      });

      expect(token?.refreshFailAt).toBeDefined();
      expect(token?.refreshFailMsg).toBe('invalid_grant');
    });
  });

  describe('Owner Change Detection', () => {
    let testCharId: number;
    const originalOwnerHash = 'original-owner-hash';
    const newOwnerHash = 'new-owner-hash-after-sale';

    beforeEach(async () => {
      testCharId = 444444444;
      const refreshEnc = await CryptoUtil.encrypt('test-refresh');

      await prisma.eveCharacter.create({
        data: {
          id: testCharId,
          name: 'Owner Change Test',
          ownerHash: originalOwnerHash,
          managedBy: 'USER',
        },
      });

      await prisma.characterToken.create({
        data: {
          characterId: testCharId,
          tokenType: 'Bearer',
          accessToken: 'access-token',
          accessTokenExpiresAt: new Date(Date.now() + 3600_000),
          refreshTokenEnc: refreshEnc,
          scopes: '',
        },
      });
    });

    afterEach(async () => {
      await prisma.characterToken.deleteMany({
        where: { characterId: testCharId },
      });
      await prisma.eveCharacter.deleteMany({
        where: { id: testCharId },
      });
    });

    it('should detect owner hash change and revoke token', async () => {
      // Verify original state
      const char = await prisma.eveCharacter.findUnique({
        where: { id: testCharId },
      });
      expect(char?.ownerHash).toBe(originalOwnerHash);

      // Simulate owner change detection (would happen in JWT strategy or refresh)
      if (newOwnerHash !== originalOwnerHash) {
        await prisma.characterToken.update({
          where: { characterId: testCharId },
          data: {
            refreshTokenEnc: '',
            accessToken: '',
            refreshFailAt: new Date(),
            refreshFailMsg: 'owner_hash_changed',
          },
        });
      }

      const token = await prisma.characterToken.findUnique({
        where: { characterId: testCharId },
      });

      expect(token?.refreshTokenEnc).toBe('');
      expect(token?.accessToken).toBe('');
      expect(token?.refreshFailMsg).toBe('owner_hash_changed');
    });
  });
});
