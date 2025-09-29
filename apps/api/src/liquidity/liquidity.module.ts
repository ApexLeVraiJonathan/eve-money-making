import { Module } from '@nestjs/common';
import { DataImportModule } from '@shared/data-import';
import { LiquidityService } from './liquidity.service';
import { LiquidityController } from './liquidity.controller';

@Module({
  controllers: [LiquidityController],
  providers: [LiquidityService],
  imports: [DataImportModule],
})
export class LiquidityModule {}
