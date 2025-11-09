import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportDayDto {
  @ApiProperty({
    description: 'Date in YYYY-MM-DD format',
    example: '2024-01-15',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

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

