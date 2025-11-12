import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class OpenCycleRequest {
  @ApiPropertyOptional({
    description: 'Actual start date (if different from planned)',
    example: '2025-01-15T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startedAt?: string | Date;
}
