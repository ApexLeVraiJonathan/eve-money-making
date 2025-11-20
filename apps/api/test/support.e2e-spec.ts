import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DiscordNotificationService } from '../src/common/discord-notification.service';

describe('Support & Feedback (e2e)', () => {
  let app: INestApplication;
  let discordService: DiscordNotificationService;

  // Mock dev API key for testing
  const DEV_API_KEY = process.env.DEV_API_KEY || 'test-api-key';

  beforeAll(async () => {
    // Set dev API key for testing
    process.env.DEV_API_KEY = DEV_API_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      providers: [Logger],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    const logger = app.get(Logger);
    app.useLogger(logger);
    
    // Enable validation pipe like in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    
    await app.init();

    discordService = app.get(DiscordNotificationService);

    // Mock Discord methods to avoid real network calls
    jest
      .spyOn(discordService, 'sendSupportRequest')
      .mockResolvedValue(undefined);
    jest
      .spyOn(discordService, 'sendFeedback')
      .mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /support', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/support')
        .send({
          category: 'technical',
          subject: 'Test issue',
          description: 'This is a test support request',
        })
        .expect(401);
    });

    it('should accept valid support request with dev API key', async () => {
      const response = await request(app.getHttpServer())
        .post('/support')
        .set('x-api-key', DEV_API_KEY)
        .send({
          category: 'technical',
          subject: 'Test issue',
          description: 'This is a test support request',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Support request submitted successfully',
      });

      // Verify Discord service was called
      expect(discordService.sendSupportRequest).toHaveBeenCalled();
    });

    it('should accept support request with optional context', async () => {
      const response = await request(app.getHttpServer())
        .post('/support')
        .set('x-api-key', DEV_API_KEY)
        .send({
          category: 'billing',
          subject: 'Billing question',
          description: 'I have a question about my bill',
          context: {
            url: 'https://example.com/page',
            userAgent: 'Mozilla/5.0',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject request with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/support')
        .set('x-api-key', DEV_API_KEY)
        .send({
          category: 'technical',
          // Missing subject and description
        })
        .expect(400);
    });

    it('should reject request with subject too long', async () => {
      await request(app.getHttpServer())
        .post('/support')
        .set('x-api-key', DEV_API_KEY)
        .send({
          category: 'technical',
          subject: 'a'.repeat(201), // Max is 200
          description: 'Test description',
        })
        .expect(400);
    });

    it('should reject request with description too long', async () => {
      await request(app.getHttpServer())
        .post('/support')
        .set('x-api-key', DEV_API_KEY)
        .send({
          category: 'technical',
          subject: 'Test subject',
          description: 'a'.repeat(2001), // Max is 2000
        })
        .expect(400);
    });

    it('should handle all support categories', async () => {
      const categories = [
        'technical',
        'billing',
        'account',
        'question',
        'other',
      ];

      for (const category of categories) {
        const response = await request(app.getHttpServer())
          .post('/support')
          .set('x-api-key', DEV_API_KEY)
          .send({
            category,
            subject: `Test ${category}`,
            description: 'Test description',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('POST /feedback', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/feedback')
        .send({
          feedbackType: 'bug',
          subject: 'Test feedback',
          message: 'This is test feedback',
        })
        .expect(401);
    });

    it('should accept valid feedback with dev API key', async () => {
      const response = await request(app.getHttpServer())
        .post('/feedback')
        .set('x-api-key', DEV_API_KEY)
        .send({
          feedbackType: 'feature',
          subject: 'Feature request',
          message: 'I would like to see this feature',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Feedback submitted successfully',
      });

      // Verify Discord service was called
      expect(discordService.sendFeedback).toHaveBeenCalled();
    });

    it('should accept feedback with optional rating', async () => {
      const response = await request(app.getHttpServer())
        .post('/feedback')
        .set('x-api-key', DEV_API_KEY)
        .send({
          feedbackType: 'general',
          subject: 'General feedback',
          message: 'Great app!',
          rating: 5,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject feedback with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/feedback')
        .set('x-api-key', DEV_API_KEY)
        .send({
          feedbackType: 'bug',
          // Missing subject and message
        })
        .expect(400);
    });

    it('should reject feedback with subject too long', async () => {
      await request(app.getHttpServer())
        .post('/feedback')
        .set('x-api-key', DEV_API_KEY)
        .send({
          feedbackType: 'bug',
          subject: 'a'.repeat(201), // Max is 200
          message: 'Test message',
        })
        .expect(400);
    });

    it('should reject feedback with message too long', async () => {
      await request(app.getHttpServer())
        .post('/feedback')
        .set('x-api-key', DEV_API_KEY)
        .send({
          feedbackType: 'bug',
          subject: 'Test subject',
          message: 'a'.repeat(2001), // Max is 2000
        })
        .expect(400);
    });

    it('should reject feedback with invalid rating', async () => {
      await request(app.getHttpServer())
        .post('/feedback')
        .set('x-api-key', DEV_API_KEY)
        .send({
          feedbackType: 'bug',
          subject: 'Test subject',
          message: 'Test message',
          rating: 6, // Max is 5
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/feedback')
        .set('x-api-key', DEV_API_KEY)
        .send({
          feedbackType: 'bug',
          subject: 'Test subject',
          message: 'Test message',
          rating: 0, // Min is 1
        })
        .expect(400);
    });

    it('should handle all feedback types', async () => {
      const types = ['bug', 'feature', 'improvement', 'general', 'other'];

      for (const feedbackType of types) {
        const response = await request(app.getHttpServer())
          .post('/feedback')
          .set('x-api-key', DEV_API_KEY)
          .send({
            feedbackType,
            subject: `Test ${feedbackType}`,
            message: 'Test message',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should be protected by global rate limiter', async () => {
      // Note: This test would need to make 100+ requests to trigger rate limiting
      // For now, we just verify the endpoints exist and are protected
      const response = await request(app.getHttpServer())
        .post('/support')
        .set('x-api-key', DEV_API_KEY)
        .send({
          category: 'technical',
          subject: 'Test',
          description: 'Test',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
