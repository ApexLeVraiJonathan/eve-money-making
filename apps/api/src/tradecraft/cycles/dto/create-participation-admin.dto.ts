import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

/**
 * Admin-only request to create a standard (non-rollover) participation
 * for a cycle that is already OPEN.
 *
 * The target user is identified by their primary (main) character ID.
 */
export class CreateParticipationAdminRequest {
  @ApiProperty({
    description: "User's primary (main) character ID",
    example: 123456789,
  })
  @IsNumber()
  @Min(1)
  primaryCharacterId!: number;

  @ApiProperty({
    description: 'Amount in ISK (format: XXXXX.XX)',
    example: '5000000000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'amountIsk must be in format XXXXX.XX',
  })
  amountIsk!: string;

  @ApiPropertyOptional({
    description:
      'If true, mark participation as confirmed (OPTED_IN) immediately. If false, create as awaiting payment.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  markPaid?: boolean;
}
