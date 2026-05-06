import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const toInt = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const toClampedInt = (
  value: unknown,
  min: number,
  max: number,
): number | undefined => {
  const n = toInt(value);
  if (n === undefined) return undefined;
  return Math.min(Math.max(n, min), max);
};

const toBool = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const s = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
};

export class NpcMarketStationQueryDto {
  @ApiPropertyOptional({
    description: 'Station ID (defaults to MARKET_NPC_GATHER_STATION_ID)',
    example: '60004588',
  })
  @IsOptional()
  @IsString()
  stationId?: string;
}

export class NpcMarketCollectBodyDto {
  @ApiPropertyOptional({
    description: 'Bypass cache and refresh ESI data',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  forceRefresh?: boolean;
}

export class NpcMarketSnapshotTypesQueryDto extends NpcMarketStationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by order side',
    enum: ['ALL', 'BUY', 'SELL'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn(['ALL', 'BUY', 'SELL'])
  side?: 'ALL' | 'BUY' | 'SELL';

  @ApiPropertyOptional({
    description: 'Max number of type groups to return',
    minimum: 1,
    maximum: 5000,
    default: 200,
  })
  @IsOptional()
  @Transform(({ value }) => toClampedInt(value, 1, 5000))
  @IsInt()
  @Min(1)
  @Max(5000)
  limitTypes?: number;
}

export class NpcMarketSnapshotLatestQueryDto extends NpcMarketStationQueryDto {
  @ApiPropertyOptional({
    description: 'Required type ID to return orders for',
    example: 34,
  })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  typeId?: number;

  @ApiPropertyOptional({
    description: 'Filter by order side',
    enum: ['ALL', 'BUY', 'SELL'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn(['ALL', 'BUY', 'SELL'])
  side?: 'ALL' | 'BUY' | 'SELL';

  @ApiPropertyOptional({
    description: 'Max number of orders to return',
    minimum: 1,
    maximum: 50000,
    default: 500,
  })
  @IsOptional()
  @Transform(({ value }) => toClampedInt(value, 1, 50000))
  @IsInt()
  @Min(1)
  @Max(50000)
  limit?: number;
}

export class NpcMarketDailyAggregatesQueryDto extends NpcMarketStationQueryDto {
  @ApiPropertyOptional({
    description: 'UTC date (YYYY-MM-DD) to read aggregates for',
    example: '2026-01-19',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Whether to include disappeared orders (true/1)',
    default: false,
  })
  @IsOptional()
  @IsString()
  hasGone?: string;

  @ApiPropertyOptional({
    description: 'Filter by order side',
    enum: ['ALL', 'BUY', 'SELL'],
    default: 'SELL',
  })
  @IsOptional()
  @IsIn(['ALL', 'BUY', 'SELL'])
  side?: 'ALL' | 'BUY' | 'SELL';

  @ApiPropertyOptional({
    description: 'Filter by typeId',
    example: 34,
  })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  typeId?: number;

  @ApiPropertyOptional({
    description: 'Max rows to return',
    minimum: 1,
    maximum: 5000,
    default: 500,
  })
  @IsOptional()
  @Transform(({ value }) => toClampedInt(value, 1, 5000))
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}

export class NpcMarketCompareAdam4EveQueryDto extends NpcMarketStationQueryDto {
  @ApiPropertyOptional({
    description: 'UTC start date (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'UTC end date (YYYY-MM-DD)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by order side',
    enum: ['ALL', 'BUY', 'SELL'],
    default: 'SELL',
  })
  @IsOptional()
  @IsIn(['ALL', 'BUY', 'SELL'])
  side?: 'ALL' | 'BUY' | 'SELL';

  @ApiPropertyOptional({
    description: 'Max diff rows to return',
    minimum: 1,
    maximum: 2000,
    default: 250,
  })
  @IsOptional()
  @Transform(({ value }) => toClampedInt(value, 1, 2000))
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;
}
