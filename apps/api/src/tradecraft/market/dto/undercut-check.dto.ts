import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsArray,
  IsUUID,
  IsOptional,
  Min,
  IsIn,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UndercutCheckRequest {
  @ApiPropertyOptional({
    description:
      'Character IDs to check (if not provided, uses all linked characters)',
    example: [123456789, 987654321],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  characterIds?: number[];

  @ApiPropertyOptional({
    description:
      'Station IDs to check (if not provided, uses tracked stations)',
    example: [60003760, 60008494],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  stationIds?: number[];

  @ApiPropertyOptional({
    description: 'Optional cycle filter',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @ApiPropertyOptional({
    description:
      'Grouping mode for orders: perOrder (all orders), perCharacter (one primary order per character/item/station), global (one order per item/station across all characters)',
    example: 'perCharacter',
    enum: ['perOrder', 'perCharacter', 'global'],
  })
  @IsOptional()
  @IsIn(['perOrder', 'perCharacter', 'global'])
  groupingMode?: 'perOrder' | 'perCharacter' | 'global';

  @ApiPropertyOptional({
    description:
      'Minimum competitor volume ratio (relative to order volume_total) to trigger a reprice. Default: 0.15 (15%)',
    example: 0.15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minUndercutVolumeRatio?: number;

  @ApiPropertyOptional({
    description:
      'Minimum absolute competitor volume to trigger a reprice. Default: 1',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minUndercutUnits?: number;

  @ApiPropertyOptional({
    description:
      'If > 0, orders whose expiry is within this many days will be included for a low-impact "refresh" reprice even if not currently undercut. Default: 2',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expiryRefreshDays?: number;
}
