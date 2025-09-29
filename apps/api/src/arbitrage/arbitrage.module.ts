import { Module } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';
import { ArbitrageController } from './arbitrage.controller';

@Module({
  controllers: [ArbitrageController],
  providers: [ArbitrageService],
})
export class ArbitrageModule {}
