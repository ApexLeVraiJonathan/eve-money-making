import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@api/prisma/prisma.module';
import { JobsController } from './jobs.controller';
import { GameDataModule } from '@api/game-data/game-data.module';
import { WalletModule } from '@api/tradecraft/wallet/wallet.module';
import { CyclesModule } from '@api/tradecraft/cycles/cycles.module';
import { CharactersModule } from '@api/characters/characters.module';
import { NotificationsModule } from '@api/notifications/notifications.module';
import { SkillPlansModule } from '@api/skill-plans/skill-plans.module';
import { SkillFarmModule } from '@api/skill-farm/skill-farm.module';
import { EsiModule } from '@api/esi/esi.module';
import { SelfMarketModule } from '@api/tradecraft/self-market/self-market.module';
import { NpcMarketModule } from '@api/tradecraft/npc-market/npc-market.module';
import { JobsGate } from './jobs-gate.service';
import { JobsFacadeService } from './jobs-facade.service';
import { CleanupRunner } from './cleanup.runner';
import { TradeStalenessService } from './trade-staleness.service';
import { WalletImportsRunner } from './wallet-imports.runner';
import { MarketGatheringRunner } from './market-gathering.runner';
import { SystemTokensRefresher } from './system-tokens.refresher';
import { SkillPlanNotificationsJob } from './skill-plan-notifications.job';
import { SkillFarmNotificationsJob } from './skill-farm-notifications.job';
import { EsiCacheCleanupJob } from './esi-cache-cleanup.job';
import { OAuthStateCleanupJob } from './oauth-state-cleanup.job';
import { DailyImportsJob } from './daily-imports.job';
import { MarketGatheringJob } from './market-gathering.job';
import { ExpiryNotificationsJob } from './expiry-notifications.job';
import { WalletImportsJob } from './wallet-imports.job';
import { CapitalRecomputeJob } from './capital-recompute.job';
import { SystemTokensRefreshJob } from './system-tokens-refresh.job';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => GameDataModule),
    WalletModule,
    ScheduleModule.forRoot(),
    forwardRef(() => CyclesModule),
    CharactersModule,
    NotificationsModule,
    SkillPlansModule,
    SkillFarmModule,
    EsiModule,
    SelfMarketModule,
    NpcMarketModule,
  ],
  providers: [
    // Shared helpers
    JobsGate,
    JobsFacadeService,
    CleanupRunner,
    TradeStalenessService,
    WalletImportsRunner,
    MarketGatheringRunner,
    SystemTokensRefresher,

    // Jobs (cron)
    SkillPlanNotificationsJob,
    SkillFarmNotificationsJob,
    EsiCacheCleanupJob,
    OAuthStateCleanupJob,
    DailyImportsJob,
    MarketGatheringJob,
    ExpiryNotificationsJob,
    WalletImportsJob,
    CapitalRecomputeJob,
    SystemTokensRefreshJob,
  ],
  controllers: [JobsController],
})
export class JobsModule {}
