import { Module } from '@nestjs/common';
import { ArbitragePackagerService } from './arbitrage-packager.service';

@Module({
  providers: [ArbitragePackagerService],
  exports: [ArbitragePackagerService],
})
export class ArbitragePackagerModule {}
