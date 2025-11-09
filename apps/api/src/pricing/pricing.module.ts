import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EsiModule } from '../esi/esi.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { GameDataModule } from '../game-data/game-data.module';
import { CharacterModule } from '../characters/character.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [
    PrismaModule,
    EsiModule,
    LedgerModule,
    GameDataModule,
    CharacterModule,
    MarketDataModule,
  ],
  providers: [PricingService],
  controllers: [PricingController],
})
export class PricingModule {}
