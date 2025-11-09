import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class SetCharacterProfileRequest {
  @ApiPropertyOptional({
    description: 'Character role',
    enum: ['USER', 'LOGISTICS'],
    example: 'USER',
  })
  @IsOptional()
  @IsEnum(['USER', 'LOGISTICS'])
  role?: string;

  @ApiPropertyOptional({
    description: 'Character function/job',
    example: 'Hauler',
  })
  @IsOptional()
  @IsString()
  function?: string;

  @ApiPropertyOptional({
    description: 'Character location',
    example: 'Jita',
  })
  @IsOptional()
  @IsString()
  location?: string;
}
