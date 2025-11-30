import { Module } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { DiscordOauthService } from './discord-oauth.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { DiscordDmService } from './discord-dm.service';
import { NotificationService } from './notification.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    DiscordOauthService,
    NotificationPreferencesService,
    DiscordDmService,
    NotificationService,
  ],
  exports: [
    DiscordOauthService,
    NotificationPreferencesService,
    DiscordDmService,
    NotificationService,
  ],
})
export class NotificationsModule {}
