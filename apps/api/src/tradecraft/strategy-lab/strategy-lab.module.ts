import { Module } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { MarketModule } from '@api/tradecraft/market/market.module';
import { GameDataModule } from '@api/game-data/game-data.module';
import { ArbitragePackagerModule } from '@app/arbitrage-packager';
import { StrategyLabController } from './strategy-lab.controller';
import { StrategyLabService } from './strategy-lab.service';

@Module({
  imports: [
    PrismaModule,
    MarketModule,
    GameDataModule,
    ArbitragePackagerModule,
  ],
  controllers: [StrategyLabController],
  providers: [StrategyLabService],
  exports: [StrategyLabService],
})
export class StrategyLabModule {}
