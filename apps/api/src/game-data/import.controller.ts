import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { ImportService } from './services/import.service';
import { BatchSizeDto } from './dto/batch-size.dto';
import { ImportDayDto } from './dto/import-day.dto';
import { ImportMissingDto } from './dto/import-missing.dto';
import { ImportSdeSkillsDto } from './dto/import-sde-skills.dto';
import { ImportWeeklyUrlDto } from './dto/import-weekly-url.dto';

@ApiTags('admin')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('type-ids')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Import EVE type IDs',
    description:
      'Imports type IDs from Adam4Eve CSV. Creates missing types and updates names/published flags for existing ones. Safe to re-run to fix incorrect item names.',
  })
  async importTypeIds(@Body() body?: BatchSizeDto) {
    return this.importService.importTypeIds(body?.batchSize);
  }

  @Post('region-ids')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import EVE region IDs' })
  async importRegionIds(@Body() body?: BatchSizeDto) {
    return this.importService.importRegionIds(body?.batchSize);
  }

  @Post('solar-system-ids')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import EVE solar system IDs' })
  async importSolarSystemIds(@Body() body?: BatchSizeDto) {
    return this.importService.importSolarSystemIds(body?.batchSize);
  }

  @Post('npc-station-ids')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import EVE NPC station IDs' })
  async importNpcStationIds(@Body() body?: BatchSizeDto) {
    return this.importService.importNpcStationIds(body?.batchSize);
  }

  @Post('all')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import all EVE static data' })
  async importAll(@Body() body?: BatchSizeDto) {
    return this.importService.importAll(body?.batchSize);
  }

  @Post('type-volumes')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Import type volumes from EVE',
    description:
      'Fetches volume/size data from ESI for all published types. Updates existing volumes to fix incorrect shipment sizes. Safe to re-run.',
  })
  async importTypeVolumes() {
    return this.importService.importTypeVolumes();
  }

  @Post('sde/skills')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Import skill definitions from a locally downloaded EVE SDE',
    description:
      'Reads types.jsonl from the provided SDE base path and records all skills (categoryID=16) into the SkillDefinition table.',
  })
  async importSdeSkills(@Body() body: ImportSdeSkillsDto) {
    return this.importService.importSkillDefinitionsFromSde(
      body.basePath,
      body.batchSize,
    );
  }

  @Post('sde/skills/latest')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Download latest SDE JSONL from CCP and import skill definitions',
    description:
      'Fetches eve-online-static-data-latest-jsonl.zip, extracts it under the API app folder, and imports all skills into SkillDefinition.',
  })
  async importSdeSkillsLatest(@Body() body?: BatchSizeDto) {
    return this.importService.downloadLatestSdeAndImportSkills(body?.batchSize);
  }

  @Post('market-trades/day')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import market trades for a specific day' })
  async importMarketTradesByDay(@Body() body: ImportDayDto) {
    return this.importService.importMarketOrderTradesByDate(
      body.date,
      body.batchSize,
    );
  }

  @Post('market-trades/missing')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import missing market trades' })
  async importMarketTradesMissing(@Body() body?: ImportMissingDto) {
    return this.importService.importMissingMarketOrderTrades(
      body?.daysBack,
      body?.batchSize,
    );
  }

  @Post('market-trades/weekly-url')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Import market trades from an Adam4EVE weekly CSV URL (dev backfill)',
    description:
      'Downloads and imports an Adam4EVE weekly MarketOrdersTrades CSV. Filters to tracked stations plus the configured source station.',
  })
  async importMarketTradesWeeklyUrl(@Body() body: ImportWeeklyUrlDto) {
    return this.importService.importMarketOrderTradesWeeklyByUrl(
      body.url,
      body.batchSize,
    );
  }

  @Get('summary')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get import summary statistics' })
  getSummary() {
    return this.importService.getSummary();
  }
}
