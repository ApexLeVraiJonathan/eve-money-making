import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';

export class AutoRolloverSettingsResponseDto {
  @ApiProperty({ example: false })
  enabled!: boolean;

  @ApiProperty({
    enum: ['FULL_PAYOUT', 'INITIAL_ONLY'],
    example: 'INITIAL_ONLY',
  })
  defaultRolloverType!: 'FULL_PAYOUT' | 'INITIAL_ONLY';
}

export class UpdateAutoRolloverSettingsRequestDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    enum: ['FULL_PAYOUT', 'INITIAL_ONLY'],
    example: 'INITIAL_ONLY',
  })
  @IsEnum(['FULL_PAYOUT', 'INITIAL_ONLY'])
  defaultRolloverType!: 'FULL_PAYOUT' | 'INITIAL_ONLY';
}
