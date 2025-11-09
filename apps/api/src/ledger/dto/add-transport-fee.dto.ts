import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Matches, MinLength } from 'class-validator';

export class AddTransportFeeRequest {
  @ApiProperty({
    description: 'Transport fee amount in ISK (format: XXXXX.XX)',
    example: '100000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'amountIsk must be in format XXXXX.XX',
  })
  amountIsk: string;

  @ApiPropertyOptional({
    description: 'Optional memo',
    minLength: 1,
    example: 'Jita to Amarr transport',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  memo?: string;
}

