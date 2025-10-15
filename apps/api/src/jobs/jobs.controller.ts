import { Controller, Get, Post } from '@nestjs/common';
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
    const result = await this.jobs.executeWalletImportsAndAllocation();
    return {
      ok: true,
      buysAllocated: result.buysAllocated,
      sellsAllocated: result.sellsAllocated,
    };
  }

  @Get('oauth-state/cleanup')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async cleanupOAuthStates() {
    return this.jobs.cleanupExpiredOAuthStates();
  }

  @Get('system-tokens/refresh')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async refreshSystemTokens() {
    await this.jobs.refreshSystemCharacterTokens();
    return { ok: true };
  }

  @Post('wallet/cleanup')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async cleanupWalletJournals() {
    return this.jobs.cleanupWalletJournals();
  }
}
