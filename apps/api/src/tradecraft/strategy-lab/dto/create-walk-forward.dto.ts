import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTradeStrategyWalkForwardDto {
  @ApiProperty({ description: 'Strategy ID', example: 'uuid' })
  @IsString()
  @MaxLength(100)
  strategyId!: string;

  @ApiProperty({
    description:
      'First test start date (YYYY-MM-DD). Planning uses days ending at start-1.',
    example: '2025-12-29',
  })
  @IsString()
  @MaxLength(10)
  startDate!: string;

  @ApiProperty({
    description: 'Last test end date (YYYY-MM-DD)',
    example: '2026-03-31',
  })
  @IsString()
  @MaxLength(10)
  endDate!: string;

  @ApiProperty({
    description: 'Initial capital in ISK (number, stored as Decimal)',
    example: 50000000000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCapitalIsk!: number;

  @ApiProperty({
    description: 'Training window length (days) used for liquidity checks',
    example: 14,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  trainWindowDays!: number;

  @ApiProperty({
    description: 'Test window length (days) simulated forward',
    example: 14,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  testWindowDays!: number;

  @ApiPropertyOptional({
    description:
      'Step size between consecutive runs (days). Defaults to testWindowDays (non-overlapping).',
    example: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stepDays?: number;

  @ApiPropertyOptional({
    description: 'Max number of runs to execute (safety). Default 12.',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRuns?: number;

  @ApiProperty({
    enum: ['VOLUME_SHARE', 'CALIBRATED_CAPTURE'],
    example: 'VOLUME_SHARE',
  })
  @IsEnum(['VOLUME_SHARE', 'CALIBRATED_CAPTURE'])
  sellModel!: 'VOLUME_SHARE' | 'CALIBRATED_CAPTURE';

  @ApiPropertyOptional({
    description:
      'When sellModel=VOLUME_SHARE: percent of daily volume we can sell (0..1)',
    example: 0.05,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellSharePct?: number;

  @ApiPropertyOptional({
    enum: ['LOW', 'AVG', 'HIGH'],
    description: 'Daily price proxy to use from MarketOrderTradeDaily',
    example: 'LOW',
  })
  @IsOptional()
  @IsEnum(['LOW', 'AVG', 'HIGH'])
  priceModel?: 'LOW' | 'AVG' | 'HIGH';
}
