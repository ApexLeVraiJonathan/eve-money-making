import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SetPrimaryCharacterDto {
  @ApiProperty({ description: 'Character ID to set as primary' })
  @IsInt()
  @Min(1)
  characterId!: number;
}

export class CreateAccountDto {
  @ApiPropertyOptional({ description: 'User-facing label for the account' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @ApiPropertyOptional({ description: 'Optional notes about this account' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ description: 'User-facing label for the account' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @ApiPropertyOptional({ description: 'Optional notes about this account' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssignCharacterToAccountDto {
  @ApiProperty({ description: 'Character ID to assign to this account' })
  @IsInt()
  @Min(1)
  characterId!: number;
}

export class CreatePlexSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Start time of this PLEX/subscription period (ISO-8601)',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({
    description: 'Expiry time of this PLEX/subscription period (ISO-8601)',
  })
  @IsDateString()
  expiresAt!: string;

  @ApiPropertyOptional({
    description: 'Nominal renewal cycle in days (e.g. 30)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  renewalCycleDays?: number;

  @ApiPropertyOptional({
    description: 'Expected cost in ISK as a string (stored as decimal)',
  })
  @IsOptional()
  @IsString()
  expectedCostIsk?: string;

  @ApiPropertyOptional({ description: 'Free-form notes for this period' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePlexSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Updated start time (ISO-8601)',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({
    description: 'Updated expiry time (ISO-8601)',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({
    description: 'Updated renewal cycle in days',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  renewalCycleDays?: number | null;

  @ApiPropertyOptional({
    description: 'Updated expected cost in ISK as string',
  })
  @IsOptional()
  @IsString()
  expectedCostIsk?: string | null;

  @ApiPropertyOptional({
    description: 'Whether this subscription is currently active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;

  @ApiPropertyOptional({ description: 'Updated notes' })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CreateBoosterDto {
  @ApiProperty({ description: 'Name of the booster' })
  @IsString()
  @IsNotEmpty()
  boosterName!: string;

  @ApiPropertyOptional({
    description: 'Start time of the booster (ISO-8601). Defaults to now.',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({
    description: 'Expiry time of the booster (ISO-8601)',
  })
  @IsDateString()
  expiresAt!: string;

  @ApiPropertyOptional({
    description: 'Source of this booster entry (manual, promotion, etc.)',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Optional notes about this booster' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBoosterDto {
  @ApiPropertyOptional({ description: 'Updated booster name' })
  @IsOptional()
  @IsString()
  boosterName?: string | null;

  @ApiPropertyOptional({ description: 'Updated start time (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({ description: 'Updated expiry time (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ description: 'Updated source for this booster' })
  @IsOptional()
  @IsString()
  source?: string | null;

  @ApiPropertyOptional({ description: 'Updated notes' })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
