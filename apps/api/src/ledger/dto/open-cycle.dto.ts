import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class OpenCycleRequest {
  @ApiPropertyOptional({
    description: 'Actual start date (if different from planned)',
    example: '2025-01-15T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value ? new Date(value) : value))
  startedAt?: Date;
}
