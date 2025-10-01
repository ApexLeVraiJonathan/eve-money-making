import { Controller, Post, Body, UsePipes } from '@nestjs/common';
import { LiquidityService } from './liquidity.service';
import type { LiquidityItemDto } from './dto/liquidity-item.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  LiquidityCheckRequestSchema,
  type LiquidityCheckRequest,
} from './dto/check-request.dto';

@Controller('liquidity')
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityService) {}

  @Post('check')
  @UsePipes(new ZodValidationPipe(LiquidityCheckRequestSchema))
  async check(
    @Body()
    body: LiquidityCheckRequest,
  ): Promise<
    Record<
      string,
      { stationName: string; totalItems: number; items: LiquidityItemDto[] }
    >
  > {
    return await this.liquidityService.runCheck(body);
  }

  @Post('item-stats')
  async itemStats(
    @Body()
    body: {
      itemId?: number;
      itemName?: string;
      stationId?: number;
      stationName?: string;
      isBuyOrder?: boolean;
      windowDays?: number;
    },
  ) {
    return this.liquidityService.getItemStats(body);
  }
}
