import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  Matches,
  IsEnum,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RolloverOptionsDto {
  @ApiProperty({
    description: 'Rollover type',
    enum: ['FULL_PAYOUT', 'INITIAL_ONLY', 'CUSTOM_AMOUNT'],
    example: 'FULL_PAYOUT',
  })
  @IsEnum(['FULL_PAYOUT', 'INITIAL_ONLY', 'CUSTOM_AMOUNT'])
  type: 'FULL_PAYOUT' | 'INITIAL_ONLY' | 'CUSTOM_AMOUNT';

  @ApiPropertyOptional({
    description:
      'Custom amount in ISK (format: XXXXX.XX) - required for CUSTOM_AMOUNT type',
    example: '8000000000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'customAmountIsk must be in format XXXXX.XX',
  })
  customAmountIsk?: string;
}

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

  @ApiPropertyOptional({
    description:
      'Test user ID (DEV ONLY - used to create multiple participations in testing)',
    example: 'test-user-alpha',
  })
  @IsOptional()
  @IsString()
  testUserId?: string;

  @ApiPropertyOptional({
    description:
      'Rollover options for automatic reinvestment from current OPEN cycle',
    type: RolloverOptionsDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RolloverOptionsDto)
  rollover?: RolloverOptionsDto;
}
