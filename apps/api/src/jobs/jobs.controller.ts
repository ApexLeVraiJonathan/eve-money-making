import { Controller, Get } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('esi-cache/cleanup')
  async cleanup() {
    return this.jobs.cleanupExpiredEsiCache();
  }

  @Get('staleness')
  async staleness() {
    return this.jobs.backfillMissingTrades(15);
  }

  @Get('wallets/run')
  async runWallets() {
    await this.jobs.runWalletImportsAndReconcile();
    return { ok: true };
  }
}
