import { Controller, Post, Body, UsePipes, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ImportService } from './import.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';

const BatchSchema = z
  .object({ batchSize: z.coerce.number().int().min(1).max(50000).optional() })
  .strict();
const DaySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    batchSize: z.coerce.number().int().min(1).max(50000).optional(),
  })
  .strict();
const MissingSchema = z
  .object({
    daysBack: z.coerce.number().int().min(1).max(365).optional(),
    batchSize: z.coerce.number().int().min(1).max(50000).optional(),
  })
  .strict();

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('type-ids')
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async importTypeIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importTypeIds(body?.batchSize);
  }

  @Post('region-ids')
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async importRegionIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importRegionIds(body?.batchSize);
  }

  @Post('solar-system-ids')
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async importSolarSystemIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importSolarSystemIds(body?.batchSize);
  }

  @Post('npc-station-ids')
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async importNpcStationIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importNpcStationIds(body?.batchSize);
  }

  @Post('all')
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async importAll(
    @Body() body?: { batchSize?: number },
    @Req() _req?: Request,
  ) {
    return this.importService.importAll(body?.batchSize);
  }

  @Post('type-volumes')
  async importTypeVolumes() {
    return this.importService.importTypeVolumes();
  }

  @Post('market-trades/day')
  @UsePipes(new ZodValidationPipe(DaySchema))
  async importMarketTradesByDay(
    @Body() body: { date: string; batchSize?: number },
    @Req() _req?: Request,
  ) {
    return this.importService.importMarketOrderTradesByDate(
      body.date,
      body.batchSize,
    );
  }

  @Post('market-trades/missing')
  @UsePipes(new ZodValidationPipe(MissingSchema))
  async importMarketTradesMissing(
    @Body() body?: { daysBack?: number; batchSize?: number },
    @Req() _req?: Request,
  ) {
    return this.importService.importMissingMarketOrderTrades(
      body?.daysBack,
      body?.batchSize,
    );
  }
}
