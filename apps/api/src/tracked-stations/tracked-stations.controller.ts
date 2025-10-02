import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UsePipes,
} from '@nestjs/common';
import { TrackedStationsService } from './tracked-stations.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  TrackedStationCreateSchema,
  type TrackedStationCreate,
} from './dto/tracked-station.dto';

@Controller('tracked-stations')
export class TrackedStationsController {
  constructor(
    private readonly trackedStationsService: TrackedStationsService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(TrackedStationCreateSchema))
  async create(@Body() body: TrackedStationCreate) {
    return this.trackedStationsService.create(body.stationId);
  }

  @Get()
  async list() {
    return this.trackedStationsService.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.trackedStationsService.get(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.trackedStationsService.remove(id);
  }
}
