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

const toInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const toBool = (v: unknown): boolean | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
};

export class SelfMarketStatusQueryDto {
  @ApiPropertyOptional({
    description: 'Structure ID (defaults to MARKET_SELF_GATHER_STRUCTURE_ID)',
    example: '1045667241057',
  })
  @IsOptional()
  @IsString()
  structureId?: string;
}

export class SelfMarketSnapshotLatestQueryDto {
  @ApiPropertyOptional({
    description: 'Structure ID (defaults to MARKET_SELF_GATHER_STRUCTURE_ID)',
    example: '1045667241057',
  })
  @IsOptional()
  @IsString()
  structureId?: string;

  @ApiPropertyOptional({
    description: 'Max number of orders to return (post-filter)',
    minimum: 1,
    maximum: 5000,
    default: 200,
  })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by side',
    enum: ['ALL', 'BUY', 'SELL'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn(['ALL', 'BUY', 'SELL'])
  side?: 'ALL' | 'BUY' | 'SELL';

  @ApiPropertyOptional({
    description: 'Filter by typeId',
    example: 626,
  })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  typeId?: number;
}

export class SelfMarketSnapshotTypeSummaryQueryDto {
  @ApiPropertyOptional({
    description: 'Structure ID (defaults to MARKET_SELF_GATHER_STRUCTURE_ID)',
    example: '1045667241057',
  })
  @IsOptional()
  @IsString()
  structureId?: string;

  @ApiPropertyOptional({
    description: 'Max number of types (groups) to return',
    minimum: 1,
    maximum: 5000,
    default: 200,
  })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(5000)
  limitTypes?: number;

  @ApiPropertyOptional({
    description: 'Filter by side',
    enum: ['ALL', 'BUY', 'SELL'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn(['ALL', 'BUY', 'SELL'])
  side?: 'ALL' | 'BUY' | 'SELL';
}

export class SelfMarketDailyAggregatesQueryDto {
  @ApiPropertyOptional({
    description: 'Structure ID (defaults to MARKET_SELF_GATHER_STRUCTURE_ID)',
    example: '1045667241057',
  })
  @IsOptional()
  @IsString()
  structureId?: string;

  @ApiPropertyOptional({
    description: 'UTC date (YYYY-MM-DD) to read aggregates for',
    example: '2026-01-19',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description:
      'hasGone=false => lower-bound (deltas only). hasGone=true => upper-bound (includes eligible disappearances).',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  hasGone?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by side',
    enum: ['ALL', 'BUY', 'SELL'],
    default: 'SELL',
  })
  @IsOptional()
  @IsIn(['ALL', 'BUY', 'SELL'])
  side?: 'ALL' | 'BUY' | 'SELL';

  @ApiPropertyOptional({
    description: 'Filter by typeId',
    example: 626,
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
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
