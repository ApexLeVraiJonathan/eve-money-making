import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('SkillPlans (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      providers: [Logger],
    }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    const logger = app.get(Logger);
    app.useLogger(logger);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /skill-plans should require auth and return 401 or 403 for anonymous', async () => {
    const res = await request(app.getHttpServer()).get('/skill-plans');
    expect([401, 403]).toContain(res.status);
  });
});
