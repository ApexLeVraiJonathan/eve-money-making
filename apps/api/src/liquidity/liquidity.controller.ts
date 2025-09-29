import { Controller, Post, Body } from '@nestjs/common';
import { LiquidityService } from './liquidity.service';
import type { LiquidityItemDto } from './dto/liquidity-item.dto';

@Controller('liquidity')
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityService) {}

  @Post('check')
  async check(
    @Body()
    body?: {
      station_id?: number;
      windowDays?: number;
      minCoverageRatio?: number;
      minLiquidityThresholdISK?: number;
    },
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
