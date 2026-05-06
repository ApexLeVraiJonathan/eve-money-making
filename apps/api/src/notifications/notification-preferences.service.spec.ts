import { NotificationPreferencesService } from './notification-preferences.service';
import type { PrismaService } from '@api/prisma/prisma.service';
import { NOTIFICATION_TYPES } from './dto/notification-preferences.dto';

describe('NotificationPreferencesService', () => {
  it('only reads currently supported notification types for a user', async () => {
    const prisma = {
      notificationPreference: {
        findMany: jest.fn().mockResolvedValue([
          {
            channel: 'DISCORD_DM',
            notificationType: 'CYCLE_PLANNED',
            enabled: true,
          },
        ]),
      },
    };
    const service = new NotificationPreferencesService(
      prisma as unknown as PrismaService,
    );

    const preferences = await service.getForUser('user-1');

    expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        notificationType: { in: [...NOTIFICATION_TYPES] },
      },
    });
    expect(preferences).toEqual(
      expect.arrayContaining([
        {
          channel: 'DISCORD_DM',
          notificationType: 'CYCLE_PLANNED',
          enabled: true,
        },
        {
          channel: 'DISCORD_DM',
          notificationType: 'PLEX_ENDING',
          enabled: false,
        },
      ]),
    );
  });
});
