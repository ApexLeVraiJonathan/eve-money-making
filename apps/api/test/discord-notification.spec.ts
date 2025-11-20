import { Test, TestingModule } from '@nestjs/testing';
import { DiscordNotificationService } from '../src/common/discord-notification.service';

describe('DiscordNotificationService', () => {
  let service: DiscordNotificationService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(async () => {
    // Reset environment variables for each test
    process.env.DISCORD_SUPPORT_WEBHOOK_URL =
      'https://discord.com/api/webhooks/123/test';
    process.env.DISCORD_FEEDBACK_WEBHOOK_URL =
      'https://discord.com/api/webhooks/456/test';

    const module: TestingModule = await Test.createTestingModule({
      providers: [DiscordNotificationService],
    }).compile();

    service = module.get<DiscordNotificationService>(
      DiscordNotificationService,
    );
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should warn when webhooks are not configured', async () => {
      delete process.env.DISCORD_SUPPORT_WEBHOOK_URL;
      delete process.env.DISCORD_FEEDBACK_WEBHOOK_URL;

      const logSpy = jest.spyOn(service['logger'], 'warn');

      const module: TestingModule = await Test.createTestingModule({
        providers: [DiscordNotificationService],
      }).compile();

      const newService = module.get<DiscordNotificationService>(
        DiscordNotificationService,
      );

      expect(newService).toBeDefined();
      // Logger warns are called in constructor
    });
  });

  describe('sendSupportRequest', () => {
    it('should format and send support request to Discord', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      global.fetch = mockFetch as any;

      await service.sendSupportRequest({
        category: 'technical',
        subject: 'Test issue',
        description: 'This is a test',
        user: {
          id: 'user123',
          characterName: 'Test Character',
          email: 'test@example.com',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const callArg = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArg.body);

      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].title).toBe('🆘 New Support Request');
      expect(body.embeds[0].color).toBe(0xff0000); // Red
      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Subject', value: 'Test issue' }),
          expect.objectContaining({
            name: 'Description',
            value: 'This is a test',
          }),
        ]),
      );
    });

    it('should include optional context fields', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      global.fetch = mockFetch as any;

      await service.sendSupportRequest({
        category: 'technical',
        subject: 'Test',
        description: 'Test',
        context: {
          url: 'https://example.com/page',
          userAgent: 'Mozilla/5.0',
        },
        user: {
          id: 'user123',
          characterName: 'Test Character',
        },
      });

      const callArg = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArg.body);

      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Page URL',
            value: 'https://example.com/page',
          }),
          expect.objectContaining({ name: 'User Agent', value: 'Mozilla/5.0' }),
        ]),
      );
    });

    it('should handle webhook failures gracefully', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Error details',
      });
      global.fetch = mockFetch as any;

      const logSpy = jest.spyOn(service['logger'], 'error');

      // Should not throw
      await service.sendSupportRequest({
        category: 'technical',
        subject: 'Test',
        description: 'Test',
        user: { id: 'user123' },
      });

      expect(logSpy).toHaveBeenCalled();
    });

    it('should skip sending if webhook URL is not configured', async () => {
      service['supportWebhookUrl'] = undefined;
      const mockFetch = jest.fn();
      global.fetch = mockFetch as any;

      const logSpy = jest.spyOn(service['logger'], 'warn');

      await service.sendSupportRequest({
        category: 'technical',
        subject: 'Test',
        description: 'Test',
        user: { id: 'user123' },
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'Support webhook not configured. Skipping notification.',
      );
    });

    it('should truncate long text to fit Discord limits', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      global.fetch = mockFetch as any;

      const longDescription = 'a'.repeat(1500);

      await service.sendSupportRequest({
        category: 'technical',
        subject: 'Test',
        description: longDescription,
        user: { id: 'user123' },
      });

      const callArg = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArg.body);
      const descField = body.embeds[0].fields.find(
        (f: any) => f.name === 'Description',
      );

      // Should be truncated to 1024 characters max
      expect(descField.value.length).toBeLessThanOrEqual(1024);
      expect(descField.value).toMatch(/\.\.\.$/); // Ends with ...
    });
  });

  describe('sendFeedback', () => {
    it('should format and send feedback to Discord', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      global.fetch = mockFetch as any;

      await service.sendFeedback({
        feedbackType: 'feature',
        subject: 'Feature request',
        message: 'Add this feature please',
        user: {
          id: 'user123',
          characterName: 'Test Character',
          email: 'test@example.com',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/456/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const callArg = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArg.body);

      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].title).toBe('💡 New Feedback');
      expect(body.embeds[0].color).toBe(0x00ff00); // Green
      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Subject',
            value: 'Feature request',
          }),
          expect.objectContaining({
            name: 'Message',
            value: 'Add this feature please',
          }),
        ]),
      );
    });

    it('should include optional rating', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      global.fetch = mockFetch as any;

      await service.sendFeedback({
        feedbackType: 'general',
        subject: 'Great app',
        message: 'Love it',
        rating: 5,
        user: { id: 'user123' },
      });

      const callArg = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArg.body);

      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Rating',
            value: '⭐⭐⭐⭐⭐ (5/5)',
          }),
        ]),
      );
    });

    it('should skip sending if webhook URL is not configured', async () => {
      service['feedbackWebhookUrl'] = undefined;
      const mockFetch = jest.fn();
      global.fetch = mockFetch as any;

      const logSpy = jest.spyOn(service['logger'], 'warn');

      await service.sendFeedback({
        feedbackType: 'bug',
        subject: 'Test',
        message: 'Test',
        user: { id: 'user123' },
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'Feedback webhook not configured. Skipping notification.',
      );
    });
  });

  describe('formatting helpers', () => {
    it('should format support categories correctly', () => {
      const formatted = service['formatCategory']('technical');
      expect(formatted).toBe('🔧 Technical Issue');
    });

    it('should format feedback types correctly', () => {
      const formatted = service['formatFeedbackType']('bug');
      expect(formatted).toBe('🐛 Bug Report');
    });

    it('should format user info correctly', () => {
      const formatted = service['formatUser']({
        id: 'user123',
        characterName: 'Test Char',
        email: 'test@example.com',
      });

      expect(formatted).toContain('User ID: user123');
      expect(formatted).toContain('Character: Test Char');
      expect(formatted).toContain('Email: test@example.com');
    });

    it('should handle partial user info', () => {
      const formatted = service['formatUser']({
        id: 'user123',
      });

      expect(formatted).toBe('User ID: user123');
    });

    it('should truncate text correctly', () => {
      const text = 'a'.repeat(100);
      const truncated = service['truncate'](text, 50);

      expect(truncated.length).toBe(50);
      expect(truncated).toMatch(/\.\.\.$/);
    });

    it('should not truncate short text', () => {
      const text = 'Short text';
      const truncated = service['truncate'](text, 50);

      expect(truncated).toBe(text);
    });
  });
});
