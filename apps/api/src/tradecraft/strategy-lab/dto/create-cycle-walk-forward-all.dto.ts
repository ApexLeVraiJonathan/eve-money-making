import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Cycle-walk-forward (MVP):
 * - Simulate N consecutive "cycles" of fixed length (default 14 days).
 * - Within a cycle: daily sells + conditional reprices + periodic "rebuys" when cash% recovers.
 * - Profit is computed on capital-at-cost (cash + inventory cost basis), matching rollover-at-cost.
 */
export class CreateTradeStrategyCycleWalkForwardAllDto {
  @ApiProperty({
    description: 'Start date for cycle 1 (YYYY-MM-DD).',
    example: '2025-11-24',
  })
  @IsString()
  @MaxLength(10)
  startDate!: string;

  @ApiProperty({
    description: 'Number of cycles to simulate.',
    example: 6,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  cycles!: number;

  @ApiPropertyOptional({
    description: 'Days per cycle. Default: 14.',
    example: 14,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  cycleDays?: number;

  @ApiProperty({
    description:
      'Initial capital available for cycle 1 in ISK. (Inventory carryover is modeled inside the simulation.)',
    example: 100000000000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCapitalIsk!: number;

  @ApiPropertyOptional({
    description:
      'Rebuy trigger: when cash / (cash + inventoryCost) >= this threshold, plan a new buy. Default 0.25.',
    example: 0.25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  rebuyTriggerCashPct?: number;

  @ApiPropertyOptional({
    description:
      'Reserve cash after each buy: keep this fraction of total capital as cash. Default 0.02.',
    example: 0.02,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(0.5)
  reserveCashPct?: number;

  @ApiPropertyOptional({
    description:
      'Single-buy mode: run the planner once at cycle start, then only sell/reprice until positions are sold or red. Disables rebuys.',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  singleBuy?: boolean;

  @ApiPropertyOptional({
    description:
      'Reprices per day (approximated from daily data): if an order is updated today, we apply relist fees multiplied by this number. Default 3.',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  repricesPerDay?: number;

  @ApiPropertyOptional({
    description:
      'Loss threshold for skipping reprices (red). If estimated margin after repricing is <= this value, we do NOT update. Default -10.',
    example: -10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(0)
  skipRepriceIfMarginPctLeq?: number;

  @ApiPropertyOptional({
    description:
      'Only run strategies whose names match this case-insensitive substring (optional).',
    example: 'SL-01',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameContains?: string;

  @ApiProperty({
    enum: ['VOLUME_SHARE'],
    example: 'VOLUME_SHARE',
    description:
      'Sell model for MVP cycle simulation. (CALIBRATED_CAPTURE is intentionally excluded here until we can calibrate reliably.)',
  })
  @IsEnum(['VOLUME_SHARE'])
  sellModel!: 'VOLUME_SHARE';

  @ApiProperty({
    description:
      'When sellModel=VOLUME_SHARE: percent of daily volume we can sell (0..1).',
    example: 0.1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  sellSharePct!: number;

  @ApiPropertyOptional({
    enum: ['LOW', 'AVG', 'HIGH'],
    description: 'Daily price proxy to use from MarketOrderTradeDaily.',
    example: 'LOW',
  })
  @IsOptional()
  @IsEnum(['LOW', 'AVG', 'HIGH'])
  priceModel?: 'LOW' | 'AVG' | 'HIGH';

  @ApiPropertyOptional({
    enum: ['IGNORE', 'SKIP_EXISTING', 'TOP_OFF'],
    description:
      'How the simulator treats existing inventory when planning rebuys. IGNORE matches current Strategy Lab behavior; SKIP_EXISTING matches prod default; TOP_OFF matches prod allowInventoryTopOff.',
    example: 'SKIP_EXISTING',
  })
  @IsOptional()
  @IsEnum(['IGNORE', 'SKIP_EXISTING', 'TOP_OFF'])
  inventoryMode?: 'IGNORE' | 'SKIP_EXISTING' | 'TOP_OFF';
}
