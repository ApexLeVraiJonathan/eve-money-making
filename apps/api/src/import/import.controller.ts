import { Controller, Post, Body } from '@nestjs/common';
import { ImportService } from './import.service';

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('type-ids')
  async importTypeIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importTypeIds(body?.batchSize);
  }

  @Post('region-ids')
  async importRegionIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importRegionIds(body?.batchSize);
  }

  @Post('solar-system-ids')
  async importSolarSystemIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importSolarSystemIds(body?.batchSize);
  }

  @Post('npc-station-ids')
  async importNpcStationIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importNpcStationIds(body?.batchSize);
  }

  @Post('all')
  async importAll(@Body() body?: { batchSize?: number }) {
    return this.importService.importAll(body?.batchSize);
  }

  @Post('market-trades/day')
  async importMarketTradesByDay(
    @Body() body: { date: string; batchSize?: number },
  ) {
    return this.importService.importMarketOrderTradesByDate(
      body.date,
      body.batchSize,
    );
  }

  @Post('market-trades/missing')
  async importMarketTradesMissing(
    @Body() body?: { daysBack?: number; batchSize?: number },
  ) {
    return this.importService.importMissingMarketOrderTrades(
      body?.daysBack,
      body?.batchSize,
    );
  }
}
