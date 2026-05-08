import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarketDataCleanupService } from '@api/tradecraft/market-data/market-data-cleanup.service';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';

@Injectable()
export class MarketDataCleanupJob {
  private readonly logger = new Logger(MarketDataCleanupJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly cleanup: MarketDataCleanupService,
  ) {}

  @Cron('0 11 * * *')
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.marketDataCleanup)) return;
    await Promise.all([
      this.cleanup.cleanupRawNpcMarketData(),
      this.cleanup.cleanupExpiredMarketAnomalies(),
    ])
      .catch((e) =>
        this.logger.warn(
          `MarketDataCleanupJob failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
  }
}

