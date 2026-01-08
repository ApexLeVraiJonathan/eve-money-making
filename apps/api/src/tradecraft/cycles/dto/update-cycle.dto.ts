import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class UpdateCycleRequest {
  @ApiPropertyOptional({
    description: 'Cycle name',
    minLength: 1,
    example: 'Q1 2026 Cycle',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Cycle start date (only editable while cycle is PLANNED; ISO string)',
    example: '2026-01-15T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startedAt?: string | Date;

  @ApiPropertyOptional({
    description:
      'Initial injection amount in ISK (format: XXXXX.XX). Only editable while cycle is PLANNED.',
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
