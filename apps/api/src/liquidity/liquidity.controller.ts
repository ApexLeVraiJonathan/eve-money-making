import { Controller, Post, Body, UsePipes, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Public } from '../auth/public.decorator';
import { UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { LiquidityService } from './liquidity.service';
import type { LiquidityItemDto } from './dto/liquidity-item.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  LiquidityCheckRequestSchema,
  type LiquidityCheckRequest,
} from './dto/check-request.dto';
import {
  LiquidityItemStatsRequestSchema,
  type LiquidityItemStatsRequest,
} from './dto/item-stats-request.dto';

@Controller('liquidity')
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityService) {}

  @Post('check')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(LiquidityCheckRequestSchema))
  async check(
    @Body()
    body: LiquidityCheckRequest,
    @Req() req: Request,
  ): Promise<
    Record<
      string,
      { stationName: string; totalItems: number; items: LiquidityItemDto[] }
    >
  > {
    const reqId = (req as Request & { reqId?: string }).reqId;
    return await this.liquidityService.runCheck(body, reqId);
  }

  @Post('item-stats')
  @Public()
  // @Roles('ADMIN')
  // @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(LiquidityItemStatsRequestSchema))
  async itemStats(
    @Body() body: LiquidityItemStatsRequest,
    @Req() req: Request,
  ) {
    const reqId = (req as Request & { reqId?: string }).reqId;
    return this.liquidityService.getItemStats(body, reqId);
  }
}
