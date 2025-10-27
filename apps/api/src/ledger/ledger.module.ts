import { Module, Logger } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { EsiModule } from '../esi/esi.module';
import { WalletModule } from '../wallet/wallet.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { PackagesModule } from '../packages/packages.module';

@Module({
  imports: [
    PrismaModule,
    EsiModule,
    WalletModule,
    ReconciliationModule,
    PackagesModule,
  ],
  providers: [LedgerService, Logger],
  controllers: [LedgerController],
  exports: [LedgerService],
})
export class LedgerModule {}
