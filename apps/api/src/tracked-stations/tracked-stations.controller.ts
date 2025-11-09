import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TrackedStationsService } from './tracked-stations.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TrackedStationCreate } from './dto/tracked-station.dto';
import { Public } from '../auth/public.decorator';

@ApiTags('admin')
@Controller('tracked-stations')
export class TrackedStationsController {
  constructor(
    private readonly trackedStationsService: TrackedStationsService,
  ) {}

  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a tracked station' })
  async create(@Body() body: TrackedStationCreate) {
    return this.trackedStationsService.create(body.stationId);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all tracked stations' })
  async list() {
    return this.trackedStationsService.list();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a tracked station by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async get(@Param('id') id: string) {
    return this.trackedStationsService.get(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a tracked station' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(@Param('id') id: string) {
    return this.trackedStationsService.remove(id);
  }
}
