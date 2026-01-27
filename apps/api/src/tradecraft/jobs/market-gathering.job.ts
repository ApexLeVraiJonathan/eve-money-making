import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';
import { MarketGatheringRunner } from './market-gathering.runner';

@Injectable()
export class MarketGatheringJob {
  private readonly logger = new Logger(MarketGatheringJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly runner: MarketGatheringRunner,
  ) {}

  @Cron('*/15 * * * *')
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.marketGathering)) return;
    await this.runner
      .runOnce()
      .catch((e) =>
        this.logger.warn(
          `MarketGatheringJob failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
  }
}
