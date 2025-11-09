import { Module } from '@nestjs/common';
import { DataImportModule } from '@shared/data-import';
import { LiquidityService } from './liquidity.service';
import { LiquidityController } from './liquidity.controller';
import { GameDataModule } from '../game-data/game-data.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  controllers: [LiquidityController],
  providers: [LiquidityService],
  imports: [DataImportModule, GameDataModule, MarketDataModule],
  exports: [LiquidityService],
})
export class LiquidityModule {}
