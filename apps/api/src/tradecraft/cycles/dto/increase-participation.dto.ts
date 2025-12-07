import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class IncreaseParticipationRequest {
  @ApiProperty({
    description: 'Additional principal amount in ISK to add (format: XXXXX.XX)',
    example: '500000000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'deltaAmountIsk must be in format XXXXX.XX',
  })
  deltaAmountIsk: string;
}


