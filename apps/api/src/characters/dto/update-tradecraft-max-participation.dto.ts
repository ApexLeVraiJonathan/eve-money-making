import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateTradecraftCapsRequestDto {
  @ApiPropertyOptional({
    description:
      'Tradecraft principal cap override (decimal ISK string). Null/omit to clear and use default.',
    example: '10000000000.00',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  principalCapIsk?: string | null;

  @ApiPropertyOptional({
    description:
      'Tradecraft maximum cap override (decimal ISK string). Null/omit to clear and use default.',
    example: '20000000000.00',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  maximumCapIsk?: string | null;

  /**
   * Back-compat: old payload field name used by the initial implementation.
   * If provided, it is treated as maximumCapIsk.
   */
  @ApiPropertyOptional({
    description: '(Deprecated) Alias of maximumCapIsk',
    example: '15000000000.00',
    nullable: true,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  maxParticipationIsk?: string | null;
}
