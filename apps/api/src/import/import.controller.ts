import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ImportService } from './import.service';
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
  @ApiOperation({ summary: 'Import EVE type IDs' })
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
  @ApiOperation({ summary: 'Import type volumes from EVE' })
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
