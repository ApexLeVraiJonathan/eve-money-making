import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('esi-cache/cleanup')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cleanup expired ESI cache entries' })
  async cleanup() {
    return this.jobs.cleanupExpiredEsiCache();
  }

  @Get('staleness')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Backfill missing trade data' })
  async staleness() {
    return this.jobs.backfillMissingTrades(15);
  }

  @Get('wallets/run')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Run wallet imports and allocation' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cleanup expired OAuth states' })
  async cleanupOAuthStates() {
    return this.jobs.cleanupExpiredOAuthStates();
  }

  @Get('system-tokens/refresh')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh system character tokens' })
  async refreshSystemTokens() {
    await this.jobs.refreshSystemCharacterTokens();
    return { ok: true };
  }

  @Post('wallet/cleanup')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cleanup old wallet journals' })
  async cleanupWalletJournals() {
    return this.jobs.cleanupWalletJournals();
  }
}
