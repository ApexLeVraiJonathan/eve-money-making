import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min, Max } from 'class-validator';
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
    description: 'Arbitrage multiplier for profit calculation',
    minimum: 1,
    maximum: 50,
    example: 1.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  arbitrageMultiplier?: number;

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
    maximum: 90,
    example: 30,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  liquidityWindowDays?: number;
}
