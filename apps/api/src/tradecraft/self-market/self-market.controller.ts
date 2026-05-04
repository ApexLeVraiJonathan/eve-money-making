import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { SelfMarketCollectorService } from './self-market-collector.service';
import { SelfMarketQueryService } from './self-market-query.service';
import {
  SelfMarketDailyAggregatesQueryDto,
  SelfMarketSnapshotLatestQueryDto,
  SelfMarketStatusQueryDto,
  SelfMarketSnapshotTypeSummaryQueryDto,
  SelfMarketClearDailyQueryDto,
  SelfMarketCollectBodyDto,
} from '@api/tradecraft/market/dto/self-market.dto';

@ApiTags('admin')
@Controller('self-market')
export class SelfMarketController {
  constructor(
    private readonly collector: SelfMarketCollectorService,
    private readonly queries: SelfMarketQueryService,
  ) {}

  @Get('status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Self market status (collector config + latest snapshot + latest aggregates day)',
  })
  @ApiOkResponse({ description: 'Self-market collector status' })
  async status(@Query() q: SelfMarketStatusQueryDto) {
    return this.queries.getStatus(q);
  }

  @Get('snapshot/latest')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch latest stored structure snapshot (optionally filtered)',
  })
  @ApiOkResponse({ description: 'Latest self-market structure snapshot' })
  async snapshotLatest(@Query() q: SelfMarketSnapshotLatestQueryDto) {
    return this.queries.getSnapshotLatest(q);
  }

  @Get('snapshot/latest/types')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch latest snapshot grouped by typeId (type summary)',
  })
  @ApiOkResponse({ description: 'Latest self-market snapshot grouped by type' })
  async snapshotLatestTypes(@Query() q: SelfMarketSnapshotTypeSummaryQueryDto) {
    return this.queries.getSnapshotLatestTypes(q);
  }

  @Get('aggregates/daily')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch self-gathered daily aggregates for a structure + date',
  })
  @ApiOkResponse({ description: 'Self-market daily aggregates' })
  async daily(
    @Query() q: SelfMarketDailyAggregatesQueryDto,
    @Req() req: Request,
  ) {
    return this.queries.getDailyAggregates({
      query: q,
      rawHasGone: (req.query as Record<string, unknown>)?.hasGone,
    });
  }

  @Post('collect')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Manually trigger a single self-market collection pass (snapshot + aggregates). Useful in dev when cron jobs are off.',
  })
  @ApiOkResponse({ description: 'Self-market collection result' })
  async collect(@Body() body?: SelfMarketCollectBodyDto) {
    try {
      const res = await this.collector.collectStructureOnce({
        forceRefresh: Boolean(body?.forceRefresh),
      });
      return {
        ok: true,
        observedAt: res.observedAt.toISOString(),
        orderCount: res.orderCount,
        tradesKeys: res.tradesKeys,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? 'unknown');
      // Treat common misconfig as a 400 for a nicer dev UX.
      if (
        msg.includes('MARKET_SELF_GATHER_STRUCTURE_ID') ||
        msg.includes('MARKET_SELF_GATHER_CHARACTER_ID')
      ) {
        throw new BadRequestException(msg);
      }
      throw e;
    }
  }

  @Post('aggregates/clear')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[Non-prod] Clear self-market daily aggregates for a UTC date so you can re-run collection in dev without confusion.',
  })
  @ApiOkResponse({ description: 'Self-market daily aggregate clear result' })
  async clearDaily(@Query() q: SelfMarketClearDailyQueryDto) {
    return this.queries.clearDaily(q);
  }
}
