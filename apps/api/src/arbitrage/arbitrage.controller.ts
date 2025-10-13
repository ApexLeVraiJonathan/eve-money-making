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
import { z } from 'zod';
import type { PlanResult } from '../../libs/arbitrage-packager/src/interfaces/packager.interfaces';
import { ArbitrageService } from './arbitrage.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UseGuards } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
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

  @Public()
  @Post('check')
  @UsePipes(new ZodValidationPipe(ArbitrageCheckRequestSchema))
  async check(@Body() body: ArbitrageCheckRequest, @Req() req: Request) {
    // Learning: After validation, body is typed and coerced; service can trust it.
    return this.arbitrageService.check(
      body,
      (req as Request & { reqId?: string }).reqId,
    );
  }

  @Public()
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
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(PlanCommitRequestSchema))
  async commit(
    @Body() body: PlanCommitRequest,
  ): Promise<{ id: string; createdAt: Date }> {
    return await this.arbitrageService.commitPlan(body);
  }

  @Public()
  @Get('commits')
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          limit: z.coerce.number().int().min(1).max(200).optional(),
          offset: z.coerce.number().int().min(0).optional(),
        })
        .strict(),
    ),
  )
  async commits(@Query() query: { limit?: number; offset?: number }) {
    return this.arbitrageService.listCommits({
      limit: query.limit,
      offset: query.offset,
    });
  }
}
