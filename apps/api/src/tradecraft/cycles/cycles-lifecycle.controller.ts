import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { OpenCycleRequest } from './dto/open-cycle.dto';
import { CycleLifecycleService } from './services/cycle-lifecycle.service';

@ApiTags('cycle-lifecycle')
@Controller('ledger')
export class CyclesLifecycleController {
  constructor(private readonly cycleLifecycle: CycleLifecycleService) {}

  @Post('cycles/:id/close')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Run Cycle Settlement for the Open Cycle',
    description:
      'Runs the Cycle Lifecycle Entry Point for Cycle Settlement and returns a Settlement Report. The route path is retained for API compatibility.',
  })
  @ApiParam({ name: 'id', description: 'Cycle ID' })
  @ApiOkResponse({ description: 'Settlement Report' })
  async settleOpenCycle(@Param('id') id: string): Promise<unknown> {
    return await this.cycleLifecycle.settleOpenCycle({ cycleId: id });
  }

  @Post('cycles/:id/open')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Open a planned Cycle through the Cycle Lifecycle Entry Point',
    description:
      'Opens the planned Cycle. If another Cycle is open, the lifecycle entry point performs Cycle Settlement first so there is still at most one Open Cycle.',
  })
  @ApiParam({ name: 'id', description: 'Cycle ID' })
  @ApiOkResponse({ description: 'Cycle Lifecycle transition result' })
  async openPlannedCycle(
    @Param('id') id: string,
    @Body() body: OpenCycleRequest,
  ): Promise<unknown> {
    return await this.cycleLifecycle.openPlannedCycle({
      cycleId: id,
      startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
    });
  }
}
