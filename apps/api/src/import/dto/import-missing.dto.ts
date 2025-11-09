import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportMissingDto {
  @ApiPropertyOptional({
    description: 'Number of days to look back for missing data',
    minimum: 1,
    maximum: 365,
    example: 7,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  daysBack?: number;

  @ApiPropertyOptional({
    description: 'Batch size for import operations',
    minimum: 1,
    maximum: 50000,
    example: 1000,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50000)
  batchSize?: number;
}

