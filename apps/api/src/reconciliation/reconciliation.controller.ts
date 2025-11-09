import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllocationService } from './allocation.service';

@ApiTags('reconciliation')
@Controller('recon')
export class ReconciliationController {
  constructor(private readonly allocation: AllocationService) {}

  @Post('reconcile')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reconcile wallet transactions with cycle lines' })
  @ApiQuery({ name: 'cycleId', required: false, type: String })
  async reconcile(@Query('cycleId') cycleId?: string) {
    // Run allocation system for buys and sells
    return await this.allocation.allocateAll(cycleId);
  }
}
