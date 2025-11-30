import { Injectable } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  NotificationPreferenceItemDto,
  type NotificationChannel,
  type NotificationType,
} from './dto/notification-preferences.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string): Promise<NotificationPreferenceItemDto[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    const result: NotificationPreferenceItemDto[] = [];

    for (const channel of NOTIFICATION_CHANNELS) {
      for (const type of NOTIFICATION_TYPES) {
        const existing = rows.find(
          (r) => r.channel === channel && r.notificationType === type,
        );
        result.push({
          channel,
          notificationType: type,
          enabled: existing?.enabled ?? false,
        });
      }
    }

    return result;
  }

  async updateForUser(
    userId: string,
    preferences: NotificationPreferenceItemDto[],
  ): Promise<void> {
    const updates = preferences.filter((p) =>
      this.isSupported(p.channel, p.notificationType),
    );

    await this.prisma.$transaction([
      ...updates.map((p) =>
        this.prisma.notificationPreference.upsert({
          where: {
            user_channel_type_unique: {
              userId,
              channel: p.channel as NotificationChannel,
              notificationType: p.notificationType as NotificationType,
            },
          },
          update: {
            enabled: p.enabled,
          },
          create: {
            userId,
            channel: p.channel as NotificationChannel,
            notificationType: p.notificationType as NotificationType,
            enabled: p.enabled,
          },
        }),
      ),
    ]);
  }

  private isSupported(
    channel: NotificationChannel,
    type: NotificationType,
  ): boolean {
    return (
      NOTIFICATION_CHANNELS.includes(channel as NotificationChannel) &&
      NOTIFICATION_TYPES.includes(type as NotificationType)
    );
  }
}
