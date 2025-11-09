import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class WalletQueryDto {
  @ApiPropertyOptional({
    description: 'Character ID to filter by',
    example: 123456789,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  characterId?: number;

  @ApiPropertyOptional({
    description: 'Number of days to look back',
    minimum: 1,
    maximum: 90,
    example: 14,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  sinceDays?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    minimum: 1,
    maximum: 1000,
    example: 100,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    minimum: 0,
    example: 0,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

