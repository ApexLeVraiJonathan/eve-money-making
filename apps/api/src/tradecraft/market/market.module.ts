import { Module, Logger, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { EsiModule } from '@api/esi/esi.module';
import { CyclesModule } from '@api/tradecraft/cycles/cycles.module';
import { GameDataModule } from '@api/game-data/game-data.module';
import { CharactersModule } from '@api/characters/characters.module';
import { DataImportModule } from '@shared/data-import';
import { ArbitragePackagerModule } from '@app/arbitrage-packager';
import { SelfMarketModule } from '@api/tradecraft/self-market/self-market.module';
import { NotificationsModule } from '@api/notifications/notifications.module';

// Services
import { ArbitrageService } from './services/arbitrage.service';
import { PricingService } from './services/pricing.service';
import { LiquidityService } from './services/liquidity.service';
import { PackageService } from './services/package.service';
import { TrackedStationService } from './services/tracked-station.service';
import { MarketDataService } from './services/market-data.service';
import { StructureMarketPricingService } from './services/structure-market-pricing.service';

// Controllers
import { ArbitrageController } from './arbitrage.controller';
import { PricingController } from './pricing.controller';
import { PricingScriptController } from './pricing-script.controller';
import { LiquidityController } from './liquidity.controller';
import { PackagesController } from './packages.controller';
import { TrackedStationsController } from './tracked-stations.controller';

@Module({
  imports: [
    PrismaModule,
    EsiModule,
    SelfMarketModule,
    forwardRef(() => CyclesModule),
    forwardRef(() => GameDataModule),
    CharactersModule,
    NotificationsModule,
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
    StructureMarketPricingService,
    Logger,
  ],
  controllers: [
    ArbitrageController,
    PricingController,
    PricingScriptController,
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
