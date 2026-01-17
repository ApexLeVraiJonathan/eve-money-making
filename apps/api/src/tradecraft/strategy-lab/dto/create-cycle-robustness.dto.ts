import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type as TransformType } from 'class-transformer';

class StrategyLabBlacklistDto {
  @ApiPropertyOptional({
    description: 'Global blacklist of typeIds (applies to all destinations).',
    example: [123, 456],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  globalTypeIds?: number[];

  @ApiPropertyOptional({
    description:
      'Per-destination blacklist: map of destinationStationId -> array of typeIds.',
    example: { '60008494': [34, 56] },
  })
  @IsOptional()
  byDestinationTypeIds?: Record<string, number[]>;
}

/**
 * Robustness report:
 * Run single-buy simulations across many start dates and aggregate tail-risk metrics.
 *
 * Goal: pick strategies that avoid bad periods (p10, lossRate), not just the best single start.
 */
export class CreateTradeStrategyCycleRobustnessDto {
  @ApiProperty({
    description: 'Inclusive start-date range begin (YYYY-MM-DD).',
    example: '2025-10-01',
  })
  @IsString()
  @MaxLength(10)
  startDateFrom!: string;

  @ApiProperty({
    description: 'Inclusive start-date range end (YYYY-MM-DD).',
    example: '2025-12-31',
  })
  @IsString()
  @MaxLength(10)
  startDateTo!: string;

  @ApiPropertyOptional({
    description: 'Stride between start dates in days. Default: 2.',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  stepDays?: number;

  @ApiPropertyOptional({
    description:
      'Max days to simulate per start date. (Cycle ends early when positions are sold or red.) Default: 21.',
    example: 21,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(60)
  maxDays?: number;

  @ApiProperty({
    description: 'Initial capital (same for every strategy and start date).',
    example: 50_000_000_000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCapitalIsk!: number;

  @ApiProperty({
    description: 'Daily volume share capture (0..1).',
    example: 0.2,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  sellSharePct!: number;

  @ApiPropertyOptional({
    description:
      'Reprices/day (fee multiplier) used when market price drops vs our listed price. Default: 1.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  repricesPerDay?: number;

  @ApiPropertyOptional({
    description:
      'Loss threshold for marking a position red (stop updating/selling). Default -10.',
    example: -10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(0)
  skipRepriceIfMarginPctLeq?: number;

  @ApiPropertyOptional({
    enum: ['LOW', 'AVG', 'HIGH'],
    description:
      'Daily price proxy to use from MarketOrderTradeDaily. Default: AVG.',
    example: 'AVG',
  })
  @IsOptional()
  @IsEnum(['LOW', 'AVG', 'HIGH'])
  priceModel?: 'LOW' | 'AVG' | 'HIGH';

  @ApiPropertyOptional({
    enum: ['SKIP_EXISTING', 'TOP_OFF', 'IGNORE'],
    description:
      'Inventory behavior for planning. Default: SKIP_EXISTING (prod default).',
    example: 'SKIP_EXISTING',
  })
  @IsOptional()
  @IsEnum(['IGNORE', 'SKIP_EXISTING', 'TOP_OFF'])
  inventoryMode?: 'IGNORE' | 'SKIP_EXISTING' | 'TOP_OFF';

  @ApiPropertyOptional({
    description:
      'Only include strategies whose name contains this substring (case-insensitive).',
    example: 'SL-START',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameContains?: string;

  @ApiPropertyOptional({
    description:
      'Optional blacklist to apply (Strategy Lab only). When provided, the report will run both with and without it.',
  })
  @IsOptional()
  @ValidateNested()
  @TransformType(() => StrategyLabBlacklistDto)
  blacklist?: StrategyLabBlacklistDto;
}
