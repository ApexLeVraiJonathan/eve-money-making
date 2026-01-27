import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImportService } from '@api/game-data/services/import.service';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';

@Injectable()
export class DailyImportsJob {
  private readonly logger = new Logger(DailyImportsJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly imports: ImportService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.dailyImports)) return;
    try {
      const { missing } = await this.imports.importMissingMarketOrderTrades(15);
      this.logger.log(
        `Daily import finished; missing processed=${missing.length}`,
      );
    } catch (e) {
      this.logger.warn(
        `Daily import failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
