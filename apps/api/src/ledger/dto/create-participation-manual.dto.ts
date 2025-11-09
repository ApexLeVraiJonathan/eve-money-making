import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, Matches } from 'class-validator';

export class CreateParticipationManualRequest {
  @ApiPropertyOptional({
    description: 'Character name',
    minLength: 1,
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  characterName?: string;

  @ApiProperty({
    description: 'Amount in ISK (format: XXXXX.XX)',
    example: '5000000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'amountIsk must be in format XXXXX.XX',
  })
  amountIsk: string;
}
