import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClearTradeStrategiesDto {
  @ApiPropertyOptional({
    description:
      'Optional case-insensitive substring filter on strategy name. If omitted, deletes all strategies.',
    example: 'SL-',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameContains?: string;
}
