import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum ParameterProfileScope {
  LIQUIDITY = 'LIQUIDITY',
  ARBITRAGE = 'ARBITRAGE',
  PLANNER = 'PLANNER',
}

export class ListProfilesQueryDto {
  @ApiProperty({
    description: 'Filter by scope',
    enum: ParameterProfileScope,
    required: false,
  })
  @IsOptional()
  @IsEnum(ParameterProfileScope)
  scope?: ParameterProfileScope;
}

