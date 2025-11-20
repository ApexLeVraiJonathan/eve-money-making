import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { DiscordNotificationService } from '../common/discord-notification.service';

@Module({
  controllers: [SupportController],
  providers: [DiscordNotificationService],
  exports: [DiscordNotificationService],
})
export class SupportModule {}
