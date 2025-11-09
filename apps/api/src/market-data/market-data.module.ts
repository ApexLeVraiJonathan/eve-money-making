import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
