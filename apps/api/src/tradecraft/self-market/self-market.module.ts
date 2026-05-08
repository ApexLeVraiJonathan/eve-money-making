import { Module, Logger } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { EsiModule } from '@api/esi/esi.module';
import { MarketDataModule } from '@api/tradecraft/market-data/market-data.module';
import { SelfMarketCollectorService } from './self-market-collector.service';
import { CharactersModule } from '@api/characters/characters.module';
import { SelfMarketController } from './self-market.controller';
import { SelfMarketQueryService } from './self-market-query.service';

@Module({
  imports: [PrismaModule, EsiModule, CharactersModule, MarketDataModule],
  providers: [SelfMarketCollectorService, SelfMarketQueryService, Logger],
  controllers: [SelfMarketController],
  exports: [SelfMarketCollectorService, SelfMarketQueryService],
})
export class SelfMarketModule {}
