import { Module, Logger, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@api/prisma/prisma.module';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { GameDataModule } from '@api/game-data/game-data.module';
import { WalletModule } from '@api/tradecraft/wallet/wallet.module';
import { CyclesModule } from '@api/tradecraft/cycles/cycles.module';
import { CharactersModule } from '@api/characters/characters.module';
import { NotificationsModule } from '@api/notifications/notifications.module';
import { SkillPlansModule } from '@api/skill-plans/skill-plans.module';
import { SkillFarmModule } from '@api/skill-farm/skill-farm.module';

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
  ],
  providers: [JobsService, Logger],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
