import { Module, Logger } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { ImportModule } from '../import/import.module';
import { WalletModule } from '../wallet/wallet.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../characters/character.module';

@Module({
  imports: [
    PrismaModule,
    ImportModule,
    WalletModule,
    ReconciliationModule,
    ScheduleModule.forRoot(),
    LedgerModule,
    AuthModule,
    CharacterModule,
  ],
  providers: [JobsService, Logger],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
