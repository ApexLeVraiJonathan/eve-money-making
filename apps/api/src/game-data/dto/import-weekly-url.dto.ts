import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportWeeklyUrlDto {
  @ApiProperty({
    description:
      'Adam4EVE weekly MarketOrdersTrades CSV URL (e.g. marketOrderTrades_weekly_2025-1.csv)',
    example:
      'https://static.adam4eve.eu/MarketOrdersTrades/2026/marketOrderTrades_weekly_2025-1.csv',
  })
  @IsString()
  url!: string;

  @ApiPropertyOptional({
    description: 'Batch size for insert operations',
    minimum: 1,
    maximum: 50000,
    example: 10000,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50000)
  batchSize?: number;
}
