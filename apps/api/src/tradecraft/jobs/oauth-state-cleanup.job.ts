import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';
import { CleanupRunner } from './cleanup.runner';

@Injectable()
export class OAuthStateCleanupJob {
  private readonly logger = new Logger(OAuthStateCleanupJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly cleanup: CleanupRunner,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.oauthStateCleanup)) return;
    await this.cleanup
      .cleanupExpiredOAuthStates()
      .catch((e) =>
        this.logger.warn(
          `OAuth state cleanup failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
  }
}
