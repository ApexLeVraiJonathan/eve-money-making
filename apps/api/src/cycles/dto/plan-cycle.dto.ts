import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  Matches,
  IsDateString,
} from 'class-validator';

export class PlanCycleRequest {
  @ApiPropertyOptional({
    description: 'Cycle name',
    minLength: 1,
    example: 'Q1 2025 Cycle',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiProperty({
    description: 'Planned start date (should be future)',
    example: '2025-01-15T00:00:00Z',
  })
  @IsDateString()
  startedAt!: string | Date;

  @ApiPropertyOptional({
    description: 'Initial injection amount in ISK (format: XXXXX.XX)',
    example: '10000000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'initialInjectionIsk must be in format XXXXX.XX',
  })
  initialInjectionIsk?: string;
}
