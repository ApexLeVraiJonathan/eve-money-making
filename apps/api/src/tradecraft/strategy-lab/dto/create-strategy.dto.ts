import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  Allow,
} from 'class-validator';

export class CreateTradeStrategyDto {
  @ApiProperty({ maxLength: 100, example: 'Conservative 3d inv, 12% margin' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description:
      'Strategy parameters (compatible with PlanPackagesRequest shape; stored as JSON)',
    type: Object,
  })
  @Allow()
  params!: unknown;

  @ApiPropertyOptional({ description: 'Whether the strategy is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
