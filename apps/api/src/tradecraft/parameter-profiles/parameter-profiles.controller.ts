import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ParameterProfilesService } from './parameter-profiles.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ListProfilesQueryDto } from './dto/list-profiles-query.dto';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { Public } from '@api/characters/decorators/public.decorator';
import type { Request } from 'express';

@ApiTags('parameter-profiles')
@Controller('parameter-profiles')
export class ParameterProfilesController {
  constructor(
    private readonly parameterProfilesService: ParameterProfilesService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all parameter profiles' })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['LIQUIDITY', 'ARBITRAGE', 'PLANNER'],
  })
  async findAll(@Query() query: ListProfilesQueryDto) {
    return this.parameterProfilesService.findAll(query.scope);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a parameter profile by ID' })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  async findOne(@Param('id') id: string) {
    return this.parameterProfilesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new parameter profile' })
  async create(@Body() dto: CreateProfileDto, @Req() req: Request) {
    // Extract user ID from request if available
    const user = (req as any).user;
    const userId = user?.sub || user?.id;
    return this.parameterProfilesService.create(dto, userId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a parameter profile' })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateProfileDto) {
    return this.parameterProfilesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a parameter profile' })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  async remove(@Param('id') id: string) {
    return this.parameterProfilesService.remove(id);
  }
}
