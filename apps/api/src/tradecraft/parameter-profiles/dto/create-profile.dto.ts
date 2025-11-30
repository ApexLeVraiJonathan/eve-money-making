import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum ParameterProfileScope {
  LIQUIDITY = 'LIQUIDITY',
  ARBITRAGE = 'ARBITRAGE',
  PLANNER = 'PLANNER',
}

export class CreateProfileDto {
  @ApiProperty({ description: 'Profile name', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Profile description',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Scope of the profile',
    enum: ParameterProfileScope,
  })
  @IsEnum(ParameterProfileScope)
  scope: ParameterProfileScope;

  @ApiProperty({
    description: 'Parameters as JSON object',
  })
  @IsObject()
  params: Record<string, any>;
}
