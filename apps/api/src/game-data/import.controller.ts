import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../characters/decorators/roles.decorator';
import { RolesGuard } from '../characters/guards/roles.guard';
import { ImportService } from './services/import.service';
import { BatchSizeDto } from './dto/batch-size.dto';
import { ImportDayDto } from './dto/import-day.dto';
import { ImportMissingDto } from './dto/import-missing.dto';

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

  @Get('summary')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get import summary statistics' })
  getSummary() {
    return this.importService.getSummary();
  }
}
