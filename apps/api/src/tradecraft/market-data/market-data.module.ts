import { Module } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { MarketDataController } from './market-data.controller';
import { MarketDataAnomalyService } from './market-data-anomaly.service';
import { MarketDataCleanupService } from './market-data-cleanup.service';
import { MarketDataHealthService } from './market-data-health.service';
import { MarketDataReadinessService } from './market-data-readiness.service';
import { MarketDataSpaceReportService } from './market-data-space-report.service';

@Module({
  imports: [PrismaModule],
  providers: [
    MarketDataSpaceReportService,
    MarketDataCleanupService,
    MarketDataHealthService,
    MarketDataReadinessService,
    MarketDataAnomalyService,
  ],
  controllers: [MarketDataController],
  exports: [
    MarketDataSpaceReportService,
    MarketDataCleanupService,
    MarketDataHealthService,
    MarketDataReadinessService,
    MarketDataAnomalyService,
  ],
})
export class MarketDataModule {}

