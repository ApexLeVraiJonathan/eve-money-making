import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { MarketDataHealthQueryDto } from './dto/market-data.dto';
import { MarketDataAnomalyService } from './market-data-anomaly.service';
import { MarketDataCleanupService } from './market-data-cleanup.service';
import { MarketDataHealthService } from './market-data-health.service';
import { MarketDataReadinessService } from './market-data-readiness.service';
import { MarketDataSpaceReportService } from './market-data-space-report.service';

@ApiTags('admin')
@Controller('market-data')
export class MarketDataController {
  constructor(
    private readonly spaceReport: MarketDataSpaceReportService,
    private readonly cleanup: MarketDataCleanupService,
    private readonly health: MarketDataHealthService,
    private readonly anomalies: MarketDataAnomalyService,
    private readonly readiness: MarketDataReadinessService,
  ) {}

  @Get('space')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Market data database space report for snapshot, run, and aggregate tables.',
  })
  @ApiOkResponse({ description: 'Market data space report' })
  async space() {
    return this.spaceReport.getReport();
  }

  @Post('cleanup/raw-npc')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Cleanup expired raw NPC market snapshots and run metadata while preserving active baselines.',
  })
  @ApiOkResponse({ description: 'Raw NPC market cleanup result' })
  async cleanupRawNpc() {
    return this.cleanup.cleanupRawNpcMarketData();
  }

  @Get('health')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Internal NPC and self-market scan health checks for completeness and stability.',
  })
  @ApiOkResponse({ description: 'Market data scan health report' })
  async scanHealth(@Query() query: MarketDataHealthQueryDto) {
    return this.health.getHealth(query);
  }

  @Get('anomalies')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Recent market price anomalies recorded by NPC and self-market validation.',
  })
  @ApiOkResponse({ description: 'Recent market price anomalies' })
  async recentAnomalies() {
    return this.anomalies.getRecentAnomalies();
  }

  @Get('readiness')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Global market data migration readiness for replacing Adam4EVE-backed market data.',
  })
  @ApiOkResponse({ description: 'Global market data readiness report' })
  async globalReadiness() {
    return this.readiness.getReadiness();
  }
}

