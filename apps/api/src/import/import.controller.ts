import { Controller, Post, Body, UsePipes } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UseGuards } from '@nestjs/common';
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
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async importTypeIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importTypeIds(body?.batchSize);
  }

  @Post('region-ids')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async importRegionIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importRegionIds(body?.batchSize);
  }

  @Post('solar-system-ids')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async importSolarSystemIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importSolarSystemIds(body?.batchSize);
  }

  @Post('npc-station-ids')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async importNpcStationIds(@Body() body?: { batchSize?: number }) {
    return this.importService.importNpcStationIds(body?.batchSize);
  }

  @Post('all')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async importAll(@Body() body?: { batchSize?: number }) {
    return this.importService.importAll(body?.batchSize);
  }

  @Post('type-volumes')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async importTypeVolumes() {
    return this.importService.importTypeVolumes();
  }

  @Post('market-trades/day')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(DaySchema))
  async importMarketTradesByDay(
    @Body() body: { date: string; batchSize?: number },
  ) {
    return this.importService.importMarketOrderTradesByDate(
      body.date,
      body.batchSize,
    );
  }

  @Post('market-trades/missing')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(MissingSchema))
  async importMarketTradesMissing(
    @Body() body?: { daysBack?: number; batchSize?: number },
  ) {
    return this.importService.importMissingMarketOrderTrades(
      body?.daysBack,
      body?.batchSize,
    );
  }
}
