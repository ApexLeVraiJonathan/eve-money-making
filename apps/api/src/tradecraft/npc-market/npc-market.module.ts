import { Module } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { EsiModule } from '@api/esi/esi.module';
import { NotificationsModule } from '@api/notifications/notifications.module';
import { NpcMarketCollectorService } from './npc-market-collector.service';
import { NpcMarketController } from './npc-market.controller';

@Module({
  imports: [PrismaModule, EsiModule, NotificationsModule],
  providers: [NpcMarketCollectorService],
  controllers: [NpcMarketController],
  exports: [NpcMarketCollectorService],
})
export class NpcMarketModule {}
