import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import type { PlanResult } from '../../libs/arbitrage-packager/src/interfaces/packager.interfaces';
import { ArbitrageService } from './arbitrage.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  ArbitrageCheckRequestSchema,
  type ArbitrageCheckRequest,
} from './dto/check-request.dto';
import {
  PlanPackagesRequestSchema,
  type PlanPackagesRequest,
} from './dto/plan-packages-request.dto';

@Controller('arbitrage')
export class ArbitrageController {
  constructor(private readonly arbitrageService: ArbitrageService) {}

  @Post('check')
  @UsePipes(new ZodValidationPipe(ArbitrageCheckRequestSchema))
  async check(@Body() body: ArbitrageCheckRequest) {
    // Learning: After validation, body is typed and coerced; service can trust it.
    return this.arbitrageService.check(body);
  }

  @Post('plan-packages')
  @UsePipes(new ZodValidationPipe(PlanPackagesRequestSchema))
  async planPackages(@Body() body: PlanPackagesRequest): Promise<PlanResult> {
    return await this.arbitrageService.planPackages(body);
  }
}
