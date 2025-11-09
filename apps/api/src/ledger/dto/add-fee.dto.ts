import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class AddFeeRequest {
  @ApiProperty({
    description: 'Fee amount in ISK (format: XXXXX.XX)',
    example: '50000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'amountIsk must be in format XXXXX.XX',
  })
  amountIsk: string;
}

