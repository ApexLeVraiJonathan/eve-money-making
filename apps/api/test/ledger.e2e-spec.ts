import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Ledger participations (e2e)', () => {
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

  it('plan cycle → create/list participation → opt-out', async () => {
    const server = app.getHttpServer();

    // 1) Plan a future cycle
    const future = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const planRes = await request(server)
      .post('/ledger/cycles/plan')
      .send({ name: 'Planned E2E', startedAt: future })
      .expect(201);
    const cycleId = planRes.body?.id as string;
    expect(typeof cycleId).toBe('string');

    // 2) Create a participation (opt-in request)
    const createPartRes = await request(server)
      .post(`/ledger/cycles/${cycleId}/participations`)
      .type('json')
      .send({ characterName: 'E2E Tester', amountIsk: '1000000.00' });
    if (createPartRes.status !== 201) {
      console.error(
        'createParticipation failed:',
        createPartRes.status,
        createPartRes.body,
      );
    }
    expect(createPartRes.status).toBe(201);
    const participationId = createPartRes.body?.id as string;
    expect(typeof participationId).toBe('string');
    expect(createPartRes.body?.status).toBe('AWAITING_INVESTMENT');

    // 3) List participations for the planned cycle
    const listRes = await request(server)
      .get(`/ledger/cycles/${cycleId}/participations`)
      .expect(200);
    const items = listRes.body as Array<{ id: string; characterName: string }>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.find((p) => p.id === participationId)).toBeTruthy();

    // 4) Opt-out before the cycle starts
    const optOutRes = await request(server)
      .post(`/ledger/participations/${participationId}/opt-out`)
      .expect(201);
    expect(optOutRes.body?.status).toBe('OPTED_OUT');
  });
});
