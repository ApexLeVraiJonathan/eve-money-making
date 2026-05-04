import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { NpcMarketCollectorService } from './npc-market-collector.service';
import { NpcMarketQueryService } from './npc-market-query.service';
import {
  NpcMarketCollectBodyDto,
  NpcMarketCompareAdam4EveQueryDto,
  NpcMarketDailyAggregatesQueryDto,
  NpcMarketSnapshotLatestQueryDto,
  NpcMarketSnapshotTypesQueryDto,
  NpcMarketStationQueryDto,
} from './dto/npc-market.dto';

@ApiTags('admin')
@Controller('npc-market')
export class NpcMarketController {
  constructor(
    private readonly collector: NpcMarketCollectorService,
    private readonly queries: NpcMarketQueryService,
  ) {}

  @Get('status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'NPC market status (collector config + resolved station + latest successful run)',
  })
  @ApiOkResponse({ description: 'NPC market collector status' })
  async status(@Query() q: NpcMarketStationQueryDto) {
    return this.queries.getStatus(q);
  }

  @Post('collect')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Manually trigger one full NPC market collection pass for a station (region types + snapshots + aggregates).',
  })
  @ApiOkResponse({ description: 'NPC market collection result' })
  async collect(
    @Query() q: NpcMarketStationQueryDto,
    @Body() body?: NpcMarketCollectBodyDto,
  ) {
    const stationId = this.queries.resolveStationId(q.stationId);
    if (!stationId) throw new BadRequestException('Invalid stationId');
    const res = await this.collector.collectStationOnce({
      stationId,
      forceRefresh: Boolean(body?.forceRefresh),
    });
    return res;
  }

  @Get('snapshot/latest/types')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Fetch latest NPC snapshot grouped by typeId (type summary, derived from stored snapshot stats)',
  })
  @ApiOkResponse({ description: 'NPC market snapshot grouped by type' })
  async snapshotLatestTypes(@Query() q: NpcMarketSnapshotTypesQueryDto) {
    return this.queries.getSnapshotLatestTypes(q);
  }

  @Get('snapshot/latest')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Fetch latest stored NPC station snapshot (requires typeId; optionally filtered by side)',
  })
  @ApiOkResponse({ description: 'Latest NPC station snapshot orders' })
  async snapshotLatest(@Query() q: NpcMarketSnapshotLatestQueryDto) {
    return this.queries.getSnapshotLatest(q);
  }

  @Get('aggregates/daily')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch NPC self-gathered daily aggregates for a station + date',
  })
  @ApiOkResponse({ description: 'NPC market daily aggregates' })
  async daily(@Query() q: NpcMarketDailyAggregatesQueryDto) {
    return this.queries.getDailyAggregates(q);
  }

  @Get('compare/adam4eve')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Compare NPC self-gathered daily aggregates vs Adam4EVE-imported daily aggregates for a station over a date range.',
  })
  @ApiOkResponse({ description: 'NPC market Adam4EVE comparison rows' })
  async compareAdam4Eve(@Query() q: NpcMarketCompareAdam4EveQueryDto) {
    return this.queries.compareAdam4Eve(q);
  }
}
