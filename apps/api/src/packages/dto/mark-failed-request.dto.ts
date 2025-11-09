import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';

export class MarkFailedRequest {
  @ApiProperty({
    description: 'Collateral recovered in ISK',
    example: '1000000.50',
    pattern: '^\\d+(\\.\\d{1,2})?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'collateralRecoveredIsk must be a valid number with up to 2 decimal places',
  })
  collateralRecoveredIsk: string;

  @ApiPropertyOptional({
    description: 'Collateral profit in ISK',
    example: '50000.00',
    pattern: '^\\d+(\\.\\d{1,2})?$',
    default: '0',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'collateralProfitIsk must be a valid number with up to 2 decimal places',
  })
  collateralProfitIsk?: string = '0';

  @ApiPropertyOptional({
    description: 'Optional memo about the failure',
    maxLength: 500,
    example: 'Package lost in transit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;
}

