import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTradeStrategyRunDto {
  @ApiProperty({ description: 'Strategy ID', example: 'uuid' })
  @IsString()
  @MaxLength(100)
  strategyId!: string;

  @ApiProperty({
    description: 'Start date (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsString()
  @MaxLength(10)
  startDate!: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)', example: '2026-01-30' })
  @IsString()
  @MaxLength(10)
  endDate!: string;

  @ApiProperty({
    description: 'Initial capital in ISK (number, stored as Decimal)',
    example: 40000000000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCapitalIsk!: number;

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
