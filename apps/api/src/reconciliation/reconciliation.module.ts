import { Module, Logger } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReconciliationController } from './reconciliation.controller';
import { AllocationService } from './allocation.service';

@Module({
  imports: [PrismaModule],
  providers: [AllocationService, Logger],
  controllers: [ReconciliationController],
  exports: [AllocationService],
})
export class ReconciliationModule {}
