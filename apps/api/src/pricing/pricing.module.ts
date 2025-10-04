import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EsiModule } from '../esi/esi.module';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

@Module({
  imports: [PrismaModule, EsiModule],
  providers: [PricingService],
  controllers: [PricingController],
})
export class PricingModule {}
