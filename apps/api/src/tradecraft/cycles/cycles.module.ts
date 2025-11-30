import { Module, Logger, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { EsiModule } from '@api/esi/esi.module';
import { GameDataModule } from '@api/game-data/game-data.module';
import { CharactersModule } from '@api/characters/characters.module';
import { MarketModule } from '@api/tradecraft/market/market.module';
import { NotificationsModule } from '@api/notifications/notifications.module';

// Services
import { CycleService } from './services/cycle.service';
import { CycleLineService } from './services/cycle-line.service';
import { FeeService } from './services/fee.service';
import { SnapshotService } from './services/snapshot.service';
import { ParticipationService } from './services/participation.service';
import { PayoutService } from './services/payout.service';
import { PaymentMatchingService } from './services/payment-matching.service';
import { CapitalService } from './services/capital.service';
import { ProfitService } from './services/profit.service';

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
    CycleLineService,
    FeeService,
    SnapshotService,
    ParticipationService,
    PayoutService,
    PaymentMatchingService,
    CapitalService,
    ProfitService,
    Logger,
  ],
  controllers: [CyclesController],
  exports: [
    CycleService,
    CycleLineService,
    FeeService,
    SnapshotService,
    ParticipationService,
    PayoutService,
    PaymentMatchingService,
    CapitalService,
    ProfitService,
  ],
})
export class CyclesModule {}
