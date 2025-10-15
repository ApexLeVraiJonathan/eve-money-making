import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllocationService } from './allocation.service';

@Controller('recon')
export class ReconciliationController {
  constructor(private readonly allocation: AllocationService) {}

  @Post('reconcile')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async reconcile(@Query('cycleId') cycleId?: string) {
    // Run allocation system for buys and sells
    return await this.allocation.allocateAll(cycleId);
  }
}
