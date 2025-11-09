import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsString, IsOptional, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class MatchParticipationRequest {
  @ApiProperty({
    description: 'Whether this is from wallet journal (true) or transaction (false)',
    example: true,
  })
  @Type(() => Boolean)
  @IsBoolean()
  walletJournal: boolean;

  @ApiProperty({
    description: 'ESI reference ID',
    example: '12345678',
  })
  @IsString()
  refId: string;

  @ApiPropertyOptional({
    description: 'Amount in ISK (format: XXXXX.XX)',
    example: '5000000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'amountIsk must be in format XXXXX.XX',
  })
  amountIsk?: string;
}

