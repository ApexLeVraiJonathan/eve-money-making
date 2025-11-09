import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SuggestPayoutsRequest {
  @ApiPropertyOptional({
    description: 'Profit share percentage (0-1)',
    minimum: 0,
    maximum: 1,
    example: 0.15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  profitSharePct?: number;
}
