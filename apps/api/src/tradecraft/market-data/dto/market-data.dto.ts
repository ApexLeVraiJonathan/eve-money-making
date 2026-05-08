import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MarketDataHealthQueryDto {
  @ApiPropertyOptional({
    description: 'UTC start date (YYYY-MM-DD). Defaults to 13 days ago.',
    example: '2026-05-01',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'UTC end date (YYYY-MM-DD). Defaults to today.',
    example: '2026-05-08',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}

