import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateParticipationRequest {
  @ApiPropertyOptional({
    description: 'Character name',
    minLength: 1,
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  characterName?: string;

  @ApiPropertyOptional({
    description: 'Profit share percentage (0-1)',
    minimum: 0,
    maximum: 1,
    example: 0.15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  profitSharePct?: number;
}
