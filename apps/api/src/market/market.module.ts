import { Module, Logger, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EsiModule } from '../esi/esi.module';
import { CyclesModule } from '../cycles/cycles.module';
import { GameDataModule } from '../game-data/game-data.module';
import { CharactersModule } from '../characters/characters.module';
import { DataImportModule } from '@shared/data-import';
import { ArbitragePackagerModule } from '../../libs/arbitrage-packager/src';

// Services
import { ArbitrageService } from './services/arbitrage.service';
import { PricingService } from './services/pricing.service';
import { LiquidityService } from './services/liquidity.service';
import { PackageService } from './services/package.service';
import { TrackedStationService } from './services/tracked-station.service';
import { MarketDataService } from './services/market-data.service';

// Controllers
import { ArbitrageController } from './arbitrage.controller';
import { PricingController } from './pricing.controller';
import { LiquidityController } from './liquidity.controller';
import { PackagesController } from './packages.controller';
import { TrackedStationsController } from './tracked-stations.controller';

@Module({
  imports: [
    PrismaModule,
    EsiModule,
    forwardRef(() => CyclesModule),
    forwardRef(() => GameDataModule),
    CharactersModule,
    DataImportModule,
    ArbitragePackagerModule,
  ],
  providers: [
    ArbitrageService,
    PricingService,
    LiquidityService,
    PackageService,
    TrackedStationService,
    MarketDataService,
    Logger,
  ],
  controllers: [
    ArbitrageController,
    PricingController,
    LiquidityController,
    PackagesController,
    TrackedStationsController,
  ],
  exports: [
    ArbitrageService,
    PricingService,
    LiquidityService,
    PackageService,
    TrackedStationService,
    MarketDataService,
  ],
})
export class MarketModule {}
