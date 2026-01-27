import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';
import { WalletImportsRunner } from './wallet-imports.runner';

@Injectable()
export class WalletImportsJob {
  private readonly logger = new Logger(WalletImportsJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly runner: WalletImportsRunner,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.walletImports)) return;
    try {
      await this.runner.executeWalletImportsAndAllocation();
    } catch (e) {
      this.logger.warn(
        `Hourly wallets/allocation failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
