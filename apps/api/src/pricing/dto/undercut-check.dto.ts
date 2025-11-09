import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsArray, IsUUID, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UndercutCheckRequest {
  @ApiPropertyOptional({
    description: 'Character IDs to check (if not provided, uses all linked characters)',
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
    description: 'Station IDs to check (if not provided, uses tracked stations)',
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
}

