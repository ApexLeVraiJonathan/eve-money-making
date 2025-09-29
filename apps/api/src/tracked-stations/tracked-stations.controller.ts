import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { TrackedStationsService } from './tracked-stations.service';

@Controller('tracked-stations')
export class TrackedStationsController {
  constructor(
    private readonly trackedStationsService: TrackedStationsService,
  ) {}

  @Post()
  async create(@Body() body: { stationId: number }) {
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
