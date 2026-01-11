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
  IsBoolean,
  IsArray,
  IsString,
  MaxLength,
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
 * Liquidity options for plan-packages orchestration
 */
export class LiquidityOptions {
  @ApiPropertyOptional({
    description: 'Time window in days for liquidity calculation',
    minimum: 1,
    example: 30,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  windowDays?: number;

  @ApiPropertyOptional({
    description: 'Minimum coverage ratio for liquidity (0..1)',
    minimum: 0,
    maximum: 1,
    example: 0.7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minCoverageRatio?: number;

  @ApiPropertyOptional({
    description: 'Minimum average daily ISK value traded',
    minimum: 0,
    example: 5000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minLiquidityThresholdISK?: number;

  @ApiPropertyOptional({
    description: 'Minimum average trades per day',
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

/**
 * Arbitrage options for plan-packages orchestration
 */
export class ArbitrageOptions {
  @ApiPropertyOptional({
    description: 'Maximum days of average daily volume to hold as inventory',
    minimum: 0.1,
    maximum: 50,
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  maxInventoryDays?: number;

  @ApiPropertyOptional({
    description: 'Minimum margin percentage after fees',
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
    description: 'Maximum price deviation multiple from historical average',
    minimum: 1,
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxPriceDeviationMultiple?: number;

  @ApiPropertyOptional({
    description: 'Limit to specific destination station IDs',
    type: [Number],
    example: [60003760, 60008494],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  destinationStationIds?: number[];

  @ApiPropertyOptional({
    description: 'Exclude specific destination station IDs',
    type: [Number],
    example: [60011866],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  excludeDestinationStationIds?: number[];

  @ApiPropertyOptional({
    description: 'Disable inventory limit checks',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  disableInventoryLimit?: boolean;

  @ApiPropertyOptional({
    description: 'Allow topping off existing inventory',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allowInventoryTopOff?: boolean;

  @ApiPropertyOptional({
    description: 'Sales tax percentage',
    minimum: 0,
    maximum: 100,
    example: 3.37,
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
    example: 1.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  brokerFeePercent?: number;

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
}

export class CourierContractPresetDto {
  @ApiProperty({
    description: "Stable identifier (e.g., 'blockade', 'dst', 'custom')",
    example: 'blockade',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  id!: string;

  @ApiProperty({
    description: 'Human label for UI/debug',
    example: 'Blockade Runner',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiProperty({
    description: 'Maximum package volume for this courier contract',
    minimum: 0.001,
    example: 13000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  maxVolumeM3!: number;

  @ApiProperty({
    description: 'Maximum package collateral/value for this courier contract',
    minimum: 0,
    example: 4000000000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxCollateralISK!: number;
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
    description:
      'Optional courier contract presets (enables mixing contract types like Blockade + DST in a single run)',
    type: [CourierContractPresetDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourierContractPresetDto)
  courierContracts?: CourierContractPresetDto[];

  @ApiPropertyOptional({
    description:
      'Minimum net profit per package in ISK (rejects packages below this threshold)',
    minimum: 0,
    example: 5000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPackageNetProfitISK?: number;

  @ApiPropertyOptional({
    description:
      'Minimum ROI percentage per package (netProfit/spend * 100, rejects packages below this threshold)',
    minimum: 0,
    maximum: 1000,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  minPackageROIPercent?: number;

  @ApiPropertyOptional({
    description:
      'Shipping margin multiplier: require boxProfit >= shippingCost * k (default 1.0 = break-even; e.g., 1.5 = require 50% more gross profit than shipping)',
    minimum: 1,
    maximum: 10,
    example: 1.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  shippingMarginMultiplier?: number;

  @ApiPropertyOptional({
    description:
      'Item prioritization: density weight (0.0 = pure ROI/capital-limited, 1.0 = pure density/space-limited, 0.5 = equal blend)',
    minimum: 0,
    maximum: 1,
    example: 1.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  densityWeight?: number;

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
    description:
      'Liquidity options for controlling the liquidity analysis phase',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LiquidityOptions)
  liquidityOptions?: LiquidityOptions;

  @ApiPropertyOptional({
    description: 'Arbitrage options for controlling the arbitrage check phase',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ArbitrageOptions)
  arbitrageOptions?: ArbitrageOptions;
}
