import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';

@Module({
  imports: [PrismaModule],
  providers: [ReconciliationService],
  controllers: [ReconciliationController],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
