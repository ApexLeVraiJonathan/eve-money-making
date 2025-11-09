import { Module, Logger } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { GameDataModule } from '../game-data/game-data.module';
import { WalletModule } from '../wallet/wallet.module';
import { CyclesModule } from '../cycles/cycles.module';
import { CharactersModule } from '../characters/characters.module';

@Module({
  imports: [
    PrismaModule,
    GameDataModule,
    WalletModule,
    ScheduleModule.forRoot(),
    CyclesModule,
    CharactersModule,
  ],
  providers: [JobsService, Logger],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
