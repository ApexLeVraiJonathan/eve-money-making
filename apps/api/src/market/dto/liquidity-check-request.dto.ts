import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Request DTO for POST /liquidity/check
 */
export class LiquidityCheckRequest {
  @ApiPropertyOptional({
    description: 'Station ID to check liquidity for',
    example: 60003760,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  station_id?: number;

  @ApiPropertyOptional({
    description: 'Time window in days for liquidity calculation',
    minimum: 1,
    example: 7,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  windowDays?: number;

  @ApiPropertyOptional({
    description: 'Minimum coverage ratio',
    minimum: 0,
    maximum: 1,
    example: 0.8,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minCoverageRatio?: number;

  @ApiPropertyOptional({
    description: 'Minimum liquidity threshold in ISK',
    minimum: 0,
    example: 1000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minLiquidityThresholdISK?: number;

  @ApiPropertyOptional({
    description: 'Minimum average number of trades per day over the window',
    minimum: 0,
    example: 10,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minWindowTrades?: number;
}
