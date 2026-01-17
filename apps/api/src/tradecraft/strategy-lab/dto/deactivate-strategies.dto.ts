import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateTradeStrategiesDto {
  @ApiPropertyOptional({
    description:
      'Optional case-insensitive substring filter on strategy name. If omitted, deactivates all strategies.',
    example: 'SL-',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameContains?: string;
}
