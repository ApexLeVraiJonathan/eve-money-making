import {
  Body,
  Controller,
  Post,
  Req,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import type { PlanResult } from '../../libs/arbitrage-packager/src/interfaces/packager.interfaces';
import { ArbitrageService } from './arbitrage.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Public } from '../auth/public.decorator';
import { ArbitrageCheckRequest } from './dto/check-request.dto';
import { PlanPackagesRequest } from './dto/plan-packages-request.dto';
import { PlanCommitRequest } from './dto/commit-request.dto';

class GetCommitsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

@ApiTags('arbitrage')
@Controller('arbitrage')
export class ArbitrageController {
  constructor(private readonly arbitrageService: ArbitrageService) {}

  @Public()
  @Post('check')
  @ApiOperation({ summary: 'Check arbitrage opportunities' })
  async check(@Body() body: ArbitrageCheckRequest, @Req() req: Request) {
    // Learning: After validation, body is typed and coerced; service can trust it.
    return this.arbitrageService.check(
      body,
      (req as Request & { reqId?: string }).reqId,
    );
  }

  @Public()
  @Post('plan-packages')
  @ApiOperation({ summary: 'Plan arbitrage packages' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Commit arbitrage plan' })
  async commit(
    @Body() body: PlanCommitRequest,
  ): Promise<{ id: string; createdAt: Date }> {
    return await this.arbitrageService.commitPlan(body);
  }

  @Public()
  @Get('commits')
  @ApiOperation({ summary: 'Get arbitrage commits' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async commits(@Query() query: GetCommitsQuery) {
    return this.arbitrageService.listCommits({
      limit: query.limit,
      offset: query.offset,
    });
  }
}
