import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '@api/common/config';
import { resolveJobEnabledFlag, type JobKey } from './job-keys';

@Injectable()
export class JobsGate {
  private readonly logger = new Logger(JobsGate.name);

  /**
   * Global gate: jobs only run in prod and only if enabled.
   * Per-job flag: defaults to enabled when env is unset.
   */
  shouldRun(job: JobKey): boolean {
    const appEnv = AppConfig.env();
    const jobsEnabled = AppConfig.jobs().enabled;

    if (appEnv !== 'prod' || !jobsEnabled) return false;

    return resolveJobEnabledFlag(job).enabled;
  }

  /**
   * For diagnostics/status pages: report the effective job flag and source key.
   */
  resolveEnabledFlag(job: JobKey): {
    enabled: boolean;
    sourceKey: string | null;
  } {
    return resolveJobEnabledFlag(job);
  }

  debugLogSkip(job: JobKey, message: string): void {
    if (AppConfig.env() !== 'prod') return;
    this.logger.debug(`Skipping job ${job.id}: ${message}`);
  }
}
