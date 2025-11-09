import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BatchSizeDto {
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
