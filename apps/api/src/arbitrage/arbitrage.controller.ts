import {
  Body,
  Controller,
  Post,
  Req,
  UsePipes,
  Get,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
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
import {
  PlanCommitRequestSchema,
  type PlanCommitRequest,
} from './dto/commit-request.dto';

@Controller('arbitrage')
export class ArbitrageController {
  constructor(private readonly arbitrageService: ArbitrageService) {}

  @Post('check')
  @UsePipes(new ZodValidationPipe(ArbitrageCheckRequestSchema))
  async check(@Body() body: ArbitrageCheckRequest, @Req() req: Request) {
    // Learning: After validation, body is typed and coerced; service can trust it.
    return this.arbitrageService.check(
      body,
      (req as Request & { reqId?: string }).reqId,
    );
  }

  @Post('plan-packages')
  @UsePipes(new ZodValidationPipe(PlanPackagesRequestSchema))
  async planPackages(
    @Body() body: PlanPackagesRequest,
    @Req() req: Request,
  ): Promise<PlanResult> {
    return await this.arbitrageService.planPackages(
      body,
      (req as Request & { reqId?: string }).reqId,
    );
  }

  @Post('commit')
  @UsePipes(new ZodValidationPipe(PlanCommitRequestSchema))
  async commit(
    @Body() body: PlanCommitRequest,
  ): Promise<{ id: string; createdAt: Date }> {
    return await this.arbitrageService.commitPlan(body);
  }

  @Get('commits')
  async commits(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const l = limit ? Number(limit) : undefined;
    const o = offset ? Number(offset) : undefined;
    return this.arbitrageService.listCommits({ limit: l, offset: o });
  }
}
