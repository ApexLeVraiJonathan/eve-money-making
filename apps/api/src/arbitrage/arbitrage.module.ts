import { Module, Logger } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';
import { ArbitrageController } from './arbitrage.controller';
import { LiquidityModule } from '../liquidity/liquidity.module';
import { EsiModule } from '../esi/esi.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ArbitragePackagerModule } from '../../libs/arbitrage-packager/src';

@Module({
  controllers: [ArbitrageController],
  providers: [ArbitrageService, Logger],
  imports: [LiquidityModule, EsiModule, PrismaModule, ArbitragePackagerModule],
})
export class ArbitrageModule {}
