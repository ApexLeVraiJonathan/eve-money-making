import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('esi-cache/cleanup')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async cleanup() {
    return this.jobs.cleanupExpiredEsiCache();
  }

  @Get('staleness')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async staleness() {
    return this.jobs.backfillMissingTrades(15);
  }

  @Get('wallets/run')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async runWallets() {
    await this.jobs.runWalletImportsAndReconcile();
    return { ok: true };
  }
}
