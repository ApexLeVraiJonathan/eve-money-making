import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

/**
 * Request DTO for manually adding a collateral recovery fee event.
 *
 * Note: amountIsk should be provided as a positive value (e.g. "350000000.00").
 * The service will store it as a negative amount so that it is treated as
 * income in profit calculations (matching markPackageFailed behaviour).
 */
export class AddCollateralRecoveryFeeRequest {
  @ApiProperty({
    description: 'Collateral recovery profit amount in ISK (format: XXXXX.XX)',
    example: '350000000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'amountIsk must be in format XXXXX.XX',
  })
  amountIsk: string;

  @ApiPropertyOptional({
    description: 'Optional memo describing the recovery',
    minLength: 1,
    example: 'Manual collateral recovery for failed package',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  memo?: string;
}


