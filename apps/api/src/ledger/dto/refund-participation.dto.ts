import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class RefundParticipationRequest {
  @ApiProperty({
    description: 'Refund amount in ISK (format: XXXXX.XX)',
    example: '5000000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'amountIsk must be in format XXXXX.XX',
  })
  amountIsk: string;
}

