import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Tracked Stations (e2e)', () => {
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

  it('create → get/list → delete', async () => {
    const server = app.getHttpServer();
    // Create
    const create = await request(server)
      .post('/tracked-stations')
      .send({ stationId: 60003760 })
      .expect(201);
    const id = create.body?.id as string;
    expect(typeof id).toBe('string');

    // Get
    const get = await request(server)
      .get(`/tracked-stations/${id}`)
      .expect(200);
    expect(get.body?.stationId).toBe(60003760);

    // List
    const list = await request(server).get('/tracked-stations').expect(200);
    expect(Array.isArray(list.body)).toBe(true);

    // Delete
    await request(server).delete(`/tracked-stations/${id}`).expect(200);
  });
});
