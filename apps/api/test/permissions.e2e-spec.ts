import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Permissions (e2e)', () => {
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

  it('blocks non-admin from admin-only participation actions', async () => {
    const server = app.getHttpServer();
    // Plan a future cycle
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const planRes = await request(server)
      .post('/ledger/cycles/plan')
      .send({ name: 'Perm Test', startedAt: future })
      .expect(201);
    const cycleId = planRes.body?.id as string;

    // Create a participation
    const createRes = await request(server)
      .post(`/ledger/cycles/${cycleId}/participations`)
      .send({ characterName: 'Perm User', amountIsk: '1000.00' })
      .expect(201);
    const participationId = createRes.body?.id as string;

    // Non-admin role header missing → 403
    await request(server)
      .post(`/ledger/participations/${participationId}/validate`)
      .expect(403);

    // Explicit USER role → 403
    await request(server)
      .post(`/ledger/participations/${participationId}/validate`)
      .set('x-test-role', 'USER')
      .expect(403);

    // ADMIN role → allowed (will likely 201 or 200 depending on impl); assert not 403
    const adminRes = await request(server)
      .post(`/ledger/participations/${participationId}/validate`)
      .set('x-test-role', 'ADMIN')
      .send({})
      .expect((res) => {
        if (res.status === 403) throw new Error('Expected admin allowed');
      });
    expect([200, 201]).toContain(adminRes.status);
  });
});
