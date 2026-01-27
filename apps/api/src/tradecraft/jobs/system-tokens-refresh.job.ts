import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';
import { SystemTokensRefresher } from './system-tokens.refresher';

@Injectable()
export class SystemTokensRefreshJob {
  private readonly logger = new Logger(SystemTokensRefreshJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly refresher: SystemTokensRefresher,
  ) {}

  /**
   * Runs at 2 AM on the 1st of each month.
   */
  @Cron('0 2 1 * *')
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.systemTokensRefresh)) return;
    await this.refresher
      .refreshSystemCharacterTokens()
      .catch((e) =>
        this.logger.warn(
          `System token refresh job failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
  }
}
