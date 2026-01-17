import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClearTradeStrategyRunsDto {
  @ApiPropertyOptional({
    description:
      'Optional case-insensitive substring filter on strategy name. If omitted, clears runs for all strategies.',
    example: 'SL-01',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameContains?: string;
}
