import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../characters/decorators/roles.decorator';
import { RolesGuard } from '../characters/guards/roles.guard';
import { Public } from '../characters/decorators/public.decorator';
import type { Request } from 'express';
import { LiquidityService } from './services/liquidity.service';
import type { LiquidityItemDto } from './dto/liquidity-item.dto';
import { LiquidityCheckRequest } from './dto/liquidity-check-request.dto';
import { LiquidityItemStatsRequest } from './dto/item-stats-request.dto';

@ApiTags('liquidity')
@Controller('liquidity')
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityService) {}

  @Post('check')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check liquidity for items across tracked stations',
  })
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
  @ApiOperation({ summary: 'Get detailed liquidity stats for a specific item' })
  async itemStats(
    @Body() body: LiquidityItemStatsRequest,
    @Req() req: Request,
  ) {
    const reqId = (req as Request & { reqId?: string }).reqId;
    return await this.liquidityService.getItemStats(body, reqId);
  }
}
