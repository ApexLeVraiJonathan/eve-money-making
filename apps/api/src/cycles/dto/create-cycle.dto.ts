import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  Matches,
  IsDateString,
} from 'class-validator';

export class CreateCycleRequest {
  @ApiPropertyOptional({
    description: 'Cycle name',
    minLength: 1,
    example: 'Q4 2024 Cycle',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiProperty({
    description: 'Cycle start date',
    example: '2024-01-15T00:00:00Z',
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
