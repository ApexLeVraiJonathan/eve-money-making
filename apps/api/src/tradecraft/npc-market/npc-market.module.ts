import { Module } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { EsiModule } from '@api/esi/esi.module';
import { NotificationsModule } from '@api/notifications/notifications.module';
import { MarketDataModule } from '@api/tradecraft/market-data/market-data.module';
import { NpcMarketAggregatesService } from './npc-market-aggregates.service';
import { NpcMarketCollectorService } from './npc-market-collector.service';
import { NpcMarketComparisonService } from './npc-market-comparison.service';
import { NpcMarketController } from './npc-market.controller';
import { NpcMarketQueryService } from './npc-market-query.service';

@Module({
  imports: [PrismaModule, EsiModule, NotificationsModule, MarketDataModule],
  providers: [
    NpcMarketAggregatesService,
    NpcMarketCollectorService,
    NpcMarketComparisonService,
    NpcMarketQueryService,
  ],
  controllers: [NpcMarketController],
  exports: [NpcMarketCollectorService, NpcMarketQueryService],
})
export class NpcMarketModule {}
