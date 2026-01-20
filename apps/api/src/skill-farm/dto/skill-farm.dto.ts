import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateSkillFarmSettingsDto {
  @ApiProperty({ description: 'Effective ISK price per PLEX', required: false })
  @IsOptional()
  @IsNumber()
  plexPriceIsk?: number | null;

  @ApiProperty({
    description: 'Effective PLEX required for one Omega period',
    required: false,
  })
  @IsOptional()
  @IsInt()
  plexPerOmega?: number | null;

  @ApiProperty({
    description: 'Effective PLEX required for one MCT period',
    required: false,
  })
  @IsOptional()
  @IsInt()
  plexPerMct?: number | null;

  @ApiProperty({ description: 'ISK cost per skill extractor', required: false })
  @IsOptional()
  @IsNumber()
  extractorPriceIsk?: number | null;

  @ApiProperty({ description: 'ISK price per skill injector', required: false })
  @IsOptional()
  @IsNumber()
  injectorPriceIsk?: number | null;

  @ApiProperty({
    description: 'ISK cost per cycle for boosters (e.g., +12 Genius)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  boosterCostPerCycleIsk?: number | null;

  @ApiProperty({
    description: 'Sales tax percentage (0–100)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  salesTaxPercent?: number | null;

  @ApiProperty({
    description: 'Broker fee percentage (0–100)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  brokerFeePercent?: number | null;

  @ApiProperty({
    description:
      'When true, assume injectors are sold via contracts/Discord (skip market fees)',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  soldViaContracts?: boolean;

  @ApiProperty({
    description: 'Cycle length in days for projections (e.g., 30)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  cycleDays?: number | null;

  @ApiProperty({
    description: 'Estimated management time per cycle in minutes',
    required: false,
  })
  @IsOptional()
  @IsInt()
  managementMinutesPerCycle?: number | null;
}

export class UpdateSkillFarmCharacterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isCandidate?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActiveFarm?: boolean;

  @ApiProperty({
    description: 'Optional farm plan id used to define farmable skills',
    required: false,
  })
  @IsOptional()
  @IsString()
  farmPlanId?: string | null;

  @ApiProperty({
    description: 'Whether this character should be included in notifications',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeInNotifications?: boolean;
}

export class PreviewSkillFarmPlanDto {
  @ApiProperty({
    description:
      'Primary attribute for all crop skills in this plan (single remap).',
    required: false,
    default: 'intelligence',
    enum: ['intelligence', 'memory', 'perception', 'willpower', 'charisma'],
  })
  @IsOptional()
  @IsIn(['intelligence', 'memory', 'perception', 'willpower', 'charisma'])
  primaryAttribute?:
    | 'intelligence'
    | 'memory'
    | 'perception'
    | 'willpower'
    | 'charisma';

  @ApiProperty({
    description:
      'Secondary attribute for all crop skills in this plan (single remap).',
    required: false,
    default: 'memory',
    enum: ['intelligence', 'memory', 'perception', 'willpower', 'charisma'],
  })
  @IsOptional()
  @IsIn(['intelligence', 'memory', 'perception', 'willpower', 'charisma'])
  secondaryAttribute?:
    | 'intelligence'
    | 'memory'
    | 'perception'
    | 'willpower'
    | 'charisma';

  @ApiProperty({
    description:
      'Target total plan duration (in days). The generator will pick skills until it meets/exceeds this.',
    required: false,
    default: 90,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  planDays?: number;

  @ApiProperty({
    description:
      'Minimum training time (in days) a single crop skill must take from 0->V under the recommended remap.',
    required: false,
    default: 8,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  minSkillDays?: number;

  @ApiProperty({
    description:
      'Maximum number of prerequisites a crop skill may declare in SDE (0–3). Lower values produce more "dead-end" crops.',
    required: false,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  maxPrerequisites?: number;

  @ApiProperty({
    description: 'Maximum number of crop skills to include (safety cap).',
    required: false,
    default: 12,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxSkills?: number;

  @ApiProperty({
    description:
      'Optional list of case-insensitive substrings to exclude by skill name (e.g. ["Capital"] to avoid expensive capital-related books).',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  excludeNameContains?: string[];
}
