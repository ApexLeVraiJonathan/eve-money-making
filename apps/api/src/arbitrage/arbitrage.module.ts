import { Module, Logger } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';
import { ArbitrageController } from './arbitrage.controller';
import { LiquidityModule } from '../liquidity/liquidity.module';
import { EsiModule } from '../esi/esi.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ArbitragePackagerModule } from '../../libs/arbitrage-packager/src';
import { PackagesModule } from '../packages/packages.module';
import { GameDataModule } from '../game-data/game-data.module';

@Module({
  controllers: [ArbitrageController],
  providers: [ArbitrageService, Logger],
  imports: [
    LiquidityModule,
    EsiModule,
    PrismaModule,
    ArbitragePackagerModule,
    PackagesModule,
    GameDataModule,
  ],
})
export class ArbitrageModule {}
