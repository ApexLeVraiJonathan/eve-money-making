import { Module, Logger } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { EsiModule } from '@api/esi/esi.module';
import { SelfMarketCollectorService } from './self-market-collector.service';
import { CharactersModule } from '@api/characters/characters.module';
import { SelfMarketController } from './self-market.controller';

@Module({
  imports: [PrismaModule, EsiModule, CharactersModule],
  providers: [SelfMarketCollectorService, Logger],
  controllers: [SelfMarketController],
  exports: [SelfMarketCollectorService],
})
export class SelfMarketModule {}

