import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class CreateTradeStrategyLabSweepDto {
  @ApiProperty({
    example: '2025-11-24',
    description: 'Start date (YYYY-MM-DD)',
  })
  @IsString()
  @MaxLength(10)
  startDate!: string;

  @ApiProperty({ example: '2026-01-11', description: 'End date (YYYY-MM-DD)' })
  @IsString()
  @MaxLength(10)
  endDate!: string;

  @ApiProperty({ example: 50000000000, description: 'Initial capital in ISK' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCapitalIsk!: number;

  @ApiProperty({ example: 14, description: 'Train window (days)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  trainWindowDays!: number;

  @ApiProperty({ example: 14, description: 'Test window (days)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  testWindowDays!: number;

  @ApiPropertyOptional({
    example: 7,
    description: 'Step size between runs (days)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stepDays?: number;

  @ApiPropertyOptional({
    example: 6,
    description: 'Max runs per scenario per strategy',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRuns?: number;

  @ApiPropertyOptional({
    description: 'Only include strategies whose name contains this substring',
    example: 'SL-',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameContains?: string;

  @ApiProperty({
    enum: ['VOLUME_SHARE', 'CALIBRATED_CAPTURE'],
    example: 'VOLUME_SHARE',
  })
  @IsEnum(['VOLUME_SHARE', 'CALIBRATED_CAPTURE'])
  sellModel!: 'VOLUME_SHARE' | 'CALIBRATED_CAPTURE';

  @ApiProperty({
    description: 'Sell share scenarios (0..1)',
    example: [0.1, 0.2],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsNumber({}, { each: true })
  sellSharePcts!: number[];

  @ApiProperty({
    description: 'Price model scenarios',
    example: ['LOW', 'AVG', 'HIGH'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(['LOW', 'AVG', 'HIGH'], { each: true })
  priceModels!: Array<'LOW' | 'AVG' | 'HIGH'>;
}
