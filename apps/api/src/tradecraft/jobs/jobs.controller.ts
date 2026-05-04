import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { JobsFacadeService } from './jobs-facade.service';

@ApiTags('jobs')
@Roles('ADMIN')
@UseGuards(RolesGuard)
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsFacadeService) {}

  @Post('esi-cache/cleanup')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cleanup expired ESI cache entries' })
  @ApiOkResponse({ description: 'Expired ESI cache cleanup result' })
  async cleanup() {
    return this.jobs.cleanupExpiredEsiCache();
  }

  @Get('esi-cache/cleanup')
  @ApiOperation({ summary: 'Cleanup expired ESI cache entries' })
  @ApiOkResponse({ description: 'Expired ESI cache cleanup result' })
  async cleanupGet() {
    return this.cleanup();
  }

  @Post('staleness')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Backfill missing trade data' })
  @ApiOkResponse({ description: 'Market staleness backfill result' })
  async staleness() {
    return this.jobs.backfillMissingTrades(15);
  }

  @Get('staleness')
  @ApiOperation({ summary: 'Backfill missing trade data' })
  @ApiOkResponse({ description: 'Market staleness backfill result' })
  async stalenessGet() {
    return this.staleness();
  }

  @Post('wallets/run')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Run wallet imports and allocation' })
  @ApiOkResponse({ description: 'Wallet import and allocation result' })
  async runWallets() {
    const result = await this.jobs.executeWalletImportsAndAllocation();
    return {
      ok: true,
      buysAllocated: result.buysAllocated,
      sellsAllocated: result.sellsAllocated,
    };
  }

  @Get('wallets/run')
  @ApiOperation({ summary: 'Run wallet imports and allocation' })
  @ApiOkResponse({ description: 'Wallet import and allocation result' })
  async runWalletsGet() {
    return this.runWallets();
  }

  @Post('oauth-state/cleanup')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cleanup expired OAuth states' })
  @ApiOkResponse({ description: 'Expired OAuth state cleanup result' })
  async cleanupOAuthStates() {
    return this.jobs.cleanupExpiredOAuthStates();
  }

  @Get('oauth-state/cleanup')
  @ApiOperation({ summary: 'Cleanup expired OAuth states' })
  @ApiOkResponse({ description: 'Expired OAuth state cleanup result' })
  async cleanupOAuthStatesGet() {
    return this.cleanupOAuthStates();
  }

  @Post('system-tokens/refresh')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh system character tokens' })
  @ApiOkResponse({ description: 'System character token refresh result' })
  async refreshSystemTokens() {
    await this.jobs.refreshSystemCharacterTokens();
    return { ok: true };
  }

  @Get('system-tokens/refresh')
  @ApiOperation({ summary: 'Refresh system character tokens' })
  @ApiOkResponse({ description: 'System character token refresh result' })
  async refreshSystemTokensGet() {
    return this.refreshSystemTokens();
  }

  @Post('wallet/cleanup')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cleanup old wallet journals' })
  @ApiOkResponse({ description: 'Old wallet journal cleanup result' })
  async cleanupWalletJournals() {
    return this.jobs.cleanupWalletJournals();
  }

  @Get('wallet/cleanup')
  @ApiOperation({ summary: 'Cleanup old wallet journals' })
  @ApiOkResponse({ description: 'Old wallet journal cleanup result' })
  async cleanupWalletJournalsGet() {
    return this.cleanupWalletJournals();
  }
}
