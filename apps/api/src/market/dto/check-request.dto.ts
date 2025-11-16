import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Request DTO for POST /arbitrage/check
 *
 * Notes for learning:
 * - @Type(() => Number) transforms string input to numbers safely
 * - We validate ranges to catch accidental negatives or unreasonable values
 */
export class ArbitrageCheckRequest {
  @ApiPropertyOptional({
    description: 'Source station ID for arbitrage calculation',
    example: 60003760,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceStationId?: number;

  @ApiPropertyOptional({
    description: 'Maximum days of average daily volume to hold as inventory',
    minimum: 0.1,
    maximum: 50,
    example: 1.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  maxInventoryDays?: number;

  @ApiPropertyOptional({
    description: 'Margin validation threshold',
    minimum: 0,
    maximum: 1000,
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  marginValidateThreshold?: number;

  @ApiPropertyOptional({
    description: 'Minimum total profit in ISK',
    minimum: 0,
    example: 1000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minTotalProfitISK?: number;

  @ApiPropertyOptional({
    description:
      'Minimum margin percentage after fees (e.g., 10 means 10% profit margin)',
    minimum: 0,
    maximum: 1000,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  minMarginPercent?: number;

  @ApiPropertyOptional({
    description:
      'Maximum price deviation multiple from historical average (e.g., 3 means reject if current price > 3x average). If omitted, price deviation filtering is disabled.',
    minimum: 1,
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxPriceDeviationMultiple?: number;

  @ApiPropertyOptional({
    description: 'Station concurrency limit',
    minimum: 1,
    maximum: 32,
    example: 8,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32)
  stationConcurrency?: number;

  @ApiPropertyOptional({
    description: 'Item concurrency limit',
    minimum: 1,
    maximum: 200,
    example: 50,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  itemConcurrency?: number;

  @ApiPropertyOptional({
    description: 'Sales tax percentage',
    minimum: 0,
    maximum: 100,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  salesTaxPercent?: number;

  @ApiPropertyOptional({
    description: 'Broker fee percentage',
    minimum: 0,
    maximum: 100,
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  brokerFeePercent?: number;

  @ApiPropertyOptional({
    description: 'ESI maximum concurrency',
    minimum: 1,
    maximum: 400,
    example: 100,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(400)
  esiMaxConcurrency?: number;

  @ApiPropertyOptional({
    description: 'Liquidity window in days',
    minimum: 1,
    example: 30,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  liquidityWindowDays?: number;

  @ApiPropertyOptional({
    description:
      'Minimum coverage ratio for liquidity (0..1) - fraction of days in window that must have trades',
    minimum: 0,
    maximum: 1,
    example: 0.7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  liquidityMinCoverageRatio?: number;

  @ApiPropertyOptional({
    description: 'Minimum average daily ISK value traded for liquidity',
    minimum: 0,
    example: 5000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  liquidityMinLiquidityThresholdISK?: number;

  @ApiPropertyOptional({
    description:
      'Minimum average number of trades per day over the window for liquidity',
    minimum: 0,
    example: 10,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  liquidityMinWindowTrades?: number;

  @ApiPropertyOptional({
    description:
      'Limit arbitrage opportunities to specific destination station IDs (if provided)',
    type: [Number],
    example: [60003760, 60008494],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  destinationStationIds?: number[];

  @ApiPropertyOptional({
    description:
      'Exclude specific destination station IDs from arbitrage opportunities',
    type: [Number],
    example: [60011866],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  excludeDestinationStationIds?: number[];

  @ApiPropertyOptional({
    description:
      'Disable inventory limit checks entirely (useful for market analysis without current cycle constraints)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  disableInventoryLimit?: boolean;

  @ApiPropertyOptional({
    description:
      'Allow topping off existing inventory up to maxInventoryDays limit instead of skipping items with remaining stock',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allowInventoryTopOff?: boolean;
}
