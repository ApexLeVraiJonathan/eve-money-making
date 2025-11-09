import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsInt,
  IsEnum,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Destination capacity constraints
 */
export class DestinationCap {
  @ApiPropertyOptional({
    description: 'Maximum share of budget for this destination',
    minimum: 0,
    maximum: 1,
    example: 0.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  maxShare?: number;

  @ApiPropertyOptional({
    description: 'Maximum ISK for this destination',
    minimum: 0,
    example: 1000000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxISK?: number;
}

/**
 * Allocation strategy configuration
 */
export class AllocationConfig {
  @ApiPropertyOptional({
    description: 'Allocation mode',
    enum: ['best', 'targetWeighted', 'roundRobin'],
    example: 'best',
  })
  @IsOptional()
  @IsEnum(['best', 'targetWeighted', 'roundRobin'])
  mode?: 'best' | 'targetWeighted' | 'roundRobin';

  @ApiPropertyOptional({
    description:
      'Target allocation weights by destination (station ID -> weight)',
    example: { '60003760': 0.6, '60008494': 0.4 },
  })
  @IsOptional()
  @IsObject()
  targets?: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Spread bias for allocation',
    minimum: 0,
    maximum: 1,
    example: 0.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  spreadBias?: number;
}

/**
 * Request DTO for POST /arbitrage/plan-packages
 *
 * Learning note:
 * - We validate object shapes and numeric ranges to keep planner safe
 * - Keys in shippingCostByStation are strings (station IDs)
 */
export class PlanPackagesRequest {
  @ApiProperty({
    description: 'Shipping cost by station ID (station ID -> cost in ISK)',
    example: { '60003760': 50000000, '60008494': 75000000 },
  })
  @IsObject()
  shippingCostByStation: Record<string, number>;

  @ApiProperty({
    description: 'Package capacity in cubic meters',
    minimum: 0,
    example: 350000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  packageCapacityM3: number;

  @ApiProperty({
    description: 'Total investment in ISK',
    minimum: 0,
    example: 10000000000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  investmentISK: number;

  @ApiPropertyOptional({
    description: 'Maximum budget share per item per destination',
    minimum: 0,
    maximum: 1,
    example: 0.25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  perDestinationMaxBudgetSharePerItem?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of packages hint',
    minimum: 1,
    maximum: 200,
    example: 10,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maxPackagesHint?: number;

  @ApiPropertyOptional({
    description: 'Maximum package collateral in ISK',
    minimum: 0,
    example: 2000000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  maxPackageCollateralISK?: number;

  @ApiPropertyOptional({
    description: 'Destination capacity constraints by station ID',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DestinationCap)
  destinationCaps?: Record<string, DestinationCap>;

  @ApiPropertyOptional({
    description: 'Allocation strategy configuration',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AllocationConfig)
  allocation?: AllocationConfig;

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
