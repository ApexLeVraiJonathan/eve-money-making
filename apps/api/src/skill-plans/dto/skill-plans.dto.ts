import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSkillPlanDto {
  @ApiProperty({ description: 'Name of the skill plan' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Optional description for this plan' })
  @IsOptional()
  @IsString()
  description?: string;
}

export enum SkillPlanImportFormatEnum {
  EVE = 'eve',
  APP = 'app',
}

export class ImportSkillPlanDto {
  @ApiProperty({
    description: 'Raw skill plan text copied from EVE client or app export',
  })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({
    description: 'Format of the imported text',
    enum: SkillPlanImportFormatEnum,
    default: SkillPlanImportFormatEnum.EVE,
  })
  @IsEnum(SkillPlanImportFormatEnum)
  format!: SkillPlanImportFormatEnum;

  @ApiPropertyOptional({
    description:
      'Optional name hint to use when constructing the imported plan preview',
  })
  @IsOptional()
  @IsString()
  nameHint?: string;
}

export enum SkillPlanOptimizationModeEnum {
  FULL = 'FULL',
  RESPECT_ORDER = 'RESPECT_ORDER',
}

export class OptimizationPreviewRequestDto {
  @ApiPropertyOptional({
    description:
      'Optimisation mode. FULL may freely reorder, RESPECT_ORDER keeps existing ordering as much as possible.',
    enum: SkillPlanOptimizationModeEnum,
    default: SkillPlanOptimizationModeEnum.RESPECT_ORDER,
  })
  @IsOptional()
  @IsEnum(SkillPlanOptimizationModeEnum)
  mode?: SkillPlanOptimizationModeEnum;

  @ApiPropertyOptional({
    description:
      'Maximum number of remaps to assume for this optimisation run (currently used for metadata only).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRemaps?: number;

  @ApiPropertyOptional({
    description:
      'Optional character ID whose current attributes should be used as the base for time estimates.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  characterId?: number;

  @ApiPropertyOptional({
    description: 'Assumed implant bonus (0–5) for optimisation preview.',
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  implantBonus?: number;

  @ApiPropertyOptional({
    description:
      'Assumed booster modifier (0,2,4,6,8,10,12) for optimisation preview.',
  })
  @IsOptional()
  @IsInt()
  boosterBonus?: number;
}

export class SkillPlanStepInputDto {
  @ApiProperty({ description: 'EVE skill type ID' })
  @IsInt()
  @Min(1)
  skillId!: number;

  @ApiProperty({
    description: 'Target level (1–5) for this skill within the plan',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  targetLevel!: number;

  @ApiProperty({
    description: 'Order of this step in the plan (0-based or 1-based)',
  })
  @IsInt()
  order!: number;

  @ApiPropertyOptional({ description: 'Optional notes for this plan step' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSkillPlanDto {
  @ApiPropertyOptional({ description: 'Updated name for the plan' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description for the plan' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Full replacement list of steps for this plan (existing steps will be replaced)',
    type: [SkillPlanStepInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillPlanStepInputDto)
  steps?: SkillPlanStepInputDto[];
}

export class AttributeSuggestionRequestDto {
  @ApiPropertyOptional({
    description:
      'Optional character ID to use current attributes for time estimates',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  characterId?: number;
}
