import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LiquidityItemStatsRequest {
  @ApiPropertyOptional({
    description: 'Item type ID',
    example: 34,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId?: number;

  @ApiPropertyOptional({
    description: 'Item name (alternative to itemId)',
    example: 'Tritanium',
    minLength: 1,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  itemName?: string;

  @ApiPropertyOptional({
    description: 'Station ID',
    example: 60003760,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stationId?: number;

  @ApiPropertyOptional({
    description: 'Station name (alternative to stationId)',
    example: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
    minLength: 1,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  stationName?: string;

  @ApiPropertyOptional({
    description: 'Whether to check buy orders (false for sell orders)',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBuyOrder?: boolean;

  @ApiPropertyOptional({
    description: 'Time window in days',
    minimum: 1,
    maximum: 30,
    example: 7,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  windowDays?: number;

  @ValidateIf((o) => !o.itemId && !o.itemName)
  @IsString({ message: 'Provide either itemId or itemName' })
  _requireItemIdentifier?: never;
}

