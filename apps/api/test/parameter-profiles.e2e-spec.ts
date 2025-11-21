import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ParameterProfilesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let createdProfileId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    prisma = app.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
    if (createdProfileId) {
      await prisma.parameterProfile.deleteMany({
        where: { name: { contains: 'Test Profile' } },
      });
    }
    await app.close();
  });

  describe('POST /parameter-profiles', () => {
    it('should create a new profile (without auth for test)', async () => {
      const createDto = {
        name: 'Test Profile',
        description: 'A test profile',
        scope: 'ARBITRAGE',
        params: {
          minMarginPercent: 10,
          maxInventoryDays: 3,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/parameter-profiles')
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createDto.name);
      expect(response.body.scope).toBe(createDto.scope);
      expect(response.body.params).toEqual(createDto.params);

      createdProfileId = response.body.id;
    });

    it('should reject duplicate profile names in the same scope', async () => {
      const createDto = {
        name: 'Test Profile',
        description: 'Another test profile',
        scope: 'ARBITRAGE',
        params: { test: 'value' },
      };

      await request(app.getHttpServer())
        .post('/parameter-profiles')
        .send(createDto)
        .expect(409); // Conflict
    });
  });

  describe('GET /parameter-profiles', () => {
    it('should list all profiles', async () => {
      const response = await request(app.getHttpServer())
        .get('/parameter-profiles')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter profiles by scope', async () => {
      const response = await request(app.getHttpServer())
        .get('/parameter-profiles?scope=ARBITRAGE')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((profile: any) => {
        expect(profile.scope).toBe('ARBITRAGE');
      });
    });
  });

  describe('GET /parameter-profiles/:id', () => {
    it('should get a profile by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/parameter-profiles/${createdProfileId}`)
        .expect(200);

      expect(response.body.id).toBe(createdProfileId);
      expect(response.body.name).toBe('Test Profile');
    });

    it('should return 404 for non-existent profile', async () => {
      await request(app.getHttpServer())
        .get('/parameter-profiles/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /parameter-profiles/:id', () => {
    it('should update a profile (without auth for test)', async () => {
      const updateDto = {
        description: 'Updated description',
        params: { minMarginPercent: 15 },
      };

      const response = await request(app.getHttpServer())
        .patch(`/parameter-profiles/${createdProfileId}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.description).toBe(updateDto.description);
      expect(response.body.params).toEqual(updateDto.params);
    });
  });

  describe('DELETE /parameter-profiles/:id', () => {
    it('should delete a profile (without auth for test)', async () => {
      await request(app.getHttpServer())
        .delete(`/parameter-profiles/${createdProfileId}`)
        .expect(200);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/parameter-profiles/${createdProfileId}`)
        .expect(404);
    });
  });
});

