import { Module, Logger } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { EsiModule } from '../esi/esi.module';

@Module({
  imports: [PrismaModule, EsiModule],
  providers: [LedgerService, Logger],
  controllers: [LedgerController],
  exports: [LedgerService],
})
export class LedgerModule {}
