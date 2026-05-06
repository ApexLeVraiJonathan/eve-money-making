import { Module, Logger, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { EsiModule } from '@api/esi/esi.module';
import { GameDataModule } from '@api/game-data/game-data.module';
import { CharactersModule } from '@api/characters/characters.module';
import { MarketModule } from '@api/tradecraft/market/market.module';
import { NotificationsModule } from '@api/notifications/notifications.module';

// Services
import { CycleService } from './services/cycle.service';
import { CycleLifecycleService } from './services/cycle-lifecycle.service';
import { CycleRolloverService } from './services/cycle-rollover.service';
import { CycleLineService } from './services/cycle-line.service';
import { FeeService } from './services/fee.service';
import { SnapshotService } from './services/snapshot.service';
import { ParticipationService } from './services/participation.service';
import { PayoutService } from './services/payout.service';
import { PaymentMatchingService } from './services/payment-matching.service';
import { CapitalService } from './services/capital.service';
import { ProfitService } from './services/profit.service';
import { JingleYieldService } from './services/jingle-yield.service';
import { AutoRolloverSettingsService } from './services/auto-rollover-settings.service';
import { CycleLinesIntelService } from './services/cycle-lines-intel.service';
import { LedgerEntryService } from './services/ledger-entry.service';
import { OpenCycleWalletRefreshService } from './services/open-cycle-wallet-refresh.service';
import { ParticipationCapsService } from './services/participation-caps.service';

// Controllers
import { CyclesController } from './cycles.controller';
import { WalletModule } from '@api/tradecraft/wallet/wallet.module';

@Module({
  imports: [
    PrismaModule,
    EsiModule,
    forwardRef(() => GameDataModule),
    CharactersModule,
    forwardRef(() => MarketModule),
    WalletModule,
    NotificationsModule,
  ],
  providers: [
    // New focused services
    CycleService,
    CycleLifecycleService,
    LedgerEntryService,
    OpenCycleWalletRefreshService,
    ParticipationCapsService,
    CycleRolloverService,
    CycleLineService,
    FeeService,
    SnapshotService,
    ParticipationService,
    PayoutService,
    JingleYieldService,
    AutoRolloverSettingsService,
    PaymentMatchingService,
    CapitalService,
    ProfitService,
    CycleLinesIntelService,
    Logger,
  ],
  controllers: [CyclesController],
  exports: [
    CycleService,
    CycleLifecycleService,
    LedgerEntryService,
    OpenCycleWalletRefreshService,
    ParticipationCapsService,
    CycleRolloverService,
    CycleLineService,
    FeeService,
    SnapshotService,
    ParticipationService,
    PayoutService,
    JingleYieldService,
    AutoRolloverSettingsService,
    PaymentMatchingService,
    CapitalService,
    ProfitService,
    CycleLinesIntelService,
  ],
})
export class CyclesModule {}
