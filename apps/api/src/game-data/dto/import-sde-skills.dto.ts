import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportSdeSkillsDto {
  @ApiPropertyOptional({
    description:
      'Base path to the EVE SDE JSONL folder (e.g. docs/eve-online-static-data-<build>-jsonl)',
    example: 'docs/eve-online-static-data-3113289-jsonl',
  })
  @IsOptional()
  @IsString()
  basePath?: string;

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
