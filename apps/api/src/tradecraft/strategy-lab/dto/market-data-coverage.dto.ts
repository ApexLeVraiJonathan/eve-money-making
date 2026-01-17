import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class MarketDataCoverageQueryDto {
  @ApiProperty({
    description: 'Start date (YYYY-MM-DD).',
    example: '2025-11-24',
  })
  @IsString()
  @MaxLength(10)
  startDate!: string;

  @ApiProperty({
    description: 'Total days to cover starting at startDate.',
    example: 84,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days!: number;
}
