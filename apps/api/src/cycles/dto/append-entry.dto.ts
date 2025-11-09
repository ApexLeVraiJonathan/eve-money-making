import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  Matches,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';

enum EntryType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  FEE = 'fee',
  EXECUTION = 'execution',
}

export class AppendEntryRequest {
  @ApiProperty({
    description: 'Cycle ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  cycleId!: string;

  @ApiProperty({
    description: 'Entry type',
    enum: EntryType,
    example: 'deposit',
  })
  @IsEnum(EntryType)
  entryType!: EntryType;

  @ApiProperty({
    description: 'Amount in ISK (format: XXXXX.XX)',
    example: '5000000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'amountIsk must be in format XXXXX.XX',
  })
  amountIsk!: string;

  @ApiPropertyOptional({
    description: 'When the entry occurred',
    example: '2024-01-15T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value ? new Date(value) : value))
  occurredAt?: Date;

  @ApiPropertyOptional({
    description: 'Optional memo',
    example: 'Initial capital injection',
  })
  @IsOptional()
  @IsString()
  memo?: string;

  @ApiPropertyOptional({
    description: 'Optional plan commit ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  planCommitId?: string;
}
