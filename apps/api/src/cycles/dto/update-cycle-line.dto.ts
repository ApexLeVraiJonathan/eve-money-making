import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCycleLineRequest {
  @ApiPropertyOptional({
    description: 'Updated planned units',
    minimum: 1,
    example: 1500,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  plannedUnits?: number;
}
